"use client";

/**
 * Modal de alta/edición de platillo con validación de formulario.
 */

import { useId, useState, type FormEvent, type ReactNode } from "react";
import type { Category, Product, ProductRequest } from "@/types/api";

export interface ProductFormValues {
  name: string;
  description: string;
  /** Precisión decimal como string (evita drift de float en el input). */
  price: string;
  categoryId: number;
  imageUrl: string;
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
  onSubmit: (payload: ProductRequest) => Promise<void>;
}

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
      imageUrl: "",
    };
  }

  return {
    name: product.name,
    description: product.description ?? "",
    price: Number.isFinite(product.price) ? product.price.toFixed(2) : "",
    categoryId: product.categoryId,
    imageUrl: product.imageUrl ?? "",
  };
}

function parsePriceInput(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
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
  const [values, setValues] = useState<ProductFormValues>(() =>
    productToValues(initial, defaultCategoryId, categories),
  );
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ProductFormValues, string>>
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

  function validate(): ProductRequest | null {
    const errors: Partial<Record<keyof ProductFormValues, string>> = {};
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

    const imageUrl = values.imageUrl.trim();
    if (imageUrl) {
      try {
        void new URL(imageUrl);
      } catch {
        errors.imageUrl = "URL de imagen inválida.";
      }
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || price === null) return null;

    return {
      name,
      description: values.description.trim() || null,
      price,
      imageUrl: imageUrl || null,
      categoryId: values.categoryId,
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = validate();
    if (!payload) return;
    await onSubmit(payload);
  }

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
            label="Descripción corta"
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

          <Field
            label="URL de imagen"
            error={fieldErrors.imageUrl}
            htmlFor="product-image"
            hint="Opcional. Usa una URL pública (https://…)."
          >
            <input
              id="product-image"
              value={values.imageUrl}
              onChange={(e) => updateField("imageUrl", e.target.value)}
              className={inputClass(Boolean(fieldErrors.imageUrl))}
              placeholder="https://…"
            />
          </Field>

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
              {submitting
                ? "Guardando…"
                : mode === "create"
                  ? "Crear platillo"
                  : "Guardar cambios"}
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
