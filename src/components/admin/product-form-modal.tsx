"use client";

/**
 * Modal de alta/edición de platillo con carga de imagen (FormData / R2-ready).
 */

import { useId, useState, type FormEvent, type ReactNode } from "react";
import type { Category, Product, ProductModifierGroupRequest } from "@/types/api";
import type { ProductFormSubmitPayload } from "@/services/adminCatalogService";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";

export interface ProductFormValues {
  name: string;
  description: string;
  /** Precisión decimal como string (evita drift de float en el input). */
  price: string;
  categoryId: number;
}

interface ModifierOptionDraft {
  name: string;
  priceDelta: string;
}

interface ModifierGroupDraft {
  name: string;
  minSelect: string;
  maxSelect: string;
  options: ModifierOptionDraft[];
}

function groupsFromProduct(product: Product | null | undefined): ModifierGroupDraft[] {
  if (!product?.modifierGroups?.length) return [];
  return product.modifierGroups.map((g) => ({
    name: g.name,
    minSelect: String(g.minSelect),
    maxSelect: String(g.maxSelect),
    options: g.options.map((o) => ({
      name: o.name,
      priceDelta: Number.isFinite(o.priceDelta) ? o.priceDelta.toFixed(2) : "0.00",
    })),
  }));
}

function toModifierGroupRequests(
  drafts: ModifierGroupDraft[],
): ProductModifierGroupRequest[] {
  const result: ProductModifierGroupRequest[] = [];
  drafts.forEach((group, groupIndex) => {
    const name = group.name.trim();
    if (!name) return;
    const minSelect = Math.max(0, Number.parseInt(group.minSelect, 10) || 0);
    const maxSelect = Math.max(1, Number.parseInt(group.maxSelect, 10) || 1);
    const options = group.options
      .map((opt, optIndex) => {
        const optName = opt.name.trim();
        if (!optName) return null;
        const price = parsePriceInput(opt.priceDelta);
        return {
          name: optName,
          priceDelta: price ?? 0,
          available: true,
          displayOrder: optIndex,
        };
      })
      .filter((o): o is NonNullable<typeof o> => o != null);
    if (options.length === 0) return;
    result.push({
      name,
      minSelect: Math.min(minSelect, options.length),
      maxSelect: Math.min(Math.max(maxSelect, minSelect), options.length),
      displayOrder: groupIndex,
      options,
    });
  });
  return result;
}

interface ProductFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  categories: Category[];
  initial?: Product | null;
  defaultCategoryId: number | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: ProductFormSubmitPayload) => Promise<void>;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function productToValues(
  product: Product | null | undefined,
  defaultCategoryId: number | null,
  categories: Category[],
): ProductFormValues {
  const fallbackCategory = defaultCategoryId ?? categories[0]?.id ?? 0;

  if (!product) {
    return {
      name: "",
      description: "",
      price: "",
      categoryId: fallbackCategory,
    };
  }

  return {
    name: product.name,
    description: product.description ?? "",
    price: Number.isFinite(product.price) ? product.price.toFixed(2) : "",
    categoryId: product.categoryId,
  };
}

function parsePriceInput(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

function revokeIfBlob(url: string | null) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export function ProductFormModal({
  open,
  mode,
  categories,
  initial,
  defaultCategoryId,
  submitting,
  error,
  onClose,
  onSubmit,
}: ProductFormModalProps) {
  if (!open) return null;

  const formKey = `${mode}-${initial?.uuid ?? "new"}-${defaultCategoryId ?? "none"}`;

  return (
    <ProductFormDialog
      key={formKey}
      mode={mode}
      categories={categories}
      initial={initial}
      defaultCategoryId={defaultCategoryId}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function ProductFormDialog({
  mode,
  categories,
  initial,
  defaultCategoryId,
  submitting,
  error,
  onClose,
  onSubmit,
}: Omit<ProductFormModalProps, "open">) {
  const titleId = useId();
  const fileInputId = useId();
  const [values, setValues] = useState<ProductFormValues>(() =>
    productToValues(initial, defaultCategoryId, categories),
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    () => initial?.imageUrl ?? null,
  );
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ProductFormValues | "image", string>>
  >({});
  const [modifierGroups, setModifierGroups] = useState<ModifierGroupDraft[]>(() =>
    groupsFromProduct(initial),
  );

  function updateField<K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function handleFileChange(fileList: FileList | null) {
    const file = fileList?.[0] ?? null;
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.image;
      return next;
    });

    if (!file) {
      setImageFile(null);
      setPreviewUrl((prev) => {
        revokeIfBlob(prev);
        return initial?.imageUrl ?? null;
      });
      return;
    }

    if (!ACCEPTED_TYPES.has(file.type)) {
      setFieldErrors((prev) => ({
        ...prev,
        image: "Usa JPG, PNG, WEBP o GIF.",
      }));
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setFieldErrors((prev) => ({
        ...prev,
        image: "La imagen no puede superar 5 MB.",
      }));
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setImageFile(file);
    setPreviewUrl((prev) => {
      revokeIfBlob(prev);
      return nextUrl;
    });
  }

  function validate(): ProductFormSubmitPayload | null {
    const errors: Partial<Record<keyof ProductFormValues | "image", string>> =
      {};
    const name = values.name.trim();
    if (!name) errors.name = "El nombre es obligatorio.";
    else if (name.length > 100) errors.name = "Máximo 100 caracteres.";

    if (values.description.length > 500) {
      errors.description = "Máximo 500 caracteres.";
    }

    const price = parsePriceInput(values.price);
    if (price === null) {
      errors.price = "Ingresa un precio válido (≥ 0).";
    }

    if (
      !values.categoryId ||
      !categories.some((c) => c.id === values.categoryId)
    ) {
      errors.categoryId = "Selecciona una categoría.";
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || price === null) return null;

    return {
      name,
      description: values.description.trim() || null,
      price,
      categoryId: values.categoryId,
      imageFile,
      existingImageUrl: initial?.imageUrl ?? null,
      modifierGroups: toModifierGroupRequests(modifierGroups),
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = validate();
    if (!payload) return;
    await onSubmit(payload);
  }

  const submitLabel = submitting
    ? imageFile
      ? "Subiendo imagen y guardando platillo…"
      : "Guardando platillo…"
    : mode === "create"
      ? "Crear platillo"
      : "Guardar cambios";

  const focusRing =
    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

  const panelRef = useModalFocusTrap({
    open: true,
    onEscape: onClose,
    escapeEnabled: !submitting,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-card shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id={titleId} className="text-xl font-bold tracking-tight">
              {mode === "create" ? "Agregar platillo" : "Editar platillo"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Nombre, precio, categoría e imagen del menú digital.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={`rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50 ${focusRing}`}
          >
            Cerrar
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
          noValidate
          encType="multipart/form-data"
        >
          <Field
            label="Nombre"
            error={fieldErrors.name}
            htmlFor="product-name"
          >
            <input
              id="product-name"
              value={values.name}
              onChange={(e) => updateField("name", e.target.value)}
              maxLength={100}
              autoComplete="off"
              className={inputClass(Boolean(fieldErrors.name))}
              placeholder="Ej. Tacos al pastor"
            />
          </Field>

          <Field
            label="Descripción"
            error={fieldErrors.description}
            htmlFor="product-description"
          >
            <textarea
              id="product-description"
              value={values.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={3}
              maxLength={500}
              className={`${inputClass(Boolean(fieldErrors.description))} resize-none`}
              placeholder="Ingredientes o notas para el comensal"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Precio"
              error={fieldErrors.price}
              htmlFor="product-price"
            >
              <input
                id="product-price"
                inputMode="decimal"
                value={values.price}
                onChange={(e) => updateField("price", e.target.value)}
                className={inputClass(Boolean(fieldErrors.price))}
                placeholder="0.00"
              />
            </Field>

            <Field
              label="Categoría"
              error={fieldErrors.categoryId}
              htmlFor="product-category"
            >
              <select
                id="product-category"
                value={values.categoryId || ""}
                onChange={(e) =>
                  updateField("categoryId", Number(e.target.value))
                }
                className={inputClass(Boolean(fieldErrors.categoryId))}
              >
                {categories.length === 0 ? (
                  <option value="">Sin categorías</option>
                ) : (
                  categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))
                )}
              </select>
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              Imagen del platillo
            </span>
            <div className="overflow-hidden rounded-xl border border-dashed border-border bg-secondary">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Vista previa del platillo"
                  className="aspect-[16/10] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[16/10] items-center justify-center px-4 text-center text-sm text-muted-foreground">
                  Vista previa de la imagen
                </div>
              )}
            </div>
            <label
              htmlFor={fileInputId}
              className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold transition-colors hover:bg-secondary ${focusRing} ${
                submitting ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {imageFile ? "Cambiar imagen" : "Seleccionar imagen"}
            </label>
            <input
              id={fileInputId}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={submitting}
              onChange={(e) => handleFileChange(e.target.files)}
            />
            {imageFile ? (
              <p className="text-xs text-muted-foreground">
                {imageFile.name} · {(imageFile.size / 1024).toFixed(0)} KB
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Opcional. JPG, PNG, WEBP o GIF · máx. 5 MB
              </p>
            )}
            {fieldErrors.image ? (
              <span className="text-xs font-medium text-destructive">
                {fieldErrors.image}
              </span>
            ) : null}
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Opciones / extras</p>
                <p className="text-xs text-muted-foreground">
                  Tamaño, término, extras con costo adicional.
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() =>
                  setModifierGroups((prev) => [
                    ...prev,
                    {
                      name: "",
                      minSelect: "0",
                      maxSelect: "1",
                      options: [{ name: "", priceDelta: "0.00" }],
                    },
                  ])
                }
                className={`rounded-lg bg-card px-3 py-2 text-xs font-semibold ${focusRing}`}
              >
                + Grupo
              </button>
            </div>

            {modifierGroups.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin opciones. El comensal solo verá notas libres.
              </p>
            ) : (
              <ul className="space-y-3">
                {modifierGroups.map((group, gi) => (
                  <li
                    key={gi}
                    className="space-y-2 rounded-xl border border-border bg-card p-3"
                  >
                    <div className="flex items-start gap-2">
                      <input
                        value={group.name}
                        onChange={(e) =>
                          setModifierGroups((prev) =>
                            prev.map((g, i) =>
                              i === gi ? { ...g, name: e.target.value } : g,
                            ),
                          )
                        }
                        placeholder="Ej. Extras"
                        className={`${inputClass(false)} flex-1`}
                        disabled={submitting}
                      />
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          setModifierGroups((prev) =>
                            prev.filter((_, i) => i !== gi),
                          )
                        }
                        className={`rounded-lg px-2 py-2 text-xs font-semibold text-destructive ${focusRing}`}
                      >
                        Quitar
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-muted-foreground">
                        Mín.
                        <input
                          inputMode="numeric"
                          value={group.minSelect}
                          onChange={(e) =>
                            setModifierGroups((prev) =>
                              prev.map((g, i) =>
                                i === gi
                                  ? { ...g, minSelect: e.target.value }
                                  : g,
                              ),
                            )
                          }
                          className={`${inputClass(false)} mt-1`}
                          disabled={submitting}
                        />
                      </label>
                      <label className="text-xs text-muted-foreground">
                        Máx.
                        <input
                          inputMode="numeric"
                          value={group.maxSelect}
                          onChange={(e) =>
                            setModifierGroups((prev) =>
                              prev.map((g, i) =>
                                i === gi
                                  ? { ...g, maxSelect: e.target.value }
                                  : g,
                              ),
                            )
                          }
                          className={`${inputClass(false)} mt-1`}
                          disabled={submitting}
                        />
                      </label>
                    </div>
                    <ul className="space-y-2">
                      {group.options.map((opt, oi) => (
                        <li key={oi} className="flex gap-2">
                          <input
                            value={opt.name}
                            onChange={(e) =>
                              setModifierGroups((prev) =>
                                prev.map((g, i) =>
                                  i === gi
                                    ? {
                                        ...g,
                                        options: g.options.map((o, j) =>
                                          j === oi
                                            ? { ...o, name: e.target.value }
                                            : o,
                                        ),
                                      }
                                    : g,
                                ),
                              )
                            }
                            placeholder="Opción"
                            className={`${inputClass(false)} flex-1`}
                            disabled={submitting}
                          />
                          <input
                            inputMode="decimal"
                            value={opt.priceDelta}
                            onChange={(e) =>
                              setModifierGroups((prev) =>
                                prev.map((g, i) =>
                                  i === gi
                                    ? {
                                        ...g,
                                        options: g.options.map((o, j) =>
                                          j === oi
                                            ? {
                                                ...o,
                                                priceDelta: e.target.value,
                                              }
                                            : o,
                                        ),
                                      }
                                    : g,
                                ),
                              )
                            }
                            placeholder="+$"
                            className={`${inputClass(false)} w-24`}
                            disabled={submitting}
                            aria-label="Costo extra"
                          />
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() =>
                        setModifierGroups((prev) =>
                          prev.map((g, i) =>
                            i === gi
                              ? {
                                  ...g,
                                  options: [
                                    ...g.options,
                                    { name: "", priceDelta: "0.00" },
                                  ],
                                }
                              : g,
                          ),
                        )
                      }
                      className={`text-xs font-semibold text-foreground underline-offset-2 hover:underline ${focusRing}`}
                    >
                      + Opción
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50 ${focusRing}`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || categories.length === 0}
              className={`inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50 ${focusRing}`}
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5" htmlFor={htmlFor}>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
      {hint && !error ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
      {error ? (
        <span className="text-xs font-medium text-destructive">{error}</span>
      ) : null}
    </label>
  );
}

function inputClass(hasError: boolean): string {
  return `w-full rounded-xl border bg-secondary px-3.5 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 ${
    hasError ? "border-destructive" : "border-border"
  }`;
}
