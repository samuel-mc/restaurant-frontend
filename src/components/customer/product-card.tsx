"use client";

/**
 * Tarjeta de producto del menú del comensal (mobile-first).
 * Imagen con placeholder si falta o falla la carga, descripción corta,
 * precio formateado y CTA "+ Agregar" o stepper (+ / −) si ya está en el carrito.
 */

import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import type { Product } from "@/types/api";
import { useCartStore, useProductQuantity } from "@/store/cartStore";
import { QuantityStepper } from "@/components/customer/quantity-stepper";

interface ProductCardProps {
  product: Product;
}

function ProductImage({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-linear-to-br from-amber-100 to-orange-100 dark:from-neutral-800 dark:to-neutral-700">
      {showImage ? (
        // Host remoto arbitrario del tenant; evitamos forzar config de next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex h-full w-full flex-col items-center justify-center gap-1 text-amber-700/60 dark:text-amber-300/60"
        >
          <UtensilsCrossed className="size-6 stroke-[1.5]" />
          <span className="text-[9px] font-medium uppercase tracking-wider">
            Sin foto
          </span>
        </div>
      )}
    </div>
  );
}

export function ProductCard({ product }: ProductCardProps) {
  const quantity = useProductQuantity(product.uuid);
  const addItem = useCartStore((state) => state.addItem);
  const decrementItem = useCartStore((state) => state.decrementItem);
  const unavailable = !product.isAvailable;

  return (
    <article
      className={`flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5 transition-opacity dark:bg-neutral-900 dark:ring-white/10 ${
        unavailable ? "opacity-60" : ""
      }`}
    >
      <ProductImage src={product.imageUrl} alt={product.name} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-semibold leading-snug">
            {product.name}
          </h3>
          {unavailable ? (
            <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black/50 dark:bg-white/10 dark:text-white/50">
              Agotado
            </span>
          ) : null}
        </div>

        {product.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-black/50 dark:text-white/50">
            {product.description}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {product.formattedPrice}
          </span>

          {unavailable ? null : quantity > 0 ? (
            <QuantityStepper
              quantity={quantity}
              label={product.name}
              onIncrement={() => addItem(product)}
              onDecrement={() => decrementItem(product.uuid)}
            />
          ) : (
            <button
              type="button"
              onClick={() => addItem(product)}
              className="flex items-center gap-1 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-amber-500/20 transition-transform active:scale-95"
            >
              <span className="text-base leading-none" aria-hidden>
                +
              </span>
              Agregar
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
