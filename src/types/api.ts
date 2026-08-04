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
  | "CLOSED"
  | "CANCELLED";

/** Estado individual de un ítem (`OrderItemStatus.java`). */
export type OrderItemStatus = "PENDING" | "PREPARING" | "DELIVERED";

/** Modalidad del pedido. Debe coincidir con `OrderType` del backend. */
export type OrderType = "IN_TABLE" | "PICKUP" | "DELIVERY";

/* -------------------------------------------------------------------------- */
/* Autenticación admin (wire)                                                 */
/* -------------------------------------------------------------------------- */

/** Credenciales de login (`LoginRequest.java`). */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Respuesta de login (`LoginResponse.java`). */
export interface LoginResponse {
  token: string;
}

/* -------------------------------------------------------------------------- */
/* Equipo / staff (PIN)                                                       */
/* -------------------------------------------------------------------------- */

/** Roles operativos del equipo (`StaffRole.java`). */
export type StaffRole = "ADMIN" | "MESERO" | "COCINA";

/** Login por PIN (`StaffPinLoginRequest.java`). */
export interface StaffPinLoginRequest {
  tenantSlug: string;
  staffId: string;
  pin: string;
}

/** Respuesta login PIN (`StaffPinLoginResponse.java`). */
export interface StaffPinLoginResponse {
  token: string;
  role: StaffRole;
  staffId: string;
  name: string;
}

/** Directorio público de personal (`PublicStaffMemberResponse.java`). */
export interface PublicStaffMember {
  id: string;
  name: string;
  role: StaffRole;
}

/** Miembro del equipo (`StaffMemberResponse.java`). */
export interface StaffMemberResponse {
  id: string;
  name: string;
  role: StaffRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Alta de miembro (`StaffMemberRequest.java`). */
export interface StaffMemberRequest {
  name: string;
  role: StaffRole;
  pin: string;
}

/** Actualización parcial (`StaffMemberUpdateRequest.java`). */
export interface StaffMemberUpdateRequest {
  name?: string;
  role?: StaffRole;
  pin?: string;
  active?: boolean;
}

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

/** Alta/edición de categoría (`CategoryRequest.java`). */
export interface CategoryRequest {
  name: string;
  displayOrder: number;
}

/** Respuesta cruda de un producto (`ProductResponse.java`). */
export interface ProductResponse {
  uuid: string;
  name: string;
  description: string | null;
  /** Serializado como número JSON desde un `BigDecimal`. */
  price: number;
  imageUrl: string | null;
  /**
   * Jackson serializa el campo Java `boolean isAvailable` como `available`
   * (no `isAvailable`). Ver ProductIntegrationTest `$.available`.
   */
  available: boolean;
  categoryId: number;
  categoryName: string;
  /** ISO-8601 (`OffsetDateTime`). */
  createdAt: string;
  modifierGroups?: ProductModifierGroupResponse[];
}

export interface ProductModifierOptionResponse {
  uuid: string;
  name: string;
  priceDelta: number;
  available: boolean;
  displayOrder: number;
}

export interface ProductModifierGroupResponse {
  uuid: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  displayOrder: number;
  options: ProductModifierOptionResponse[];
}

export interface ProductModifierOptionRequest {
  uuid?: string | null;
  name: string;
  priceDelta: number;
  available?: boolean;
  displayOrder?: number;
}

export interface ProductModifierGroupRequest {
  uuid?: string | null;
  name: string;
  minSelect: number;
  maxSelect: number;
  displayOrder?: number;
  options: ProductModifierOptionRequest[];
}

/** Alta/edición de producto (`ProductRequest.java`). */
export interface ProductRequest {
  name: string;
  description?: string | null;
  /** Precio numérico (BigDecimal en backend). */
  price: number;
  imageUrl?: string | null;
  categoryId: number;
}

/* -------------------------------------------------------------------------- */
/* Perfil / settings del restaurante (wire)                                   */
/* -------------------------------------------------------------------------- */

/** Perfil de marca del tenant (`RestaurantProfileResponse.java`). */
export interface RestaurantProfileResponse {
  id: number;
  name: string;
  subdomain: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  description: string | null;
  address: string | null;
  googleMapsUrl: string | null;
  whatsapp: string | null;
  businessHours: string | null;
  hasDelivery: boolean;
  hasPickup: boolean;
  hasReservations: boolean;
  /** Si el menú digital acepta pedidos; si es false, solo consulta. */
  orderingEnabled: boolean;
  /** Total de mesas del salón (1–99). */
  tableCount?: number;
  /** Website institucional visible al público. */
  websitePublished: boolean;
  /** Plan comercial: BASIC | PRO (omitido en perfil público). */
  plan?: string | null;
  /** ACTIVE | PENDING_PAYMENT (omitido en perfil público). */
  paymentStatus?: string | null;
  updatedAt: string;
}

/** Payload de actualización de perfil (`RestaurantProfileRequest.java`). */
export interface RestaurantProfileRequest {
  name?: string | null;
  description?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  address?: string | null;
  googleMapsUrl?: string | null;
  whatsapp?: string | null;
  businessHours?: string | null;
  hasDelivery?: boolean;
  hasPickup?: boolean;
  hasReservations?: boolean;
  orderingEnabled?: boolean;
  /** Total de mesas del salón (1–99). */
  tableCount?: number;
  websitePublished?: boolean;
}

/** Línea de creación de pedido hacia el backend (`OrderDetailRequest.java`). */
export interface OrderDetailRequest {
  productUuid: string;
  quantity: number;
  notes?: string | null;
  modifierUuids?: string[];
}

/**
 * Payload de creación hacia el backend (`OrderRequest.java`).
 * El total lo calcula el servidor a partir de los precios vigentes.
 */
export interface OrderRequest {
  customerName: string;
  customerPhone?: string | null;
  orderType: OrderType;
  tableNumber?: string | null;
  deliveryAddress?: string | null;
  activeOrderUuid?: string | null;
  /** Token del QR de mesa (?t=). */
  tableToken?: string | null;
  details: OrderDetailRequest[];
}

/**
 * DTO de aplicación para confirmar el carrito.
 * Se mapea a `OrderRequest` en `orderService` antes del POST.
 *
 * `productId` es el UUID público del producto (identificador expuesto al comensal).
 */
export interface CreateOrderDTO {
  items: Array<{
    /** UUID público del producto (`Product.uuid`). */
    productId: string;
    quantity: number;
    notes?: string | null;
    modifierUuids?: string[];
  }>;
  /** Total calculado en cliente (informativo; el backend lo recalcula). */
  total: number;
  /** Nombre del comensal; el backend lo exige, el servicio aplica un fallback. */
  customerName?: string | null;
  /** Número de mesa (pedidos en salón). */
  tableNumber?: string | null;
  /** Dirección (solo DELIVERY). */
  deliveryAddress?: string | null;
  /** Modalidad; por defecto `IN_TABLE` en el menú digital. */
  orderType?: OrderType;
  customerPhone?: string | null;
  /** UUID de orden activa para enviar adición (misma cuenta). */
  activeOrderUuid?: string | null;
  /** Token del QR de mesa (?t=). */
  tableToken?: string | null;
}

/** Respuesta cruda de una línea de pedido (`OrderDetailResponse.java`). */
export interface OrderDetailResponse {
  id?: number;
  productUuid: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes: string | null;
  batchNumber?: number;
  status?: OrderItemStatus;
  modifiers?: OrderDetailModifierResponse[];
}

export interface OrderDetailModifierResponse {
  modifierUuid: string | null;
  name: string;
  priceDelta: number;
}

/** Respuesta cruda de un pedido (`OrderResponse.java`). */
export interface OrderResponse {
  id?: number | null;
  uuid: string;
  customerName: string;
  customerPhone: string | null;
  orderType: OrderType;
  tableNumber: string | null;
  /** Mesas secundarias unidas a esta cuenta. */
  linkedTables?: string[] | null;
  staffId?: string | null;
  staffName?: string | null;
  deliveryAddress: string | null;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  updatedAt?: string | null;
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
  modifierGroups: ProductModifierGroup[];
}

export interface ProductModifierOption {
  uuid: string;
  name: string;
  priceDelta: number;
  formattedPriceDelta: string;
  available: boolean;
  displayOrder: number;
}

export interface ProductModifierGroup {
  uuid: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  displayOrder: number;
  options: ProductModifierOption[];
}

/** Línea de un pedido normalizada, con subtotal formateado. */
export interface OrderItem {
  id: number | null;
  productUuid: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  formattedSubtotal: string;
  notes: string | null;
  batchNumber: number;
  status: OrderItemStatus;
  modifiers: Array<{
    modifierUuid: string | null;
    name: string;
    priceDelta: number;
    formattedPriceDelta: string;
  }>;
}

/** Pedido de dominio, con total formateado y líneas normalizadas. */
export interface Order {
  id: number | null;
  uuid: string;
  customerName: string;
  customerPhone: string | null;
  orderType: OrderType;
  tableNumber: string | null;
  linkedTables: string[];
  staffId: string | null;
  staffName: string | null;
  deliveryAddress: string | null;
  status: OrderStatus;
  totalAmount: number;
  formattedTotal: string;
  createdAt: string;
  updatedAt: string | null;
  items: OrderItem[];
}

/** Página Spring Data de pedidos admin. */
export interface OrderPageResponse {
  content: OrderResponse[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export type AdminOrderListFilter = "ALL" | "OPEN" | "CLOSED" | "PICKUP";

export interface OrderPage {
  content: Order[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

/** Perfil de dominio del restaurante (settings / identidad). */
export interface RestaurantProfile {
  id: number;
  name: string;
  subdomain: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  description: string | null;
  address: string | null;
  googleMapsUrl: string | null;
  whatsapp: string | null;
  businessHours: string | null;
  hasDelivery: boolean;
  hasPickup: boolean;
  hasReservations: boolean;
  /** Si el menú digital acepta pedidos; si es false, solo consulta. */
  orderingEnabled: boolean;
  /** Total de mesas del salón (1–99). */
  tableCount: number;
  /** Website institucional visible al público. */
  websitePublished: boolean;
  /** Plan comercial: BASIC | PRO. */
  plan: string;
  /** ACTIVE | PENDING_PAYMENT */
  paymentStatus: string;
  updatedAt: string;
}

/** Smart Rating: resultado hacia el comensal. */
export type FeedbackOutcome =
  | "GOOGLE_REVIEW"
  | "PRIVATE_COMPLAINT"
  | "THANKS";

export type FeedbackInboxStatus = "OPEN" | "RESOLVED" | "DISMISSED";

export type FeedbackReason = "FOOD" | "SERVICE" | "WAIT" | "OTHER";

export interface SubmitFeedbackRequest {
  stars: number;
  comment?: string | null;
  contact?: string | null;
  reason?: FeedbackReason | null;
}

export interface SubmitFeedbackResponse {
  outcome: FeedbackOutcome;
  googleMapsUrl?: string | null;
  message?: string | null;
}

export interface FeedbackStatusResponse {
  submitted: boolean;
}

export interface AdminFeedbackItem {
  id: number;
  orderUuid: string;
  stars: number;
  comment: string | null;
  contact: string | null;
  reason: string | null;
  outcome: FeedbackOutcome;
  status: FeedbackInboxStatus;
  urgent: boolean;
  requiresManagerAttention?: boolean;
  tableNumber: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CriticalFeedbackAlertEvent {
  type: "CRITICAL_FEEDBACK_ALERT";
  orderUuid: string;
  tableNumber: string;
  stars: number;
  tags?: string[];
  comment?: string | null;
  timestamp: string;
  requiresManagerAttention?: boolean;
}

export interface FeedbackSummary {
  openUrgentCount: number;
  openCount: number;
}

/* -------------------------------------------------------------------------- */
/* Llamadas de mesa (llamar mesero / pedir cuenta)                            */
/* -------------------------------------------------------------------------- */

export type TableCallType = "WAITER" | "BILL";

export type TableCallPaymentMethod = "CASH" | "CARD" | "TRANSFER";

export interface TableCallRequest {
  tableNumber: string;
  tableToken: string;
  callType: TableCallType;
  paymentMethod?: TableCallPaymentMethod | null;
  note?: string | null;
}

export interface TableCallResponse {
  eventType: "TABLE_CALL";
  id: string;
  callType: TableCallType;
  tableNumber: string;
  paymentMethod: TableCallPaymentMethod | null;
  note: string | null;
  createdAt: string;
}

