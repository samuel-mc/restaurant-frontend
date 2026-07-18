"use client";

/**
 * Modal de alta/edición de platillo con carga de imagen (FormData / R2-ready).
 */

import { useId, useState, type FormEvent, type ReactNode } from "react";
import type { Category, Product } from "@/types/api";
import type { ProductFormSubmitPayload } from "@/services/adminCatalogService";

export interface ProductFormValues {
  name: string;
  description: string;
  /** Precisión decimal como string (evita drift de float en el input). */
  price: string;
  categoryId: number;
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl dark:bg-neutral-900"
      >
        <header className="flex items-start justify-between gap-3 border-b border-black/5 px-5 py-4 dark:border-white/10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-black/45 dark:text-white/45">
              Catálogo
            </p>
            <h2 id={titleId} className="text-xl font-extrabold tracking-tight">
              {mode === "create" ? "Agregar platillo" : "Editar platillo"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-black/50 hover:bg-black/5 disabled:opacity-50 dark:text-white/50 dark:hover:bg-white/10"
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
            <span className="text-xs font-bold uppercase tracking-wide text-black/50 dark:text-white/50">
              Imagen del platillo
            </span>
            <div className="overflow-hidden rounded-2xl border border-dashed border-black/15 bg-neutral-50 dark:border-white/15 dark:bg-neutral-800/60">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Vista previa del platillo"
                  className="aspect-[16/10] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[16/10] items-center justify-center px-4 text-center text-sm text-black/40 dark:text-white/40">
                  Vista previa de la imagen
                </div>
              )}
            </div>
            <label
              htmlFor={fileInputId}
              className={`inline-flex cursor-pointer items-center justify-center rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm font-bold hover:bg-black/[0.03] dark:border-white/15 dark:bg-neutral-900 dark:hover:bg-white/5 ${
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
              <p className="text-xs text-black/45 dark:text-white/45">
                {imageFile.name} · {(imageFile.size / 1024).toFixed(0)} KB
              </p>
            ) : (
              <p className="text-xs text-black/40 dark:text-white/40">
                Opcional. JPG, PNG, WEBP o GIF · máx. 5 MB
              </p>
            )}
            {fieldErrors.image ? (
              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                {fieldErrors.image}
              </span>
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-300"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-2xl px-4 py-2.5 text-sm font-bold text-black/60 hover:bg-black/5 disabled:opacity-50 dark:text-white/60 dark:hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || categories.length === 0}
              className="inline-flex items-center justify-center rounded-2xl bg-foreground px-5 py-2.5 text-sm font-bold text-background disabled:opacity-50"
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
      <span className="text-xs font-bold uppercase tracking-wide text-black/50 dark:text-white/50">
        {label}
      </span>
      {children}
      {hint && !error ? (
        <span className="text-xs text-black/40 dark:text-white/40">{hint}</span>
      ) : null}
      {error ? (
        <span className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function inputClass(hasError: boolean): string {
  return `w-full rounded-2xl border bg-neutral-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-foreground focus:ring-2 focus:ring-foreground/10 dark:bg-neutral-800 ${
    hasError ? "border-red-400" : "border-black/10 dark:border-white/15"
  }`;
}
