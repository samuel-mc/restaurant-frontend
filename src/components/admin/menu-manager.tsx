"use client";

/**
 * Panel de gestión del catálogo: categorías + productos + stock rápido.
 */

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { FileSpreadsheet, Pencil, Trash2, Upload } from "lucide-react";
import type { Category, Product } from "@/types/api";
import type { MenuImportResult } from "@/types/menu-import";
import { AvailabilityToggle } from "@/components/admin/availability-toggle";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ImportMenuModal } from "@/components/admin/import-menu-modal";
import { ProductFormModal } from "@/components/admin/product-form-modal";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import {
  createCategory,
  createProductWithForm,
  deleteCategory,
  deleteProduct,
  toggleProductAvailability,
  updateCategory,
  updateProductWithForm,
  type ProductFormSubmitPayload,
} from "@/services/adminCatalogService";
import { downloadMenuExcelTemplate } from "@/services/adminMenuImportService";
import { getAdminErrorMessage } from "@/lib/admin-error";
import {
  BASIC_MAX_PRODUCTS,
  BASIC_PRODUCT_LIMIT_UPGRADE_MESSAGE,
  basicProductOverLimitMessage,
  isProPlan,
  type SubscriptionPlan,
} from "@/lib/subscription-plan";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const btnPrimary = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 ${focusRing}`;

const btnSecondary = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary ${focusRing}`;

interface MenuManagerProps {
  tenantSlug: string;
  restaurantName: string;
  initialCategories: Category[];
  initialProducts: Product[];
  plan: SubscriptionPlan;
}

type ModalState =
  | { open: false }
  | { open: true; mode: "create" | "edit"; product: Product | null };

type CategoryDialogState =
  | { open: false }
  | { open: true; mode: "create" | "edit"; category: Category | null };

type ConfirmState =
  | { open: false }
  | {
      open: true;
      kind: "product";
      product: Product;
    }
  | {
      open: true;
      kind: "category";
      category: Category;
      productCount: number;
    };

export function MenuManager({
  tenantSlug,
  initialCategories,
  initialProducts,
  plan,
}: MenuManagerProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [products, setProducts] = useState(initialProducts);
  const atProductLimit =
    !isProPlan(plan) && products.length >= BASIC_MAX_PRODUCTS;
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    () => initialCategories[0]?.id ?? null,
  );
  const [mobileCatsOpen, setMobileCatsOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingUuid, setTogglingUuid] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categoryDialog, setCategoryDialog] = useState<CategoryDialogState>({
    open: false,
  });
  const [categoryNameDraft, setCategoryNameDraft] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false });
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [, startTransition] = useTransition();

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const filteredProducts = useMemo(() => {
    if (selectedCategoryId == null) return [];
    return products.filter((p) => p.categoryId === selectedCategoryId);
  }, [products, selectedCategoryId]);

  function showBanner(message: string) {
    setBanner(message);
    window.setTimeout(() => {
      setBanner((current) => (current === message ? null : current));
    }, 3200);
  }

  function openCreateProduct() {
    if (atProductLimit) {
      showBanner(BASIC_PRODUCT_LIMIT_UPGRADE_MESSAGE);
      return;
    }
    setFormError(null);
    setModal({ open: true, mode: "create", product: null });
  }

  function openImportMenu() {
    if (atProductLimit) {
      showBanner(BASIC_PRODUCT_LIMIT_UPGRADE_MESSAGE);
      return;
    }
    setImportOpen(true);
  }

  async function handleDownloadTemplate() {
    if (templateBusy) return;
    setTemplateBusy(true);
    try {
      await downloadMenuExcelTemplate(tenantSlug);
      showBanner("Plantilla Excel descargada");
    } catch (error) {
      showBanner(
        getAdminErrorMessage(error, "No se pudo descargar la plantilla."),
      );
    } finally {
      setTemplateBusy(false);
    }
  }

  function handleMenuImported(result: MenuImportResult) {
    startTransition(() => {
      if (result.categoriesCreated.length > 0) {
        setCategories((prev) => {
          const byId = new Map(prev.map((c) => [c.id, c]));
          for (const created of result.categoriesCreated) {
            byId.set(created.id, created);
          }
          return Array.from(byId.values()).sort(
            (a, b) =>
              a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
          );
        });
        if (selectedCategoryId == null && result.categoriesCreated[0]) {
          setSelectedCategoryId(result.categoriesCreated[0].id);
        }
      }

      if (result.products.length > 0) {
        setProducts((prev) => {
          const byUuid = new Map(prev.map((p) => [p.uuid, p]));
          for (const created of result.products) {
            byUuid.set(created.uuid, created);
          }
          return Array.from(byUuid.values()).sort((a, b) =>
            a.name.localeCompare(b.name),
          );
        });
        const first = result.products[0];
        if (first) setSelectedCategoryId(first.categoryId);
      }
    });

    if (result.creadosExitosamente > 0) {
      showBanner(
        `${result.creadosExitosamente} platillo${result.creadosExitosamente === 1 ? "" : "s"} importado${result.creadosExitosamente === 1 ? "" : "s"}`,
      );
    }
  }

  function openEditProduct(product: Product) {
    setFormError(null);
    setModal({ open: true, mode: "edit", product });
  }

  function closeModal() {
    if (formSubmitting) return;
    setModal({ open: false });
    setFormError(null);
  }

  function openCreateCategory() {
    setCategoryError(null);
    setCategoryNameDraft("");
    setCategoryDialog({ open: true, mode: "create", category: null });
  }

  function openEditCategory(category: Category) {
    setCategoryError(null);
    setCategoryNameDraft(category.name);
    setCategoryDialog({ open: true, mode: "edit", category });
  }

  function closeCategoryDialog() {
    if (categoryBusy) return;
    setCategoryDialog({ open: false });
    setCategoryError(null);
  }

  function requestDeleteProduct(product: Product) {
    setConfirm({ open: true, kind: "product", product });
  }

  function requestDeleteCategory(category: Category) {
    const productCount = products.filter(
      (p) => p.categoryId === category.id,
    ).length;
    setConfirm({ open: true, kind: "category", category, productCount });
  }

  function closeConfirm() {
    if (confirmBusy) return;
    setConfirm({ open: false });
  }

  async function handleConfirmDelete() {
    if (!confirm.open) return;
    setConfirmBusy(true);

    try {
      if (confirm.kind === "product") {
        const { product } = confirm;
        await deleteProduct(product.uuid, tenantSlug);
        startTransition(() => {
          setProducts((prev) => prev.filter((p) => p.uuid !== product.uuid));
        });
        showBanner(`Platillo «${product.name}» eliminado`);
      } else {
        const { category, productCount } = confirm;
        if (productCount > 0) {
          showBanner(
            `No se puede eliminar «${category.name}»: tiene ${productCount} platillo${productCount === 1 ? "" : "s"}. Elimínalos o muévelos primero.`,
          );
          setConfirm({ open: false });
          return;
        }
        await deleteCategory(category.id, tenantSlug);
        const nextCategories = categories.filter((c) => c.id !== category.id);
        startTransition(() => {
          setCategories(nextCategories);
          setProducts((prev) =>
            prev.filter((p) => p.categoryId !== category.id),
          );
          setSelectedCategoryId((current) =>
            current === category.id ? (nextCategories[0]?.id ?? null) : current,
          );
        });
        showBanner(`Categoría «${category.name}» eliminada`);
      }
      setConfirm({ open: false });
    } catch (error) {
      showBanner(
        getAdminErrorMessage(error, "No se pudo eliminar. Intenta de nuevo."),
      );
    } finally {
      setConfirmBusy(false);
    }
  }

  async function handleProductSubmit(payload: ProductFormSubmitPayload) {
    if (!modal.open) return;
    setFormSubmitting(true);
    setFormError(null);

    try {
      if (modal.mode === "create") {
        if (atProductLimit) {
          setFormError(BASIC_PRODUCT_LIMIT_UPGRADE_MESSAGE);
          return;
        }
        const created = await createProductWithForm(payload, tenantSlug);
        startTransition(() => {
          setProducts((prev) =>
            [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
          );
          setSelectedCategoryId(created.categoryId);
        });
        showBanner(`Platillo «${created.name}» creado`);
      } else if (modal.product) {
        const updated = await updateProductWithForm(
          modal.product.uuid,
          payload,
          tenantSlug,
        );
        startTransition(() => {
          setProducts((prev) =>
            prev
              .map((p) => (p.uuid === updated.uuid ? updated : p))
              .sort((a, b) => a.name.localeCompare(b.name)),
          );
          setSelectedCategoryId(updated.categoryId);
        });
        showBanner(`Platillo «${updated.name}» actualizado`);
      }
      setModal({ open: false });
      setFormError(null);
    } catch (error) {
      setFormError(
        getAdminErrorMessage(error, "No se pudo guardar el platillo."),
      );
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleToggle(product: Product) {
    if (togglingUuid) return;
    setTogglingUuid(product.uuid);

    const previous = product.isAvailable;
    startTransition(() => {
      setProducts((prev) =>
        prev.map((p) =>
          p.uuid === product.uuid
            ? { ...p, isAvailable: !p.isAvailable }
            : p,
        ),
      );
    });

    try {
      const updated = await toggleProductAvailability(
        product.uuid,
        tenantSlug,
      );
      startTransition(() => {
        setProducts((prev) =>
          prev.map((p) => (p.uuid === updated.uuid ? updated : p)),
        );
      });
    } catch (error) {
      startTransition(() => {
        setProducts((prev) =>
          prev.map((p) =>
            p.uuid === product.uuid ? { ...p, isAvailable: previous } : p,
          ),
        );
      });
      showBanner(
        getAdminErrorMessage(
          error,
          "No se pudo cambiar la disponibilidad.",
        ),
      );
    } finally {
      setTogglingUuid(null);
    }
  }

  async function handleCategorySubmit(event: FormEvent) {
    event.preventDefault();
    if (!categoryDialog.open) return;

    const name = categoryNameDraft.trim();
    if (!name) {
      setCategoryError("El nombre es obligatorio.");
      return;
    }
    if (name.length > 50) {
      setCategoryError("Máximo 50 caracteres.");
      return;
    }

    setCategoryBusy(true);
    setCategoryError(null);

    try {
      if (categoryDialog.mode === "create") {
        const displayOrder =
          categories.reduce((max, c) => Math.max(max, c.displayOrder), -1) + 1;
        const created = await createCategory(
          { name, displayOrder },
          tenantSlug,
        );
        startTransition(() => {
          setCategories((prev) =>
            [...prev, created].sort(
              (a, b) =>
                a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
            ),
          );
          setSelectedCategoryId(created.id);
        });
        showBanner(`Categoría «${created.name}» creada`);
      } else if (categoryDialog.category) {
        const updated = await updateCategory(
          categoryDialog.category.id,
          {
            name,
            displayOrder: categoryDialog.category.displayOrder,
          },
          tenantSlug,
        );
        startTransition(() => {
          setCategories((prev) =>
            prev
              .map((c) => (c.id === updated.id ? updated : c))
              .sort(
                (a, b) =>
                  a.displayOrder - b.displayOrder ||
                  a.name.localeCompare(b.name),
              ),
          );
          setProducts((prev) =>
            prev.map((p) =>
              p.categoryId === updated.id
                ? { ...p, categoryName: updated.name }
                : p,
            ),
          );
        });
        showBanner(`Categoría «${updated.name}» actualizada`);
      }
      setCategoryDialog({ open: false });
      setCategoryNameDraft("");
      setMobileCatsOpen(false);
    } catch (error) {
      setCategoryError(
        getAdminErrorMessage(error, "No se pudo guardar la categoría."),
      );
    } finally {
      setCategoryBusy(false);
    }
  }

  function selectCategory(id: number) {
    setSelectedCategoryId(id);
    setMobileCatsOpen(false);
  }

  const canCreateProduct = categories.length > 0 && !atProductLimit;

  return (
    <div className="flex flex-col pb-8 font-jakarta-sans">
      <header className="border-b border-border px-4 py-5 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-xl">
            <h1 className="text-2xl font-bold tracking-tight">
              Menú
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Categorías, precios y disponibilidad del menú digital.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleDownloadTemplate()}
              disabled={templateBusy}
              className={`${btnSecondary} disabled:opacity-40`}
            >
              <FileSpreadsheet className="size-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">
                {templateBusy ? "Descargando…" : "Plantilla Excel"}
              </span>
              <span className="sm:hidden">
                {templateBusy ? "…" : "Plantilla"}
              </span>
            </button>
            <button
              type="button"
              onClick={openImportMenu}
              disabled={atProductLimit}
              title={
                atProductLimit ? BASIC_PRODUCT_LIMIT_UPGRADE_MESSAGE : undefined
              }
              className={`${btnSecondary} disabled:opacity-40`}
            >
              <Upload className="size-4 shrink-0" aria-hidden />
              Importar
            </button>
            <button
              type="button"
              onClick={openCreateProduct}
              disabled={!canCreateProduct}
              title={
                atProductLimit ? BASIC_PRODUCT_LIMIT_UPGRADE_MESSAGE : undefined
              }
              className={`${btnPrimary} disabled:opacity-40`}
            >
              Nuevo platillo
            </button>
          </div>
        </div>
        {!isProPlan(plan) ? (
          <p
            role="status"
            className="mt-4 rounded-xl border border-warn/25 bg-warn-muted px-4 py-2.5 text-sm text-warn-ink"
          >
            Plan Básico: {products.length}/{BASIC_MAX_PRODUCTS} platillos
            {products.length > BASIC_MAX_PRODUCTS
              ? ` · ${basicProductOverLimitMessage(products.length)}`
              : atProductLimit
                ? " · Límite alcanzado. Actualiza al Plan Pro para agregar o importar más."
                : "."}
          </p>
        ) : null}
        {banner ? (
          <p
            role="status"
            className="mt-3 rounded-xl bg-live-muted px-4 py-2.5 text-sm font-semibold text-live-ink"
          >
            {banner}
          </p>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:flex-row md:gap-6 md:p-6">
        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setMobileCatsOpen((o) => !o)}
            aria-expanded={mobileCatsOpen}
            className={`flex min-h-11 w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left ${focusRing}`}
          >
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-muted-foreground">
                Categoría
              </span>
              <span className="block truncate font-semibold">
                {selectedCategory?.name ?? "Selecciona una categoría"}
              </span>
            </span>
            <span className="shrink-0 text-sm text-muted-foreground">
              {mobileCatsOpen ? "Cerrar" : "Cambiar"}
            </span>
          </button>
          {mobileCatsOpen ? (
            <CategoryList
              categories={categories}
              products={products}
              selectedCategoryId={selectedCategoryId}
              onSelect={selectCategory}
              onNewCategory={openCreateCategory}
              onEditCategory={openEditCategory}
              onDeleteCategory={requestDeleteCategory}
              className="mt-2"
            />
          ) : null}
        </div>

        <aside className="hidden w-64 shrink-0 md:block lg:w-72">
          <CategoryList
            categories={categories}
            products={products}
            selectedCategoryId={selectedCategoryId}
            onSelect={selectCategory}
            onNewCategory={openCreateCategory}
            onEditCategory={openEditCategory}
            onDeleteCategory={requestDeleteCategory}
          />
        </aside>

        <section className="min-w-0 flex-1" aria-live="polite">
          <div className="mb-4">
            <h2 className="text-lg font-bold tracking-tight">
              {selectedCategory?.name ?? "Platillos"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {categories.length === 0
                ? "Crea una categoría para empezar a cargar platillos."
                : `${filteredProducts.length} platillo${filteredProducts.length === 1 ? "" : "s"}`}
            </p>
          </div>

          {categories.length === 0 ? (
            <EmptyState
              title="Sin categorías"
              description="Agrega la primera categoría del menú para organizar tus platillos."
              actionLabel="Nueva categoría"
              onAction={openCreateCategory}
            />
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              title="Sin platillos en esta categoría"
              description={
                atProductLimit
                  ? BASIC_PRODUCT_LIMIT_UPGRADE_MESSAGE
                  : "Agrega el primer platillo o selecciona otra categoría."
              }
              actionLabel="Agregar platillo"
              onAction={openCreateProduct}
              actionDisabled={atProductLimit}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => (
                <li key={product.uuid}>
                  <ProductAdminCard
                    product={product}
                    toggling={togglingUuid === product.uuid}
                    onToggle={() => handleToggle(product)}
                    onEdit={() => openEditProduct(product)}
                    onDelete={() => requestDeleteProduct(product)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ProductFormModal
        open={modal.open}
        mode={modal.open ? modal.mode : "create"}
        categories={categories}
        initial={modal.open ? modal.product : null}
        defaultCategoryId={selectedCategoryId}
        submitting={formSubmitting}
        error={formError}
        onClose={closeModal}
        onSubmit={handleProductSubmit}
      />

      <ImportMenuModal
        open={importOpen}
        tenantSlug={tenantSlug}
        busy={false}
        remainingSlots={
          isProPlan(plan)
            ? null
            : Math.max(0, BASIC_MAX_PRODUCTS - products.length)
        }
        onClose={() => setImportOpen(false)}
        onImported={handleMenuImported}
      />

      <ConfirmDialog
        open={confirm.open}
        busy={confirmBusy}
        busyLabel="Eliminando…"
        title={
          confirm.open && confirm.kind === "product"
            ? "Eliminar platillo"
            : "Eliminar categoría"
        }
        description={
          !confirm.open
            ? ""
            : confirm.kind === "product"
              ? `¿Eliminar «${confirm.product.name}»? Dejará de aparecer en el menú digital.`
              : confirm.productCount > 0
                ? `«${confirm.category.name}» tiene ${confirm.productCount} platillo${confirm.productCount === 1 ? "" : "s"}. Elimina o mueve los platillos antes de borrar la categoría.`
                : `¿Eliminar la categoría «${confirm.category.name}»? Esta acción no se puede deshacer desde el panel.`
        }
        confirmLabel={
          confirm.open &&
          confirm.kind === "category" &&
          confirm.productCount > 0
            ? "Entendido"
            : "Eliminar"
        }
        tone={
          confirm.open &&
          confirm.kind === "category" &&
          confirm.productCount > 0
            ? "neutral"
            : "danger"
        }
        onCancel={closeConfirm}
        onConfirm={() => {
          if (
            confirm.open &&
            confirm.kind === "category" &&
            confirm.productCount > 0
          ) {
            closeConfirm();
            return;
          }
          void handleConfirmDelete();
        }}
      />

      {categoryDialog.open ? (
        <CategoryDialogPanel
          mode={categoryDialog.mode}
          name={categoryNameDraft}
          error={categoryError}
          busy={categoryBusy}
          onNameChange={(value) => {
            setCategoryNameDraft(value);
            setCategoryError(null);
          }}
          onClose={closeCategoryDialog}
          onSubmit={handleCategorySubmit}
        />
      ) : null}
    </div>
  );
}

function CategoryDialogPanel({
  mode,
  name,
  error,
  busy,
  onNameChange,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  name: string;
  error: string | null;
  busy: boolean;
  onNameChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const panelRef = useModalFocusTrap({
    open: true,
    onEscape: onClose,
    escapeEnabled: !busy,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-dialog-title"
        className="w-full max-w-md rounded-t-2xl bg-card p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:rounded-2xl"
      >
        <form onSubmit={onSubmit}>
          <h2
            id="category-dialog-title"
            className="text-lg font-bold tracking-tight"
          >
            {mode === "create" ? "Nueva categoría" : "Editar categoría"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Aparecerá en el menú digital y en este panel.
          </p>
          <label className="mt-4 block">
            <span className="sr-only">Nombre de la categoría</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              maxLength={50}
              placeholder="Ej. Entradas"
              aria-invalid={Boolean(error)}
              className={`w-full rounded-xl border bg-secondary px-3.5 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 ${
                error ? "border-destructive" : "border-border"
              }`}
            />
          </label>
          {error ? (
            <p
              className="mt-2 text-sm font-medium text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary ${focusRing}`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className={`${btnPrimary} disabled:opacity-50`}
            >
              {busy ? "Guardando…" : mode === "create" ? "Crear" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoryList({
  categories,
  products,
  selectedCategoryId,
  onSelect,
  onNewCategory,
  onEditCategory,
  onDeleteCategory,
  className = "",
}: {
  categories: Category[];
  products: Product[];
  selectedCategoryId: number | null;
  onSelect: (id: number) => void;
  onNewCategory: () => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (category: Category) => void;
  className?: string;
}) {
  const counts = useMemo(() => {
    const map = new Map<number, number>();
    for (const product of products) {
      map.set(product.categoryId, (map.get(product.categoryId) ?? 0) + 1);
    }
    return map;
  }, [products]);

  return (
    <div
      className={`rounded-2xl border border-border bg-card p-3 ${className}`}
    >
      <button
        type="button"
        onClick={onNewCategory}
        className={`mb-3 flex min-h-11 w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border text-sm font-semibold transition-colors hover:bg-secondary ${focusRing}`}
      >
        Nueva categoría
      </button>
      {categories.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-muted-foreground">
          Aún no hay categorías
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {categories.map((category) => {
            const active = category.id === selectedCategoryId;
            const count = counts.get(category.id) ?? 0;
            return (
              <li key={category.id} className="flex items-stretch gap-0.5">
                <button
                  type="button"
                  onClick={() => onSelect(category.id)}
                  className={`flex min-h-11 min-w-0 flex-1 items-center justify-between rounded-xl px-3 text-left text-sm transition-colors ${focusRing} ${
                    active
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "font-medium text-foreground hover:bg-secondary"
                  }`}
                >
                  <span className="truncate">{category.name}</span>
                  <span
                    className={`ml-2 tabular-nums ${
                      active ? "opacity-70" : "text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Editar ${category.name}`}
                  title="Editar"
                  onClick={() => onEditCategory(category)}
                  className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${focusRing}`}
                >
                  <Pencil className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Eliminar ${category.name}`}
                  title="Eliminar"
                  onClick={() => onDeleteCategory(category)}
                  className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-destructive/80 transition-colors hover:bg-destructive/10 hover:text-destructive ${focusRing}`}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProductAdminCard({
  product,
  toggling,
  onToggle,
  onEdit,
  onDelete,
}: {
  product: Product;
  toggling: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const available = product.isAvailable;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative aspect-[16/10] overflow-hidden bg-secondary">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt=""
            className={`size-full object-cover transition-[filter,opacity] duration-200 ${
              available ? "" : "opacity-55 grayscale"
            }`}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div
            className={`flex size-full items-center justify-center text-xs font-semibold text-muted-foreground ${
              available ? "" : "opacity-60"
            }`}
          >
            Sin imagen
          </div>
        )}
        {!available ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8">
            <span className="text-xs font-bold uppercase tracking-wide text-white/95">
              Fuera del menú
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0 flex-1">
          <h3
            className={`truncate font-bold tracking-tight ${
              available ? "" : "text-muted-foreground"
            }`}
          >
            {product.name}
          </h3>
          {product.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {product.description}
            </p>
          ) : null}
          <p className="mt-2 text-base font-bold tabular-nums">
            {product.formattedPrice}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <AvailabilityToggle
            checked={available}
            busy={toggling}
            onChange={onToggle}
            productName={product.name}
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Editar ${product.name}`}
              title="Editar"
              className={`inline-flex size-11 items-center justify-center rounded-xl bg-secondary text-foreground transition-colors hover:bg-secondary/80 ${focusRing}`}
            >
              <Pencil className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Eliminar ${product.name}`}
              title="Eliminar"
              className={`inline-flex size-11 items-center justify-center rounded-xl text-destructive transition-colors hover:bg-destructive/10 ${focusRing}`}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionDisabled = false,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/70 px-6 py-16 text-center">
      <h3 className="text-lg font-bold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      <button
        type="button"
        onClick={onAction}
        disabled={actionDisabled}
        className={`mt-5 ${btnPrimary} disabled:opacity-40`}
      >
        {actionLabel}
      </button>
    </div>
  );
}
