/**
 * Esquemas zod que espejan las restricciones de Bean Validation de los DTOs
 * de Spring Boot (`restaurant-backend/dto/`). Defensa en profundidad:
 * el backend sigue siendo la fuente de verdad, pero el frontend valida
 * temprano y con mensajes en español.
 *
 * Convención de nombres: `*RequestSchema` = payload que viaja al backend.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Helpers comunes                                                             */
/* -------------------------------------------------------------------------- */

const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/;

/** ISO-8601 opcional que admite cadena vacía (significa "limpiar"). */
export const isoDateOrEmptySchema = z
  .string()
  .regex(/^$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/, {
    message: "La fecha debe ser ISO-8601 (ej. 2026-12-31T23:59:59Z)",
  })
  .optional();

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "El color debe ser un HEX (#RRGGBB)");

export const uuidSchema = z.string().uuid("Identificador no válido.");

/* -------------------------------------------------------------------------- */
/* Enums (espejo de los enums de Spring)                                       */
/* -------------------------------------------------------------------------- */

export const orderTypeSchema = z.enum(["IN_TABLE", "PICKUP", "DELIVERY"]);
export const orderStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "IN_KITCHEN",
  "DELIVERED",
  "CLOSED",
  "CANCELLED",
]);
export const orderItemStatusSchema = z.enum([
  "PENDING",
  "PREPARING",
  "DELIVERED",
]);
export const paymentMethodSchema = z.enum(["CASH", "CARD", "TRANSFER"]);
export const staffRoleSchema = z.enum(["ADMIN", "MESERO", "COCINA"]);
export const feedbackReasonSchema = z.enum(["FOOD", "SERVICE", "WAIT", "OTHER"]);
export const feedbackInboxStatusSchema = z.enum([
  "OPEN",
  "RESOLVED",
  "DISMISSED",
]);
export const tableCallTypeSchema = z.enum(["WAITER", "BILL"]);
export const subscriptionPlanSchema = z.enum(["BASIC", "PRO"]);
export const paymentStatusSchema = z.enum(["ACTIVE", "PENDING_PAYMENT"]);

/* -------------------------------------------------------------------------- */
/* Comensal (API pública)                                                      */
/* -------------------------------------------------------------------------- */

export const orderDetailSchema = z.object({
  productUuid: uuidSchema,
  quantity: z
    .number()
    .int()
    .min(1, "La cantidad mínima debe ser 1")
    .max(99, "La cantidad máxima es 99"),
  notes: z.string().max(255, "Las notas no pueden superar 255 caracteres").nullable().optional(),
  modifierUuids: z.array(uuidSchema).max(30, "No se pueden elegir más de 30 opciones").optional(),
});

export const orderRequestSchema = z.object({
  customerName: z
    .string()
    .min(1, "El nombre del cliente es requerido")
    .max(100, "El nombre no puede superar los 100 caracteres"),
  customerPhone: z
    .string()
    .regex(/^[+0-9()\-\s]{6,20}$/, "El teléfono no es válido")
    .nullable()
    .optional(),
  orderType: orderTypeSchema,
  tableNumber: z.string().max(10).nullable().optional(),
  deliveryAddress: z
    .string()
    .max(500, "La dirección no puede superar 500 caracteres")
    .nullable()
    .optional(),
  activeOrderUuid: uuidSchema.nullable().optional(),
  tableToken: z.string().max(80, "Token de mesa inválido").nullable().optional(),
  details: z
    .array(orderDetailSchema)
    .min(1, "El pedido debe contener al menos un producto")
    .max(50, "El pedido no puede superar 50 líneas"),
});

export const submitFeedbackSchema = z.object({
  stars: z.number().int().min(1, "La calificación mínima es 1.").max(5, "La calificación máxima es 5."),
  comment: z
    .string()
    .max(1000, "El comentario no puede superar 1000 caracteres.")
    .nullable()
    .optional(),
  contact: z
    .string()
    .max(120, "El contacto no puede superar 120 caracteres.")
    .nullable()
    .optional(),
  reason: feedbackReasonSchema.nullable().optional(),
});

export const tableCallRequestSchema = z.object({
  tableNumber: z
    .string()
    .min(1, "El número de mesa es requerido.")
    .max(32, "Número de mesa inválido."),
  tableToken: z
    .string()
    .min(1, "Escanea el código QR de tu mesa para pedir ayuda.")
    .max(256, "Token de mesa inválido."),
  callType: tableCallTypeSchema,
  paymentMethod: paymentMethodSchema.nullable().optional(),
  note: z.string().max(200, "La nota no puede superar 200 caracteres.").nullable().optional(),
});

export const loginRequestSchema = z.object({
  email: z.string().email("El email no tiene un formato válido"),
  password: z
    .string()
    .min(1, "La contraseña es requerida")
    .max(72, "La contraseña no puede superar 72 caracteres"),
});

export const staffPinLoginRequestSchema = z.object({
  tenantSlug: z.string().min(1, "El restaurante es requerido"),
  staffId: uuidSchema,
  pin: z.string().regex(/^\d{4}$/, "El PIN debe ser de exactamente 4 dígitos"),
});

/* -------------------------------------------------------------------------- */
/* Admin (BFF)                                                                 */
/* -------------------------------------------------------------------------- */

export const categoryRequestSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre de la categoría es requerido")
    .max(50, "El nombre no puede superar los 50 caracteres"),
  displayOrder: z.number().int().min(0).max(10000, "El orden es demasiado alto"),
});

export const productRequestSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre del producto es requerido")
    .max(100, "El nombre no puede superar los 100 caracteres"),
  description: z
    .string()
    .max(2000, "La descripción no puede superar 2000 caracteres")
    .nullable()
    .optional(),
  price: z.number().min(0, "El precio no puede ser negativo"),
  imageUrl: z.string().max(512).nullable().optional(),
  categoryId: z.number().int("El id de categoría es requerido"),
});

export const productModifierOptionRequestSchema = z.object({
  uuid: uuidSchema.nullable().optional(),
  name: z
    .string()
    .min(1, "El nombre de la opción es requerido")
    .max(100),
  priceDelta: z.number().min(0, "El extra no puede ser negativo"),
  available: z.boolean().optional(),
  displayOrder: z.number().int().max(10000).optional(),
});

export const productModifierGroupRequestSchema = z.object({
  uuid: uuidSchema.nullable().optional(),
  name: z.string().min(1, "El nombre del grupo es requerido").max(100),
  minSelect: z.number().int().min(0),
  maxSelect: z.number().int().min(1),
  displayOrder: z.number().int().max(10000).optional(),
  options: z
    .array(productModifierOptionRequestSchema)
    .min(1, "Cada grupo necesita al menos una opción"),
});

export const replaceProductModifiersRequestSchema = z.object({
  groups: z.array(productModifierGroupRequestSchema).optional(),
});

export const restaurantProfileRequestSchema = z.object({
  name: z.string().max(100).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  primaryColor: hexColorSchema.nullable().optional(),
  secondaryColor: hexColorSchema.nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  googleMapsUrl: z.string().max(512).nullable().optional(),
  whatsapp: z
    .string()
    .regex(/^[+0-9\-\s]{7,30}$/, "El WhatsApp no es válido")
    .nullable()
    .optional(),
  businessHours: z.string().max(255).nullable().optional(),
  hasDelivery: z.boolean().optional(),
  hasPickup: z.boolean().optional(),
  hasReservations: z.boolean().optional(),
  orderingEnabled: z.boolean().optional(),
  tableCount: z
    .number()
    .int()
    .min(1, "El total de mesas debe ser al menos 1")
    .max(99, "El total de mesas no puede superar 99")
    .optional(),
  websitePublished: z.boolean().optional(),
});

export const staffMemberRequestSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(100, "El nombre no puede superar los 100 caracteres"),
  role: staffRoleSchema,
  pin: z.string().regex(/^\d{4}$/, "El PIN debe ser de exactamente 4 dígitos"),
});

export const staffMemberUpdateRequestSchema = z
  .object({
    name: z.string().max(100).optional(),
    role: staffRoleSchema.optional(),
    pin: z.string().regex(/^\d{4}$/, "El PIN debe ser de exactamente 4 dígitos").optional(),
    active: z.boolean().optional(),
  })
  .optional();

export const staffOrderRequestSchema = z.object({
  customerName: z.string().max(100).nullable().optional(),
  tableNumber: z
    .string()
    .min(1, "El número de mesa es requerido")
    .max(20, "El número de mesa no puede superar los 20 caracteres"),
  activeOrderUuid: uuidSchema.nullable().optional(),
  details: z
    .array(orderDetailSchema)
    .min(1, "El pedido debe contener al menos un producto"),
});

export const orderStatusRequestSchema = z.object({
  status: orderStatusSchema,
});

export const orderItemStatusRequestSchema = z.object({
  status: orderItemStatusSchema,
});

export const closeOrderRequestSchema = z.object({
  paymentMethod: paymentMethodSchema,
});

export const resolveFeedbackRequestSchema = z.object({
  status: feedbackInboxStatusSchema,
});

export const redeemCouponRequestSchema = z.object({
  code: z
    .string()
    .min(1, "El código del cupón es requerido")
    .max(40, "El código no puede superar 40 caracteres"),
});

export const tableQrSignRequestSchema = z.object({
  tableNumbers: z
    .array(z.string().min(1).max(10))
    .min(1, "Indica al menos un número de mesa"),
});

export const tableMergeRequestSchema = z.object({
  tenantSlug: z.string().max(80).optional(),
  primaryTable: z
    .string()
    .min(1, "La mesa principal es requerida")
    .max(20, "Mesa principal inválida"),
  secondaryTables: z
    .array(z.string().min(1).max(20))
    .min(1, "Debes indicar al menos una mesa a vincular"),
});

/* -------------------------------------------------------------------------- */
/* SuperAdmin (BFF)                                                            */
/* -------------------------------------------------------------------------- */

export const superAdminCouponCreateRequestSchema = z.object({
  code: z
    .string()
    .min(3, "El código debe tener entre 3 y 40 caracteres")
    .max(40, "El código debe tener entre 3 y 40 caracteres")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "El código solo puede contener letras, números, guiones y guiones bajos",
    ),
  description: z.string().max(255).optional(),
  grantsPlan: subscriptionPlanSchema.nullable().optional(),
  maxRedemptions: z.number().int().positive().optional(),
  expiresAt: isoDateOrEmptySchema.nullable().optional(),
  grantDurationDays: z.number().int().positive().max(3650).optional(),
});

export const superAdminCouponUpdateRequestSchema = z
  .object({
    description: z.string().max(255).optional(),
    grantsPlan: subscriptionPlanSchema.nullable().optional(),
    maxRedemptions: z.number().int().positive().optional(),
    clearMaxRedemptions: z.boolean().optional(),
    expiresAt: isoDateOrEmptySchema.nullable().optional(),
    grantDurationDays: z.number().int().positive().max(3650).optional(),
    clearGrantDurationDays: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .optional();

export const superAdminTenantStatusRequestSchema = z.object({
  active: z.boolean("El estado activo es requerido"),
});

export const superAdminTenantSubscriptionRequestSchema = z.object({
  plan: subscriptionPlanSchema,
  paymentStatus: paymentStatusSchema,
  currentPeriodEnd: isoDateOrEmptySchema.nullable().optional(),
});
