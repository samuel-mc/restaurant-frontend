"use client";

/**
 * Fila de producto del menú del comensal (mobile-first).
 * Descripción larga: 2 líneas en móvil / 3 en sm+; tap para expandir.
 * «Agregar» abre sheet con notas opcionales; el stepper suma cantidad.
 */

import { useEffect, useId, useRef, useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import type { Product } from "@/types/api";
import { useCartStore, useProductQuantity } from "@/store/cartStore";
import { QuantityStepper } from "@/components/customer/quantity-stepper";
import { ProductAddSheet } from "@/components/customer/product-add-sheet";

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
    <div className="relative aspect-square size-[4.75rem] shrink-0 overflow-hidden rounded-xl bg-secondary ring-1 ring-[color-mix(in_srgb,var(--menu-accent)_20%,transparent)] sm:size-24">
      {showImage ? (
        // Host remoto arbitrario del tenant; evitamos forzar config de next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt={alt}
          width={96}
          height={96}
          sizes="96px"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex h-full w-full items-center justify-center text-muted-foreground/70"
        >
          <UtensilsCrossed className="size-5 stroke-[1.25]" />
        </div>
      )}
    </div>
  );
}

/**
 * Progressive disclosure en móvil: clamp hasta que el texto desborde;
 * «Ver más» / «Ver menos» con target táctil usable.
 */
function ProductDescription({
  text,
  productName,
}: {
  text: string;
  productName: string;
}) {
  const descId = useId();
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [text]);

  useEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;

    function measure() {
      if (!textRef.current) return;
      setCanExpand(
        textRef.current.scrollHeight > textRef.current.clientHeight + 1,
      );
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  const showToggle = canExpand || expanded;

  return (
    <div className="mt-0.5">
      <p
        id={descId}
        ref={textRef}
        className={`text-xs leading-relaxed text-muted-foreground ${
          expanded ? "" : "line-clamp-2 sm:line-clamp-3"
        }`}
      >
        {text}
      </p>
      {showToggle ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={descId}
          aria-label={
            expanded
              ? `Ver menos descripción de ${productName}`
              : `Ver más descripción de ${productName}`
          }
          onClick={() => setExpanded((open) => !open)}
          className={`${focusRing} -ml-1 -my-1.5 inline-flex min-h-11 items-center px-1 text-xs font-medium text-foreground underline underline-offset-2`}
        >
          {expanded ? "Ver menos" : "Ver más"}
        </button>
      ) : null}
    </div>
  );
}

export function ProductCard({
  product,
  orderingEnabled = true,
}: ProductCardProps) {
  const quantity = useProductQuantity(product.uuid);
  const addItem = useCartStore((state) => state.addItem);
  const decrementProduct = useCartStore((state) => state.decrementProduct);
  const hasModifiers = (product.modifierGroups?.length ?? 0) > 0;
  const unavailable = !product.isAvailable;
  const prevQuantityRef = useRef(quantity);
  const [stepperEnter, setStepperEnter] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  useEffect(() => {
    if (prevQuantityRef.current === 0 && quantity === 1) {
      setStepperEnter(true);
      const id = window.setTimeout(() => setStepperEnter(false), 240);
      prevQuantityRef.current = quantity;
      return () => window.clearTimeout(id);
    }
    prevQuantityRef.current = quantity;
  }, [quantity]);

  function handleConfirmAdd(
    notes: string | null,
    modifiers: import("@/store/cartStore").CartSelectedModifier[],
  ) {
    addItem(product, { notes, modifiers });
    setAddSheetOpen(false);
  }

  function handleIncrement() {
    if (hasModifiers) {
      setAddSheetOpen(true);
      return;
    }
    addItem(product);
  }

  return (
    <>
      <article
        data-testid={`menu-product-${product.uuid}`}
        className="flex gap-3 p-3.5"
      >        <div
          className={
            unavailable ? "opacity-55 grayscale-[0.35]" : undefined
          }
        >
          <ProductImage src={product.imageUrl} alt={product.name} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="min-w-0 line-clamp-2 text-sm font-semibold leading-snug tracking-tight break-words text-foreground"
              title={product.name}
            >
              {product.name}
            </h3>
            {unavailable ? (
              <span className="shrink-0 rounded-lg bg-secondary px-2 py-0.5 text-xs font-bold text-foreground">
                Agotado
              </span>
            ) : null}
          </div>

          {product.description ? (
            <ProductDescription
              text={product.description}
              productName={product.name}
            />
          ) : null}

          {hasModifiers ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Con opciones / extras
            </p>
          ) : null}

          <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
            <span className="text-base font-bold tabular-nums tracking-tight">
              {product.formattedPrice}
              {hasModifiers ? (
                <span className="text-xs font-medium text-muted-foreground">
                  {" "}
                  +
                </span>
              ) : null}
            </span>

            {!orderingEnabled ? null : unavailable ? (
              <button
                type="button"
                data-testid="menu-add-product"
                disabled
                className={`${focusRing} inline-flex min-h-11 items-center gap-1 rounded-xl bg-muted px-3.5 text-sm font-semibold text-muted-foreground opacity-60 cursor-not-allowed`}
              >
                Agregar
              </button>
            ) : quantity > 0 ? (
              <div className={stepperEnter ? "stepper-enter" : undefined}>
                <QuantityStepper
                  quantity={quantity}
                  label={product.name}
                  onIncrement={handleIncrement}
                  onDecrement={() => decrementProduct(product.uuid)}
                />
              </div>
            ) : (
              <button
                type="button"
                data-testid="menu-add-product"
                onClick={() => setAddSheetOpen(true)}
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

      <ProductAddSheet
        product={product}
        open={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onConfirm={handleConfirmAdd}
      />
    </>
  );
}
