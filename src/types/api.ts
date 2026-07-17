/**
 * Tipos estrictos del backend (Spring Boot).
 *
 * Se distinguen dos capas:
 * 1. `*Response`: contrato "en el cable" (payload JSON tal cual lo emite el backend).
 *    Se usan únicamente dentro de la capa de servicios (`src/services/`).
 * 2. Modelos de dominio (`Category`, `Product`, `Order`): estructuras normalizadas
 *    que consume la aplicación, con el `uuid` expuesto y el precio ya formateado.
 *
 * Regla: prohibido `any`. Todo dato del backend vive tipado aquí.
 */

/** Estado del ciclo de vida de un pedido. Debe coincidir con `OrderStatus` del backend. */
export type OrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "IN_KITCHEN"
  | "DELIVERED"
  | "CANCELLED";

/** Modalidad del pedido. Debe coincidir con `OrderType` del backend. */
export type OrderType = "IN_TABLE" | "PICKUP" | "DELIVERY";

/* -------------------------------------------------------------------------- */
/* Capa "wire": payloads crudos del backend (BigDecimal → number, fechas ISO)  */
/* -------------------------------------------------------------------------- */

/** Respuesta cruda de una categoría (`CategoryResponse.java`). */
export interface CategoryResponse {
  id: number;
  name: string;
  displayOrder: number;
  /** ISO-8601 (`OffsetDateTime`). */
  createdAt: string;
}

/** Respuesta cruda de un producto (`ProductResponse.java`). */
export interface ProductResponse {
  uuid: string;
  name: string;
  description: string | null;
  /** Serializado como número JSON desde un `BigDecimal`. */
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  categoryId: number;
  categoryName: string;
  /** ISO-8601 (`OffsetDateTime`). */
  createdAt: string;
}

/** Respuesta cruda de una línea de pedido (`OrderDetailResponse.java`). */
export interface OrderDetailResponse {
  productUuid: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes: string | null;
}

/** Respuesta cruda de un pedido (`OrderResponse.java`). */
export interface OrderResponse {
  uuid: string;
  customerName: string;
  customerPhone: string | null;
  orderType: OrderType;
  tableNumber: string | null;
  deliveryAddress: string | null;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  details: OrderDetailResponse[];
}

/* -------------------------------------------------------------------------- */
/* Capa de dominio: lo que realmente consume la app                           */
/* -------------------------------------------------------------------------- */

/** Categoría de menú normalizada. */
export interface Category {
  id: number;
  name: string;
  displayOrder: number;
  createdAt: string;
}

/**
 * Producto de dominio: expone el `uuid` como identificador público y mantiene
 * el precio como `number` (para cálculos) junto a su versión ya formateada
 * como moneda (para render directo en UI).
 */
export interface Product {
  uuid: string;
  name: string;
  description: string | null;
  /** Precio numérico para operaciones/cálculos en cliente. */
  price: number;
  /** Precio formateado como moneda vía `Intl.NumberFormat` (ej. "$120.00"). */
  formattedPrice: string;
  imageUrl: string | null;
  isAvailable: boolean;
  categoryId: number;
  categoryName: string;
  createdAt: string;
}

/** Línea de un pedido normalizada, con subtotal formateado. */
export interface OrderItem {
  productUuid: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  formattedSubtotal: string;
  notes: string | null;
}

/** Pedido de dominio, con total formateado y líneas normalizadas. */
export interface Order {
  uuid: string;
  customerName: string;
  customerPhone: string | null;
  orderType: OrderType;
  tableNumber: string | null;
  deliveryAddress: string | null;
  status: OrderStatus;
  totalAmount: number;
  formattedTotal: string;
  createdAt: string;
  items: OrderItem[];
}
