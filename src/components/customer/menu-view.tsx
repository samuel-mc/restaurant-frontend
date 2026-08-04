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
import { TableHelpFab } from "@/components/customer/table-help-fab";
import {
  subscribeCartHydration,
  useCartCount,
  useCartStore,
} from "@/store/cartStore";
import { getActiveOrderSession } from "@/services/orderService";
import { useMenuAvailabilitySubscription } from "@/hooks/useMenuAvailabilitySubscription";

import {
  clearStoredTable,
  formatTableLabel,
  normalizeTableParam,
  normalizeTableToken,
  writeStoredTableSession,
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
  /** Valor de ?t= (token firmado del QR). */
  tableTokenFromQuery?: string | null;
}

export function MenuView({
  products,
  tenantSlug,
  modules,
  orderingEnabled = true,
  tableFromQuery = null,
  tableTokenFromQuery = null,
}: MenuViewProps) {
  const router = useRouter();
  const [menuProducts, setMenuProducts] = useState<Product[]>(products);

  useEffect(() => {
    setMenuProducts(products);
  }, [products]);

  useMenuAvailabilitySubscription({
    tenantSlug,
    onAvailabilityChange: (evt) => {
      setMenuProducts((prev) =>
        prev.map((p) =>
          p.uuid === evt.productId ? { ...p, isAvailable: evt.isAvailable } : p,
        ),
      );
    },
  });

  const sections = useMemo<MenuSection[]>(() => {
    const byCategory = new Map<string, MenuSection>();
    for (const product of menuProducts) {
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
  }, [menuProducts]);

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
  /** Mesa pendiente de confirmación cuando hay pedido de la mesa. */
  const [pendingTableChange, setPendingTableChange] = useState<string | null>(
    null,
  );
  const [sessionOrder, setSessionOrder] = useState<Order | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionRetryKey, setSessionRetryKey] = useState(0);
  const [tenantSwitchNotice, setTenantSwitchNotice] = useState(false);
  const [qrRecoveryNotice, setQrRecoveryNotice] = useState(false);
  // false hasta useEffect: no llamar persist.hasHydrated en el primer render (SSR).
  const [cartHydrated, setCartHydrated] = useState(false);

  const ensureTenant = useCartStore((s) => s.ensureTenant);
  const setActiveOrderSession = useCartStore((s) => s.setActiveOrderSession);
  const clearActiveOrderSession = useCartStore((s) => s.clearActiveOrderSession);
  const releaseActiveOrder = useCartStore((s) => s.releaseActiveOrder);
  const setTableAnchor = useCartStore((s) => s.setTableAnchor);
  const cartTable = useCartStore((s) => s.tableNumber);
  const cartTableToken = useCartStore((s) => s.tableToken);
  const activeOrderId = useCartStore((s) => s.activeOrderId);
  const cartCount = useCartCount();
  const hasOpenAccount = Boolean(sessionOrder) || Boolean(activeOrderId);

  useEffect(() => subscribeCartHydration(() => setCartHydrated(true)), []);

  // Aislar carrito por tenant (evita enviar platillos de otro local).
  useEffect(() => {
    if (!cartHydrated) return;
    const cleared = ensureTenant(tenantSlug);
    if (cleared) {
      setTenantSwitchNotice(true);
      setSessionOrder(null);
      setSessionError(null);
      setTableLockedFromQr(false);
      setIsEditingTable(false);
      setPendingTableChange(null);
    }
  }, [cartHydrated, tenantSlug, ensureTenant]);

  // Anclaje de mesa: solo con ?m= + ?t= válidos en la URL (QR firmado).
  // Sin token → exploración / pickup (no heredar mesa adivinable).
  useEffect(() => {
    const fromQuery = normalizeTableParam(tableFromQuery);
    const tokenFromQuery = normalizeTableToken(tableTokenFromQuery);
    if (fromQuery && tokenFromQuery) {
      writeStoredTableSession(tenantSlug, fromQuery, tokenFromQuery);
      setTableLockedFromQr(true);
      setTableAnchor(fromQuery, tokenFromQuery);
      setIsEditingTable(false);
      setTableEditError(null);
      setPendingTableChange(null);
      setQrRecoveryNotice(false);
      return;
    }

    clearStoredTable(tenantSlug);
    setTableLockedFromQr(false);
    setTableAnchor(null, null);
    setIsEditingTable(false);
    setTableEditError(null);
    setPendingTableChange(null);
    releaseActiveOrder();
    setSessionOrder(null);

    // ?m= sin ?t=: QR viejo o enlace incompleto.
    if (fromQuery && !tokenFromQuery) {
      setSessionError(
        "Este código QR es incompleto o antiguo. Pide al mesero el QR actualizado de tu mesa.",
      );
    }
  }, [
    tableFromQuery,
    tableTokenFromQuery,
    tenantSlug,
    setTableAnchor,
    releaseActiveOrder,
  ]);

  // Consulta sesión activa de la mesa (solo con token del QR).
  useEffect(() => {
    if (!cartHydrated) return;
    const table = cartTable?.trim();
    const token = cartTableToken?.trim();
    if (!orderingEnabled || !table || !token || isEditingTable) {
      if (!table || !token) {
        setSessionOrder(null);
        if (!table) setSessionError(null);
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
          tableToken: token,
        });
        if (controller.signal.aborted) return;
        if (session.hasActiveOrder && session.order) {
          setSessionOrder(session.order);
          // No auto-unir: el comensal confirma «Sumarme» (clarify ownership).
          const alreadyJoined =
            useCartStore.getState().activeOrderId === session.order.uuid;
          if (!alreadyJoined) {
            releaseActiveOrder();
            setTableAnchor(session.order.tableNumber ?? table, token);
          }
        } else {
          setSessionOrder(null);
          releaseActiveOrder();
          setTableAnchor(table, token);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSessionOrder(null);
        setSessionError(
          "No pudimos ver el pedido de la mesa. Puedes seguir pidiendo.",
        );
      } finally {
        if (!controller.signal.aborted) setSessionLoading(false);
      }
    })();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reconsultar al cambiar mesa/token
  }, [
    cartHydrated,
    cartTable,
    cartTableToken,
    tenantSlug,
    orderingEnabled,
    isEditingTable,
    sessionRetryKey,
  ]);

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

  /** Corregir mesa: salir del QR y escanear el correcto. */
  function handleChangeTable() {
    handleLeaveWrongTable();
  }

  /** Salir del QR (libera ?m=&t=); conserva platillos del carrito. */
  function handleLeaveWrongTable() {
    clearStoredTable(tenantSlug);
    clearActiveOrderSession();
    setSessionOrder(null);
    setSessionError(null);
    setTableAnchor(null, null);
    setTableLockedFromQr(false);
    setIsEditingTable(false);
    setPendingTableChange(null);
    setQrRecoveryNotice(true);
    router.replace("/menu");
  }

  function handleCancelTableEdit() {
    setIsEditingTable(false);
    setTableEditError(null);
    setDraftTable("");
    setPendingTableChange(null);
  }

  function handleConfirmTableEdit() {
    handleLeaveWrongTable();
  }

  function handleCancelPendingTableChange() {
    setPendingTableChange(null);
  }

  function handleJoinSharedOrder() {
    if (!sessionOrder) return;
    const table =
      sessionOrder.tableNumber?.trim() ||
      cartTable?.trim() ||
      normalizeTableParam(tableFromQuery) ||
      "";
    setActiveOrderSession({
      activeOrderId: sessionOrder.uuid,
      tableNumber: table,
      customerName: sessionOrder.customerName,
      tableToken: cartTableToken,
    });
  }

  /** Deshacer Sumarme sin salir del QR (vuelve al gate de join). */
  function handleUnjoinSharedOrder() {
    releaseActiveOrder();
  }

  const joinedSharedOrder =
    Boolean(sessionOrder) && activeOrderId === sessionOrder?.uuid;
  const pendingSharedJoin =
    Boolean(sessionOrder) && !joinedSharedOrder && tableLockedFromQr;

  const exploreOrdersUnavailable =
    !tableLockedFromQr &&
    Boolean(modules) &&
    !modules?.hasPickup &&
    !modules?.hasDelivery;
  /** Sin QR ni canales: solo consulta (no Agregar). */
  const canAddToCart = orderingEnabled && !exploreOrdersUnavailable;
  const showCartBar =
    orderingEnabled && (!exploreOrdersUnavailable || cartCount > 0);
  const listBottomPad = showCartBar
    ? "pb-32"
    : !orderingEnabled || exploreOrdersUnavailable
      ? "pb-20"
      : "pb-8";

  const noticeShell =
    "-mx-4 mb-2 border-b border-[color-mix(in_srgb,var(--menu-accent)_16%,var(--border))] bg-[var(--menu-accent-muted)] px-4 py-2 text-xs leading-snug text-muted-foreground";
  const noticeAction =
    "inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <>
      {tenantSwitchNotice ? (
        <div
          role="status"
          className={`${noticeShell} flex items-center justify-between gap-3`}
        >
          <p className="min-w-0 flex-1">
            <span className="font-medium text-foreground">
              Cambiaste de restaurante.
            </span>{" "}
            Vaciamos el pedido anterior.
          </p>
          <button
            type="button"
            onClick={() => setTenantSwitchNotice(false)}
            className={`${noticeAction} shrink-0`}
          >
            Entendido
          </button>
        </div>
      ) : null}

      {qrRecoveryNotice && !tableLockedFromQr && !tenantSwitchNotice ? (
        <div
          role="status"
          className={`${noticeShell} flex items-center justify-between gap-3`}
        >
          <p className="min-w-0 flex-1">
            <span className="font-medium text-foreground">
              Escanea el QR de tu mesa
            </span>{" "}
            para pedir ahí · o pide ayuda al personal.
          </p>
          <button
            type="button"
            onClick={() => setQrRecoveryNotice(false)}
            className={`${noticeAction} shrink-0`}
          >
            Entendido
          </button>
        </div>
      ) : null}

      {orderingEnabled ? (
        <MenuContextStrip
          tableLockedFromQr={tableLockedFromQr}
          tableNumber={cartTable}
          cartCount={cartCount}
          sessionLoading={sessionLoading}
          sessionOrder={sessionOrder}
          sessionError={sessionError}
          pendingSharedJoin={pendingSharedJoin}
          joinedSharedOrder={joinedSharedOrder}
          onJoinSharedOrder={handleJoinSharedOrder}
          onUnjoinSharedOrder={handleUnjoinSharedOrder}
          onLeaveWrongTable={handleLeaveWrongTable}
          onChangeTable={handleChangeTable}
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
        className={`flex flex-col gap-8 pt-4 ${listBottomPad}`}
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
              className="mb-2.5 flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground"
            >
              <span
                aria-hidden
                className="h-4 w-1 shrink-0 rounded-full bg-[var(--menu-accent)]"
              />
              {section.name}
            </h2>
            <ul className="divide-y divide-border/80 overflow-hidden rounded-xl border border-border/80 bg-card shadow-[inset_2px_0_0_0_var(--menu-accent-muted)]">
              {section.products.map((product) => (
                <li key={product.uuid}>
                  <ProductCard
                    product={product}
                    orderingEnabled={canAddToCart}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {showCartBar ? (
        <CartBar
          tenantSlug={tenantSlug}
          modules={modules}
          tableLockedFromQr={tableLockedFromQr}
          isEditingTable={isEditingTable}
          draftTable={draftTable}
          tableEditError={tableEditError}
          pendingTableChange={pendingTableChange}
          openOrderId={sessionOrder?.uuid ?? activeOrderId}
          onDraftTableChange={setDraftTable}
          onChangeTable={handleChangeTable}
          onLeaveWrongTable={handleLeaveWrongTable}
          onJoinSharedOrder={
            pendingSharedJoin ? handleJoinSharedOrder : undefined
          }
          onUnjoinSharedOrder={
            joinedSharedOrder ? handleUnjoinSharedOrder : undefined
          }
          onConfirmTableEdit={handleConfirmTableEdit}
          onCancelTableEdit={handleCancelTableEdit}
          onCancelPendingTableChange={handleCancelPendingTableChange}
        />
      ) : exploreOrdersUnavailable ? (
        <MenuConsultaFooter message="Solo consulta · para pedir usa el QR de tu mesa" />
      ) : !orderingEnabled ? (
        <MenuConsultaFooter message="Solo consulta · pedidos desactivados" />
      ) : null}

      {tableLockedFromQr && cartTable && cartTableToken ? (
        <TableHelpFab
          tenantSlug={tenantSlug}
          tableNumber={cartTable}
          tableToken={cartTableToken}
          elevated={showCartBar || !orderingEnabled || exploreOrdersUnavailable}
        />
      ) : null}
    </>
  );
}

/**
 * Franja inferior fija para modos solo consulta.
 */
function MenuConsultaFooter({ message }: { message: string }) {
  return (
    <div
      data-testid="menu-consulta-footer"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-center backdrop-blur-sm"
    >
      <p className="text-xs font-medium text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Una sola franja de contexto (mesa / sesión / error / explore sin canales).
 */
function MenuContextStrip({
  tableLockedFromQr,
  tableNumber,
  cartCount,
  sessionLoading,
  sessionOrder,
  sessionError,
  pendingSharedJoin = false,
  joinedSharedOrder = false,
  onJoinSharedOrder,
  onUnjoinSharedOrder,
  onLeaveWrongTable,
  onChangeTable,
  onRetrySession,
}: {
  tableLockedFromQr: boolean;
  tableNumber: string | null;
  cartCount: number;
  sessionLoading: boolean;
  sessionOrder: Order | null;
  sessionError: string | null;
  pendingSharedJoin?: boolean;
  joinedSharedOrder?: boolean;
  onJoinSharedOrder?: () => void;
  onUnjoinSharedOrder?: () => void;
  onLeaveWrongTable: () => void;
  onChangeTable: () => void;
  onRetrySession: () => void;
}) {
  const shell =
    "-mx-4 border-b border-[color-mix(in_srgb,var(--menu-accent)_16%,var(--border))] px-4 py-2 text-xs leading-snug text-muted-foreground";
  const stripAction =
    "inline-flex min-h-11 items-center font-medium underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const leaveLabel =
    cartCount > 0
      ? "Salir y seguir con este carrito"
      : "Salir de esta mesa";

  if (sessionLoading && !sessionOrder) {
    return (
      <div role="status" className={shell}>
        {tableNumber ? (
          <>
            <span className="font-medium text-foreground">
              {formatTableLabel(tableNumber)}
            </span>
            {" · consultando…"}
          </>
        ) : (
          "Consultando el pedido…"
        )}
      </div>
    );
  }

  if (sessionOrder && tableNumber && pendingSharedJoin) {
    const { countLabel, totalLabel, peekLabel } =
      orderPlatilloSummary(sessionOrder);
    return (
      <div
        role="region"
        aria-label="Pedido de la mesa"
        className={`${shell} space-y-1.5 py-2`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="min-w-0 flex-1 basis-[12rem] truncate">
            <span className="font-medium text-foreground">
              {formatTableLabel(tableNumber)}
            </span>
            {" · "}
            <span className="font-medium text-foreground">
              {countLabel}
              {" · "}
              {totalLabel}
            </span>
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-x-2">
            <button
              type="button"
              onClick={onJoinSharedOrder}
              aria-label="Sumarme al pedido de la mesa"
              className="inline-flex min-h-11 items-center rounded-xl bg-[var(--menu-accent)] px-3 text-sm font-semibold text-[var(--menu-accent-fg)] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Sumarme
            </button>
            <button
              type="button"
              onClick={onLeaveWrongTable}
              aria-label={leaveLabel}
              className={stripAction}
            >
              Salir
            </button>
          </div>
        </div>
        {peekLabel ? (
          <p className="line-clamp-1 text-muted-foreground" title={peekLabel}>
            {peekLabel}
          </p>
        ) : null}
      </div>
    );
  }

  if (sessionOrder && tableNumber && joinedSharedOrder) {
    const { countLabel, totalLabel, peekLabel } =
      orderPlatilloSummary(sessionOrder);
    /** Con carrito abierto, Dejar de sumarme vive en Más opciones del sheet. */
    const showUnjoinOnStrip = Boolean(onUnjoinSharedOrder) && cartCount === 0;
    return (
      <div
        role="status"
        aria-live="polite"
        className={`${shell} space-y-1.5 py-2`}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <p className="min-w-0 flex-1 basis-[12rem] truncate">
            <span className="font-medium text-foreground">
              {formatTableLabel(tableNumber)}
            </span>
            {" · "}
            <span className="font-medium text-foreground">
              {countLabel}
              {" · "}
              {totalLabel}
            </span>
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-x-3">
            <Link
              href={`/orders/${sessionOrder.uuid}`}
              className={`${stripAction} text-foreground`}
            >
              Ver pedido
            </Link>
            {showUnjoinOnStrip ? (
              <button
                type="button"
                onClick={onUnjoinSharedOrder}
                aria-label="Dejar de sumarme a este pedido"
                className={stripAction}
              >
                Dejar de sumarme
              </button>
            ) : null}
            <button
              type="button"
              onClick={onLeaveWrongTable}
              aria-label={leaveLabel}
              className={stripAction}
            >
              Salir
            </button>
          </div>
        </div>
        {peekLabel ? (
          <p className="line-clamp-1 text-muted-foreground" title={peekLabel}>
            {peekLabel}
          </p>
        ) : null}
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
          className={`${stripAction} shrink-0 text-foreground`}
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
        className={`${shell} flex flex-wrap items-center justify-between gap-x-3 gap-y-1`}
      >
        <p className="min-w-0 flex-1 truncate">
          <span className="font-medium text-foreground">
            {formatTableLabel(tableNumber)}
          </span>
          <span> · listo para pedir</span>
        </p>
        <div className="flex shrink-0 items-center gap-x-3">
          {cartCount > 0 ? (
            <button
              type="button"
              onClick={onChangeTable}
              aria-label="Cambiar mesa"
              className={stripAction}
            >
              Cambiar mesa
            </button>
          ) : null}
          <button
            type="button"
            onClick={onLeaveWrongTable}
            aria-label={leaveLabel}
            className={stripAction}
          >
            Salir
          </button>
        </div>
      </div>
    );
  }

  return null;
}

/** Conteo, total y peek (1–2 nombres) del pedido de la mesa. */
function orderPlatilloSummary(order: Order): {
  countLabel: string;
  totalLabel: string;
  peekLabel: string | null;
} {
  const lines = order.items.filter((item) => item.quantity > 0);
  const count = lines.reduce((sum, item) => sum + item.quantity, 0);
  const shown = lines.slice(0, 2);
  const shownQty = shown.reduce((sum, item) => sum + item.quantity, 0);
  const moreQty = Math.max(0, count - shownQty);

  const peekParts = shown.map((item) => {
    const name = item.productName.trim() || "Platillo";
    return item.quantity > 1 ? `${name} ×${item.quantity}` : name;
  });

  let peekLabel: string | null = null;
  if (peekParts.length > 0) {
    peekLabel = peekParts.join(", ");
    if (moreQty > 0) {
      peekLabel +=
        moreQty === 1 ? " · y 1 más" : ` · y ${moreQty} más`;
    }
  }

  return {
    countLabel: count === 1 ? "1 platillo" : `${count} platillos`,
    totalLabel: order.formattedTotal || formatCurrency(order.totalAmount),
    peekLabel,
  };
}
