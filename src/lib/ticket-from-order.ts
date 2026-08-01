/**
 * Mapeo Order → props de ticket térmico (pre-cuenta / cuenta).
 */

import type { Order, RestaurantProfile } from "@/types/api";
import type {
  TicketItem,
  TicketReceiptProps,
} from "@/components/admin/ticket-receipt";
import { buildTenantSiteUrl } from "@/lib/qr-menu-url";

export interface RestaurantTicketInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
  /** Opcional: aún no existe en perfil de tenant. */
  rfc?: string | null;
  /** Slug del tenant para QR / URLs públicas del comensal. */
  tenantSlug?: string | null;
}

export type TicketKind = "pre-cuenta" | "cuenta";

/**
 * Glosario Operate (impresión):
 * - Compacto (card / fila): sustantivo — `ticketKindLabel`
 * - CTA ancho / detalle: verbo + objeto — `ticketKindPrintLabel`
 * - Desde Cobrar: `ticketPrintBeforeCloseLabel`
 * - En el modal de preview: botón primario “Imprimir” (el kind ya está en el badge)
 */

/** Sustantivo corto para botones compactos (card, fila, aviso BILL). */
export function ticketKindLabel(kind: TicketKind): string {
  return kind === "cuenta" ? "Cuenta" : "Pre-cuenta";
}

/** Verbo + objeto para CTAs de impresión (detalle, cocina Por cobrar). */
export function ticketKindPrintLabel(kind: TicketKind): string {
  return kind === "cuenta" ? "Imprimir cuenta" : "Imprimir pre-cuenta";
}

/** CTA secundaria en el diálogo Cobrar (siempre imprime cuenta). */
export function ticketPrintBeforeCloseLabel(): string {
  return `${ticketKindPrintLabel("cuenta")} antes de cobrar`;
}

/** Chip / meta en mayúsculas como en el papel térmico. */
export function ticketKindUpperLabel(kind: TicketKind): string {
  return kind === "cuenta" ? "CUENTA" : "PRE-CUENTA";
}

/** Datos de restaurante para el ticket a partir del perfil admin. */
export function ticketInfoFromProfile(
  profile: RestaurantProfile | null,
  fallbackName: string,
  tenantSlug?: string,
): RestaurantTicketInfo {
  return {
    name: profile?.name?.trim() || fallbackName,
    address: profile?.address ?? null,
    phone: profile?.whatsapp ?? null,
    tenantSlug: tenantSlug?.trim() || null,
  };
}

/** Tasas de propina sugerida en ticket / WhatsApp (MX servicio). */
export const TICKET_TIP_RATES = [0.1, 0.15, 0.18] as const;

/** Tasa recomendada en mensaje WhatsApp (liquidación rápida). */
export const TICKET_RECOMMENDED_TIP_RATE = 0.15 as const;

export function ticketTipSuggestions(
  total: number,
): Array<{ label: string; amount: number; withTip: number }> {
  return TICKET_TIP_RATES.map((rate) => {
    const amount = total * rate;
    return {
      label: `${Math.round(rate * 100)}%`,
      amount,
      /** Total a liquidar con esa propina (papel térmico). */
      withTip: total + amount,
    };
  });
}

/** Una propina sugerida con total a liquidar (WhatsApp). */
export function ticketRecommendedTip(total: number): {
  label: string;
  amount: number;
  withTip: number;
} {
  const amount = total * TICKET_RECOMMENDED_TIP_RATE;
  return {
    label: `${Math.round(TICKET_RECOMMENDED_TIP_RATE * 100)}%`,
    amount,
    withTip: total + amount,
  };
}

/**
 * Cuenta al cobrar / pedido entregado o cerrado; pre-cuenta en operación activa.
 * `preferred` gana cuando el flujo lo fija (p. ej. diálogo Cobrar → cuenta).
 */
export function resolveTicketKind(
  order: Order,
  preferred?: TicketKind,
): TicketKind {
  if (preferred) return preferred;
  if (order.status === "CLOSED" || order.status === "DELIVERED") {
    return "cuenta";
  }
  return "pre-cuenta";
}

/** Folio legible: id numérico o prefijo del UUID. */
export function orderFolio(order: Order): string {
  if (order.id != null) return `#${order.id}`;
  return `#${order.uuid.slice(0, 8).toUpperCase()}`;
}

/** Etiqueta de mesa / canal para el ticket. */
export function orderTicketLabel(order: Order): string {
  if (order.orderType === "IN_TABLE") {
    const primary = order.tableNumber?.trim() || "—";
    const linked = (order.linkedTables ?? [])
      .map((t) => t.trim())
      .filter(Boolean);
    if (linked.length > 0) {
      const all = [primary, ...linked].sort((a, b) =>
        a.localeCompare(b, "es", { numeric: true }),
      );
      return `Mesa ${all.join("-")}`;
    }
    return `Mesa ${primary}`;
  }
  if (order.orderType === "PICKUP") {
    return order.customerName?.trim() || "Para llevar";
  }
  if (order.orderType === "DELIVERY") {
    return "A domicilio";
  }
  return orderFolio(order);
}

export function orderToTicketItems(order: Order): TicketItem[] {
  return order.items.map((item, index) => ({
    id: item.id ?? `${item.productUuid}-${item.batchNumber}-${index}`,
    quantity: item.quantity,
    name: item.productName,
    /** Importe de línea (ya incluye modificadores). */
    price: item.subtotal,
    notes: item.notes?.trim() || undefined,
    modifiers: item.modifiers.map((m) => ({
      name: m.name,
      priceDelta: m.priceDelta > 0 ? m.priceDelta : undefined,
    })),
  }));
}

/** IVA incluido en el total (base 16%). */
export function taxIncludedFromTotal(total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return total - total / 1.16;
}

export function formatTicketDateTime(iso: string | null | undefined): string {
  const raw = iso?.trim();
  if (!raw) {
    return new Date().toLocaleString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return raw;
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * URL pública de seguimiento / rating del pedido (zona comensal del tenant).
 * Prefiere `https://{slug}.{domain}/orders/{uuid}` para no depender del path admin.
 */
export function orderPublicUrl(
  orderUuid: string,
  tenantSlug?: string | null,
): string {
  const slug = tenantSlug?.trim();
  if (slug) {
    return `${buildTenantSiteUrl(slug)}/orders/${orderUuid}`;
  }
  if (typeof window === "undefined") return `/orders/${orderUuid}`;
  return `${window.location.origin}/orders/${orderUuid}`;
}

export function buildTicketReceiptProps(
  order: Order,
  restaurant: RestaurantTicketInfo,
  /** Si se omite, se deriva del status del pedido. */
  kind?: TicketKind,
): TicketReceiptProps {
  const total = order.totalAmount;
  const resolved = resolveTicketKind(order, kind);
  const slug = restaurant.tenantSlug?.trim() || null;
  return {
    restaurantName: restaurant.name,
    rfc: restaurant.rfc?.trim() || undefined,
    address: restaurant.address?.trim() || undefined,
    phone: restaurant.phone?.trim() || undefined,
    dateTime: formatTicketDateTime(order.updatedAt ?? order.createdAt),
    folio: orderFolio(order),
    tableNumber: orderTicketLabel(order),
    waiterName: order.staffName?.trim() || undefined,
    items: orderToTicketItems(order),
    taxAmount: taxIncludedFromTotal(total),
    total,
    // QR solo con slug de tenant (URL pública real); evita papel con link roto.
    qrUrl: slug ? orderPublicUrl(order.uuid, slug) : undefined,
    qrCaption:
      resolved === "cuenta"
        ? "Escanea para calificar tu experiencia"
        : "Escanea para ver el estado de tu pedido",
    customNote:
      resolved === "cuenta"
        ? "¡Gracias por su preferencia!"
        : "PRE-CUENTA · No es comprobante fiscal",
    ticketKind: resolved,
  };
}
