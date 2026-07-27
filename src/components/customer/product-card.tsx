"use client";

/**
 * Fila de producto del menú del comensal (mobile-first).
 * Imagen con placeholder si falta, descripción corta, precio y CTA / stepper.
 */

import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import type { Product } from "@/types/api";
import { useCartStore, useProductQuantity } from "@/store/cartStore";
import { QuantityStepper } from "@/components/customer/quantity-stepper";

interface ProductCardProps {
  product: Product;
  /** Si es false, se ocultan CTAs de carrito (solo consulta). */
  orderingEnabled?: boolean;
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

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
    <div className="relative size-[4.75rem] shrink-0 overflow-hidden rounded-xl bg-secondary sm:size-24">
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
          className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-muted-foreground"
        >
          <UtensilsCrossed className="size-5 stroke-[1.5]" />
          <span className="text-xs font-semibold tracking-wide">Sin foto</span>
        </div>
      )}
    </div>
  );
}

export function ProductCard({
  product,
  orderingEnabled = true,
}: ProductCardProps) {
  const quantity = useProductQuantity(product.uuid);
  const addItem = useCartStore((state) => state.addItem);
  const decrementItem = useCartStore((state) => state.decrementItem);
  const unavailable = !product.isAvailable;

  return (
    <article
      className={`flex gap-3 p-3.5 transition-opacity ${
        unavailable ? "opacity-55" : ""
      }`}
    >
      <ProductImage src={product.imageUrl} alt={product.name} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug tracking-tight">
            {product.name}
          </h3>
          {unavailable ? (
            <span className="shrink-0 rounded-lg bg-secondary px-2 py-0.5 text-xs font-bold text-muted-foreground">
              Agotado
            </span>
          ) : null}
        </div>

        {product.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {product.description}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
          <span className="text-base font-bold tabular-nums tracking-tight">
            {product.formattedPrice}
          </span>

          {!orderingEnabled || unavailable ? null : quantity > 0 ? (
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
              className={`${focusRing} inline-flex min-h-11 items-center gap-1 rounded-xl bg-[var(--menu-accent)] px-3.5 text-sm font-semibold text-[var(--menu-accent-fg)] transition-transform active:scale-[0.97]`}
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
