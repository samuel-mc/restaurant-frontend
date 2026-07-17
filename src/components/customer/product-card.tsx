"use client";

/**
 * Tarjeta de producto del menú del comensal (mobile-first).
 * Muestra imagen, nombre, descripción corta y precio; permite agregar al
 * carrito y ajustar la cantidad si el producto ya fue seleccionado.
 */

import type { Product } from "@/types/api";
import {
  useCartStore,
  useProductQuantity,
} from "@/store/cartStore";
import { QuantityStepper } from "@/components/customer/quantity-stepper";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const quantity = useProductQuantity(product.uuid);
  const addItem = useCartStore((state) => state.addItem);
  const decrementItem = useCartStore((state) => state.decrementItem);

  return (
    <article className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-amber-100 dark:bg-neutral-800">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- host remoto arbitrario del tenant; evitamos config de next/image
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">
            🍽️
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="truncate text-sm font-semibold">{product.name}</h3>
        {product.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-black/50 dark:text-white/50">
            {product.description}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-base font-bold text-amber-600 dark:text-amber-400">
            {product.formattedPrice}
          </span>

          {quantity > 0 ? (
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
              className="flex items-center gap-1 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform active:scale-95"
            >
              <span className="text-base leading-none">+</span> Agregar
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
