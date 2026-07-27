"use client";

/**
 * Vista interactiva del menú: categorías, carrito, anclaje de mesa (?m=) y sesión activa.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Order, Product } from "@/types/api";
import {
  CategoryBar,
  type CategoryTab,
} from "@/components/customer/category-bar";
import { ProductCard } from "@/components/customer/product-card";
import { CartBar, type OrderModules } from "@/components/customer/cart-bar";
import {
  useCartCount,
  useCartStore,
} from "@/store/cartStore";
import { getActiveOrderSession } from "@/services/orderService";
import {
  clearStoredTable,
  formatTableLabel,
  normalizeTableParam,
  writeStoredTable,
} from "@/lib/table-session";
import { formatCurrency } from "@/lib/format";

interface MenuSection {
  id: string;
  name: string;
  products: Product[];
}

interface MenuViewProps {
  products: Product[];
  tenantSlug: string;
  modules?: OrderModules;
  orderingEnabled?: boolean;
  /** Valor de ?m= desde la URL (Server Component). */
  tableFromQuery?: string | null;
}

export function MenuView({
  products,
  tenantSlug,
  modules,
  orderingEnabled = true,
  tableFromQuery = null,
}: MenuViewProps) {
  const router = useRouter();
  const sections = useMemo<MenuSection[]>(() => {
    const byCategory = new Map<string, MenuSection>();
    for (const product of products) {
      const id = String(product.categoryId);
      const existing = byCategory.get(id);
      if (existing) {
        existing.products.push(product);
      } else {
        byCategory.set(id, {
          id,
          name: product.categoryName,
          products: [product],
        });
      }
    }
    return Array.from(byCategory.values());
  }, [products]);

  const categories = useMemo<CategoryTab[]>(
    () => sections.map(({ id, name }) => ({ id, name })),
    [sections],
  );

  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");
  const scrollingToRef = useRef<string | null>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  const [tableLockedFromQr, setTableLockedFromQr] = useState(false);
  const [isEditingTable, setIsEditingTable] = useState(false);
  const [draftTable, setDraftTable] = useState("");
  const [tableEditError, setTableEditError] = useState<string | null>(null);
  /** Mesa pendiente de confirmación cuando hay cuenta abierta. */
  const [pendingTableChange, setPendingTableChange] = useState<string | null>(
    null,
  );
  const [sessionOrder, setSessionOrder] = useState<Order | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionRetryKey, setSessionRetryKey] = useState(0);

  const setActiveOrderSession = useCartStore((s) => s.setActiveOrderSession);
  const clearActiveOrderSession = useCartStore((s) => s.clearActiveOrderSession);
  const releaseActiveOrder = useCartStore((s) => s.releaseActiveOrder);
  const setCartTable = useCartStore((s) => s.setTableNumber);
  const cartTable = useCartStore((s) => s.tableNumber);
  const activeOrderId = useCartStore((s) => s.activeOrderId);
  const cartCount = useCartCount();
  const hasOpenAccount = Boolean(sessionOrder) || Boolean(activeOrderId);

  // Anclaje de mesa: solo con ?m= en la URL.
  // Sin ?m= → exploración / pickup (no heredar mesa de localStorage).
  useEffect(() => {
    const fromQuery = normalizeTableParam(tableFromQuery);
    if (fromQuery) {
      writeStoredTable(tenantSlug, fromQuery);
      setTableLockedFromQr(true);
      setCartTable(fromQuery);
      setIsEditingTable(false);
      setTableEditError(null);
      setPendingTableChange(null);
      return;
    }

    clearStoredTable(tenantSlug);
    setTableLockedFromQr(false);
    setCartTable(null);
    setIsEditingTable(false);
    setTableEditError(null);
    setPendingTableChange(null);
    releaseActiveOrder();
    setSessionOrder(null);
  }, [
    tableFromQuery,
    tenantSlug,
    setCartTable,
    releaseActiveOrder,
  ]);

  // Consulta sesión activa de la mesa
  useEffect(() => {
    const table = cartTable?.trim();
    if (!orderingEnabled || !table || isEditingTable) {
      if (!table) {
        setSessionOrder(null);
        setSessionError(null);
      }
      return;
    }

    const controller = new AbortController();
    setSessionLoading(true);
    setSessionError(null);

    void (async () => {
      try {
        const session = await getActiveOrderSession(table, tenantSlug, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (session.hasActiveOrder && session.order) {
          setSessionOrder(session.order);
          setActiveOrderSession({
            activeOrderId: session.order.uuid,
            tableNumber: session.order.tableNumber ?? table,
            customerName: session.order.customerName,
          });
        } else {
          setSessionOrder(null);
          releaseActiveOrder();
          setCartTable(table);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSessionOrder(null);
        setSessionError(
          "No pudimos ver la cuenta de la mesa. Puedes seguir pidiendo.",
        );
      } finally {
        if (!controller.signal.aborted) setSessionLoading(false);
      }
    })();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reconsultar al cambiar mesa
  }, [cartTable, tenantSlug, orderingEnabled, isEditingTable, sessionRetryKey]);

  useEffect(() => {
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingToRef.current) return;

        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top,
          );

        const top = visible[0];
        if (top?.target.id) {
          setActiveId(top.target.id.replace(/^cat-/, ""));
        }
      },
      {
        rootMargin: "-72px 0px -55% 0px",
        threshold: [0, 0.25, 0.5],
      },
    );

    for (const section of sections) {
      const el = sectionRefs.current.get(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sections]);

  function handleSelectCategory(id: string) {
    setActiveId(id);
    scrollingToRef.current = id;
    const el = sectionRefs.current.get(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      if (scrollingToRef.current === id) scrollingToRef.current = null;
    }, 600);
  }

  /** Corregir número de mesa (solo con ítems en carrito → sheet). */
  function handleChangeTable() {
    setDraftTable(cartTable ?? normalizeTableParam(tableFromQuery) ?? "");
    setTableEditError(null);
    setPendingTableChange(null);
    setIsEditingTable(true);
  }

  /** Salir del QR con carrito vacío (no edita número; vuelve a explorar / pickup). */
  function handleLeaveWrongTable() {
    clearStoredTable(tenantSlug);
    clearActiveOrderSession();
    setSessionOrder(null);
    setSessionError(null);
    setCartTable(null);
    setTableLockedFromQr(false);
    setIsEditingTable(false);
    setPendingTableChange(null);
    router.replace("/menu");
  }

  function handleCancelTableEdit() {
    setIsEditingTable(false);
    setTableEditError(null);
    setDraftTable("");
    setPendingTableChange(null);
  }

  function applyTableChange(next: string) {
    clearActiveOrderSession();
    setSessionOrder(null);
    setSessionError(null);
    writeStoredTable(tenantSlug, next);
    setCartTable(next);
    setTableLockedFromQr(true);
    setIsEditingTable(false);
    setPendingTableChange(null);
    setTableEditError(null);
    router.replace(`/menu?m=${encodeURIComponent(next)}`);
  }

  function handleConfirmTableEdit() {
    if (pendingTableChange) {
      applyTableChange(pendingTableChange);
      return;
    }

    const next = normalizeTableParam(draftTable);
    if (!next) {
      setTableEditError("Escribe el número de mesa.");
      return;
    }

    const current = normalizeTableParam(cartTable ?? tableFromQuery);
    if (current && current === next) {
      setIsEditingTable(false);
      setTableEditError(null);
      setPendingTableChange(null);
      return;
    }

    // Con cuenta abierta: pedir confirmación antes de desligar.
    if (hasOpenAccount) {
      setPendingTableChange(next);
      setTableEditError(null);
      return;
    }

    applyTableChange(next);
  }

  function handleCancelPendingTableChange() {
    setPendingTableChange(null);
  }

  return (
    <>
      {orderingEnabled ? (
        <MenuContextStrip
          tableLockedFromQr={tableLockedFromQr}
          tableNumber={cartTable}
          cartCount={cartCount}
          sessionLoading={sessionLoading}
          sessionOrder={sessionOrder}
          sessionError={sessionError}
          onLeaveWrongTable={handleLeaveWrongTable}
          onRetrySession={() => {
            setSessionError(null);
            setSessionRetryKey((key) => key + 1);
          }}
        />
      ) : null}

      <CategoryBar
        categories={categories}
        activeId={activeId}
        onSelect={handleSelectCategory}
      />

      <div
        aria-label="Platillos del menú"
        className="flex flex-col gap-8 pb-32 pt-4"
      >
        {sections.map((section) => (
          <section
            key={section.id}
            id={`cat-${section.id}`}
            ref={(node) => {
              if (node) sectionRefs.current.set(section.id, node);
              else sectionRefs.current.delete(section.id);
            }}
            className="scroll-mt-16"
            aria-labelledby={`heading-${section.id}`}
          >
            <h2
              id={`heading-${section.id}`}
              className="mb-2.5 text-sm font-semibold tracking-tight text-muted-foreground"
            >
              {section.name}
            </h2>
            <ul className="divide-y divide-border/80 overflow-hidden rounded-xl border border-border/80 bg-card">
              {section.products.map((product) => (
                <li key={product.uuid}>
                  <ProductCard
                    product={product}
                    orderingEnabled={orderingEnabled}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {orderingEnabled ? (
        <CartBar
          tenantSlug={tenantSlug}
          modules={modules}
          tableLockedFromQr={tableLockedFromQr}
          isEditingTable={isEditingTable}
          draftTable={draftTable}
          tableEditError={tableEditError}
          pendingTableChange={pendingTableChange}
          onDraftTableChange={setDraftTable}
          onChangeTable={handleChangeTable}
          onConfirmTableEdit={handleConfirmTableEdit}
          onCancelTableEdit={handleCancelTableEdit}
          onCancelPendingTableChange={handleCancelPendingTableChange}
        />
      ) : (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 text-center backdrop-blur-sm">
          <p className="text-xs font-medium text-muted-foreground">
            Solo consulta · pedidos desactivados
          </p>
        </div>
      )}
    </>
  );
}

/**
 * Una sola franja de contexto (mesa / sesión / error).
 * Sin mesa QR: no se muestra — el modo vive en el carrito.
 */
function MenuContextStrip({
  tableLockedFromQr,
  tableNumber,
  cartCount,
  sessionLoading,
  sessionOrder,
  sessionError,
  onLeaveWrongTable,
  onRetrySession,
}: {
  tableLockedFromQr: boolean;
  tableNumber: string | null;
  cartCount: number;
  sessionLoading: boolean;
  sessionOrder: Order | null;
  sessionError: string | null;
  onLeaveWrongTable: () => void;
  onRetrySession: () => void;
}) {
  const shell =
    "-mx-4 border-b border-border/70 px-4 py-2 text-xs leading-snug text-muted-foreground";

  if (sessionLoading && !sessionOrder) {
    return (
      <div role="status" className={shell}>
        Consultando la cuenta…
      </div>
    );
  }

  if (sessionOrder && tableNumber) {
    return (
      <div
        role="status"
        className={`${shell} flex items-center justify-between gap-3`}
      >
        <p className="min-w-0 truncate">
          <span className="font-medium text-foreground">
            {formatTableLabel(tableNumber)}
          </span>
          {" · cuenta abierta · "}
          {sessionOrder.formattedTotal ||
            formatCurrency(sessionOrder.totalAmount)}
        </p>
        <Link
          href={`/orders/${sessionOrder.uuid}`}
          className="inline-flex min-h-11 shrink-0 items-center font-medium text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver pedido
        </Link>
      </div>
    );
  }

  if (sessionError && tableLockedFromQr) {
    return (
      <div
        role="status"
        className={`${shell} flex items-center justify-between gap-3`}
      >
        <p className="min-w-0 truncate text-foreground/80">{sessionError}</p>
        <button
          type="button"
          onClick={onRetrySession}
          className="inline-flex min-h-11 shrink-0 items-center font-medium text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (tableLockedFromQr && tableNumber) {
    return (
      <div
        role="status"
        className={`${shell} flex items-center justify-between gap-3`}
      >
        <p className="min-w-0">
          <span className="font-medium text-foreground">
            {formatTableLabel(tableNumber)}
          </span>
          <span> · pedís aquí</span>
        </p>
        {cartCount === 0 ? (
          <button
            type="button"
            onClick={onLeaveWrongTable}
            className="inline-flex min-h-11 shrink-0 items-center font-medium underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ¿No es tu mesa?
          </button>
        ) : null}
      </div>
    );
  }

  return null;
}
