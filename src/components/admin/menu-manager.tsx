"use client";

/**
 * Panel de gestión del catálogo: categorías + productos + stock rápido.
 */

import Link from "next/link";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import type { Category, Product } from "@/types/api";
import { AvailabilityToggle } from "@/components/admin/availability-toggle";
import { ProductFormModal } from "@/components/admin/product-form-modal";
import {
  createCategory,
  createProductWithForm,
  toggleProductAvailability,
  updateCategory,
  updateProductWithForm,
  type ProductFormSubmitPayload,
} from "@/services/adminCatalogService";
import { ApiError } from "@/services/apiClient";

interface MenuManagerProps {
  tenantSlug: string;
  restaurantName: string;
  initialCategories: Category[];
  initialProducts: Product[];
}

type ModalState =
  | { open: false }
  | { open: true; mode: "create" | "edit"; product: Product | null };

type CategoryDialogState =
  | { open: false }
  | { open: true; mode: "create" | "edit"; category: Category | null };

export function MenuManager({
  tenantSlug,
  restaurantName,
  initialCategories,
  initialProducts,
}: MenuManagerProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [products, setProducts] = useState(initialProducts);
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
    setFormError(null);
    setModal({ open: true, mode: "create", product: null });
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

  async function handleProductSubmit(payload: ProductFormSubmitPayload) {
    if (!modal.open) return;
    setFormSubmitting(true);
    setFormError(null);

    try {
      if (modal.mode === "create") {
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
        error instanceof ApiError
          ? error.message
          : "No se pudo guardar el platillo.",
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
        error instanceof ApiError
          ? error.message
          : "No se pudo cambiar la disponibilidad.",
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
        error instanceof ApiError
          ? error.message
          : "No se pudo guardar la categoría.",
      );
    } finally {
      setCategoryBusy(false);
    }
  }

  function selectCategory(id: number) {
    setSelectedCategoryId(id);
    setMobileCatsOpen(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-100 dark:bg-neutral-950">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/95 px-4 py-4 backdrop-blur md:px-6 dark:border-white/10 dark:bg-neutral-900/95">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-black/45 dark:text-white/45">
              Catálogo · Menú
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
              {restaurantName}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/dashboard"
              className="rounded-full bg-black/5 px-3 py-1.5 text-sm font-bold hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              Cocina
            </Link>
            <button
              type="button"
              onClick={openCreateProduct}
              disabled={categories.length === 0}
              className="rounded-full bg-foreground px-4 py-1.5 text-sm font-bold text-background disabled:opacity-40"
            >
              Agregar platillo
            </button>
          </div>
        </div>
        {banner ? (
          <p
            role="status"
            className="mx-auto mt-3 max-w-7xl rounded-xl bg-emerald-500/15 px-4 py-2 text-center text-sm font-bold text-emerald-800 dark:text-emerald-200"
          >
            {banner}
          </p>
        ) : null}
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4 md:flex-row md:gap-6 md:p-6">
        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setMobileCatsOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3 text-left dark:border-white/10 dark:bg-neutral-900"
          >
            <span>
              <span className="block text-xs font-semibold uppercase tracking-wide text-black/45 dark:text-white/45">
                Categoría
              </span>
              <span className="font-bold">
                {selectedCategory?.name ?? "Selecciona una categoría"}
              </span>
            </span>
            <span className="text-sm text-black/40 dark:text-white/40">
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
          />
        </aside>

        <section className="min-w-0 flex-1">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight md:text-xl">
                {selectedCategory?.name ?? "Productos"}
              </h2>
              <p className="text-sm text-black/50 dark:text-white/50">
                {categories.length === 0
                  ? "Crea una categoría para empezar a cargar platillos."
                  : `${filteredProducts.length} platillo${filteredProducts.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>

          {categories.length === 0 ? (
            <EmptyState
              title="Sin categorías"
              description="Agrega la primera categoría del menú para organizar tus platillos."
              actionLabel="+ Nueva categoría"
              onAction={openCreateCategory}
            />
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              title="Sin platillos en esta categoría"
              description="Agrega el primer platillo o selecciona otra categoría."
              actionLabel="Agregar platillo"
              onAction={openCreateProduct}
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

      {categoryDialog.open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCategoryDialog();
          }}
        >
          <form
            onSubmit={handleCategorySubmit}
            className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl dark:bg-neutral-900"
          >
            <h2 className="text-lg font-extrabold">
              {categoryDialog.mode === "create"
                ? "Nueva categoría"
                : "Editar categoría"}
            </h2>
            <p className="mt-1 text-sm text-black/50 dark:text-white/50">
              Aparecerá en el menú digital y en este panel.
            </p>
            <input
              autoFocus
              value={categoryNameDraft}
              onChange={(e) => {
                setCategoryNameDraft(e.target.value);
                setCategoryError(null);
              }}
              maxLength={50}
              placeholder="Ej. Entradas"
              className="mt-4 w-full rounded-2xl border border-black/10 bg-neutral-50 px-3.5 py-2.5 text-sm outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10 dark:border-white/15 dark:bg-neutral-800"
            />
            {categoryError ? (
              <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
                {categoryError}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={categoryBusy}
                onClick={closeCategoryDialog}
                className="rounded-2xl px-4 py-2.5 text-sm font-bold text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={categoryBusy}
                className="rounded-2xl bg-foreground px-4 py-2.5 text-sm font-bold text-background disabled:opacity-50"
              >
                {categoryBusy
                  ? "Guardando…"
                  : categoryDialog.mode === "create"
                    ? "Crear"
                    : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
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
  className = "",
}: {
  categories: Category[];
  products: Product[];
  selectedCategoryId: number | null;
  onSelect: (id: number) => void;
  onNewCategory: () => void;
  onEditCategory: (category: Category) => void;
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
      className={`rounded-3xl border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-neutral-900 ${className}`}
    >
      <button
        type="button"
        onClick={onNewCategory}
        className="mb-3 flex w-full items-center justify-center gap-1 rounded-2xl border border-dashed border-black/15 py-2.5 text-sm font-bold hover:bg-black/[0.03] dark:border-white/20 dark:hover:bg-white/5"
      >
        + Nueva categoría
      </button>
      {categories.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-black/40 dark:text-white/40">
          Aún no hay categorías
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {categories.map((category) => {
            const active = category.id === selectedCategoryId;
            const count = counts.get(category.id) ?? 0;
            return (
              <li key={category.id} className="group flex items-stretch gap-1">
                <button
                  type="button"
                  onClick={() => onSelect(category.id)}
                  className={`flex min-w-0 flex-1 items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                    active
                      ? "bg-foreground font-bold text-background"
                      : "font-semibold text-foreground hover:bg-black/[0.04] dark:hover:bg-white/5"
                  }`}
                >
                  <span className="truncate">{category.name}</span>
                  <span
                    className={`ml-2 tabular-nums ${
                      active ? "opacity-70" : "text-black/40 dark:text-white/40"
                    }`}
                  >
                    {count}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Editar ${category.name}`}
                  onClick={() => onEditCategory(category)}
                  className="shrink-0 rounded-2xl px-2.5 text-xs font-bold text-black/45 hover:bg-black/[0.04] hover:text-foreground dark:text-white/45 dark:hover:bg-white/5"
                >
                  Editar
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
}: {
  product: Product;
  toggling: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const available = product.isAvailable;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100 dark:bg-neutral-800">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt=""
            className={`size-full object-cover transition-[filter,opacity] duration-300 ${
              available ? "" : "opacity-55 grayscale"
            }`}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div
            className={`flex size-full items-center justify-center text-xs font-semibold uppercase tracking-wide text-black/30 dark:text-white/30 ${
              available ? "" : "opacity-60"
            }`}
          >
            Sin imagen
          </div>
        )}
        {!available ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/95">
              Fuera del menú
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0 flex-1">
          <h3
            className={`truncate font-extrabold tracking-tight ${
              available ? "" : "text-black/55 dark:text-white/55"
            }`}
          >
            {product.name}
          </h3>
          {product.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-black/50 dark:text-white/50">
              {product.description}
            </p>
          ) : null}
          <p className="mt-2 text-base font-black tabular-nums">
            {product.formattedPrice}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-black/5 pt-3 dark:border-white/10">
          <AvailabilityToggle
            checked={available}
            busy={toggling}
            onChange={onToggle}
            productName={product.name}
          />
          <button
            type="button"
            onClick={onEdit}
            className="rounded-xl bg-black/5 px-3 py-1.5 text-xs font-bold hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
          >
            Editar
          </button>
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
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-black/15 bg-white/70 px-6 py-16 text-center dark:border-white/15 dark:bg-neutral-900/70">
      <h3 className="text-lg font-extrabold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-black/50 dark:text-white/50">
        {description}
      </p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-bold text-background"
      >
        {actionLabel}
      </button>
    </div>
  );
}
