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
import { useCartStore } from "@/store/cartStore";
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
  const [sessionOrder, setSessionOrder] = useState<Order | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  const setActiveOrderSession = useCartStore((s) => s.setActiveOrderSession);
  const clearActiveOrderSession = useCartStore((s) => s.clearActiveOrderSession);
  const releaseActiveOrder = useCartStore((s) => s.releaseActiveOrder);
  const setCartTable = useCartStore((s) => s.setTableNumber);
  const cartTable = useCartStore((s) => s.tableNumber);

  // Anclaje de mesa: solo con ?m= en la URL.
  // Sin ?m= → exploración / pickup (no heredar mesa de localStorage).
  useEffect(() => {
    const fromQuery = normalizeTableParam(tableFromQuery);
    if (fromQuery) {
      writeStoredTable(tenantSlug, fromQuery);
      setTableLockedFromQr(true);
      setCartTable(fromQuery);
      return;
    }

    clearStoredTable(tenantSlug);
    setTableLockedFromQr(false);
    setCartTable(null);
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
    if (!orderingEnabled || !table) {
      setSessionOrder(null);
      return;
    }

    let cancelled = false;
    setSessionLoading(true);

    void (async () => {
      try {
        const session = await getActiveOrderSession(table, tenantSlug);
        if (cancelled) return;
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
      } catch {
        if (!cancelled) setSessionOrder(null);
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reconsultar al cambiar mesa
  }, [cartTable, tenantSlug, orderingEnabled]);

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

  function handleChangeTable() {
    clearStoredTable(tenantSlug);
    setTableLockedFromQr(false);
    clearActiveOrderSession();
    setSessionOrder(null);
    setCartTable(null);
    // Quitar ?m= para pasar a exploración / pickup.
    router.replace("/menu");
  }

  return (
    <>
      {orderingEnabled && (sessionOrder || sessionLoading) ? (
        <ActiveSessionBanner
          loading={sessionLoading}
          order={sessionOrder}
          tableNumber={cartTable}
        />
      ) : null}

      <CategoryBar
        categories={categories}
        activeId={activeId}
        onSelect={handleSelectCategory}
      />

      <div
        aria-label="Platillos del menú"
        className="flex flex-col gap-9 pb-32 pt-5"
      >
        {sections.map((section) => (
          <section
            key={section.id}
            id={`cat-${section.id}`}
            ref={(node) => {
              if (node) sectionRefs.current.set(section.id, node);
              else sectionRefs.current.delete(section.id);
            }}
            className="scroll-mt-24"
            aria-labelledby={`heading-${section.id}`}
          >
            <h2
              id={`heading-${section.id}`}
              className="mb-3 text-base font-bold tracking-tight text-foreground"
            >
              {section.name}
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
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
          onChangeTable={handleChangeTable}
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

function ActiveSessionBanner({
  loading,
  order,
  tableNumber,
}: {
  loading: boolean;
  order: Order | null;
  tableNumber: string | null;
}) {
  if (loading && !order) {
    return (
      <div className="sticky top-0 z-20 -mx-4 mb-1 border-b border-live/20 bg-live-muted px-4 py-2.5 text-center text-xs font-medium text-live-ink">
        Consultando cuenta de la mesa…
      </div>
    );
  }
  if (!order || !tableNumber) return null;

  return (
    <div className="sticky top-0 z-20 -mx-4 mb-1 flex flex-wrap items-center justify-between gap-2 border-b border-live/25 bg-live-muted px-4 py-2.5 text-live-ink">
      <p className="min-w-0 text-xs font-semibold leading-snug">
        {formatTableLabel(tableNumber)} · cuenta abierta ·{" "}
        {order.formattedTotal || formatCurrency(order.totalAmount)}
      </p>
      <Link
        href={`/orders/${order.uuid}`}
        className="inline-flex min-h-9 shrink-0 items-center rounded-xl bg-foreground px-3 text-xs font-bold text-background transition-opacity hover:opacity-90"
      >
        Ver ticket
      </Link>
    </div>
  );
}
