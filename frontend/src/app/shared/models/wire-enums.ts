/**
 * THE one place where backend wire enums (UPPER_SNAKE strings) are given UI labels and badge
 * tones. Every other file imports these types/functions; no component re-declares a label map.
 * Values mirror the Java enums exactly (`OrderStatus`, `OrderKind`, `IncidentStatus`,
 * `IncidentPriority`, `ProductCategory`, `Rol`). Presentation only: which transitions are
 * allowed is decided by the backend (`allowedNextStatuses`), never here.
 */
export type BadgeTone = 'neutral' | 'info' | 'success' | 'danger';

interface Described {
  label: string;
  tone: BadgeTone;
}

// ---- Roles (backend `Rol`) ----
export type Role = 'CLIENTE' | 'ASESOR' | 'ADMINISTRADOR';
export const ROLES: readonly Role[] = ['CLIENTE', 'ASESOR', 'ADMINISTRADOR'];
const ROLE_META: Record<Role, Described> = {
  CLIENTE: { label: 'Cliente', tone: 'neutral' },
  ASESOR: { label: 'Asesor', tone: 'info' },
  ADMINISTRADOR: { label: 'Administrador', tone: 'success' },
};
export function describeRole(role: Role): Described {
  return ROLE_META[role];
}

// ---- Product category (backend `ProductCategory`) ----
export type ProductCategory = 'LLAVERO' | 'PEGATINAS' | 'FIGURA' | 'DECORACION';
export const PRODUCT_CATEGORIES: readonly ProductCategory[] = [
  'LLAVERO',
  'PEGATINAS',
  'FIGURA',
  'DECORACION',
];
const CATEGORY_LABELS: Record<ProductCategory, string> = {
  LLAVERO: 'Llavero',
  PEGATINAS: 'Pegatinas',
  FIGURA: 'Figura',
  DECORACION: 'Decoración',
};
export function categoryLabel(category: ProductCategory): string {
  return CATEGORY_LABELS[category] ?? category;
}

// ---- Order status / kind (backend `OrderStatus`, `OrderKind`) ----
export type OrderStatus =
  | 'CONFIRMADO'
  | 'EN_PRODUCCION'
  | 'ENVIADO'
  | 'ENTREGADO'
  | 'CANCELADO';
export const ORDER_STATUSES: readonly OrderStatus[] = [
  'CONFIRMADO',
  'EN_PRODUCCION',
  'ENVIADO',
  'ENTREGADO',
  'CANCELADO',
];
export type OrderKind = 'ESTANDAR' | 'PERSONALIZADO';
export const ORDER_KINDS: readonly OrderKind[] = ['ESTANDAR', 'PERSONALIZADO'];

const ORDER_STATUS_META: Record<OrderStatus, Described> = {
  CONFIRMADO: { label: 'Confirmado', tone: 'info' },
  EN_PRODUCCION: { label: 'En producción', tone: 'info' },
  ENVIADO: { label: 'Enviado', tone: 'info' },
  ENTREGADO: { label: 'Entregado', tone: 'success' },
  CANCELADO: { label: 'Cancelado', tone: 'danger' },
};
export function describeOrderStatus(status: OrderStatus): Described {
  return ORDER_STATUS_META[status] ?? { label: status, tone: 'neutral' };
}
const ORDER_KIND_LABELS: Record<OrderKind, string> = {
  ESTANDAR: 'Estándar',
  PERSONALIZADO: 'Personalizado',
};
export function orderKindLabel(kind: OrderKind): string {
  return ORDER_KIND_LABELS[kind] ?? kind;
}

// ---- Incident status / priority (backend `IncidentStatus`, `IncidentPriority`) ----
export type IncidentStatus = 'ABIERTA' | 'EN_REVISION' | 'RESUELTA' | 'RECHAZADA';
export const INCIDENT_STATUSES: readonly IncidentStatus[] = [
  'ABIERTA',
  'EN_REVISION',
  'RESUELTA',
  'RECHAZADA',
];
export type IncidentPriority = 'BAJA' | 'MEDIA' | 'ALTA';
export const INCIDENT_PRIORITIES: readonly IncidentPriority[] = ['BAJA', 'MEDIA', 'ALTA'];

const INCIDENT_STATUS_META: Record<IncidentStatus, Described> = {
  ABIERTA: { label: 'Abierta', tone: 'neutral' },
  EN_REVISION: { label: 'En revisión', tone: 'info' },
  RESUELTA: { label: 'Resuelta', tone: 'success' },
  RECHAZADA: { label: 'Rechazada', tone: 'danger' },
};
export function describeIncidentStatus(status: IncidentStatus): Described {
  return INCIDENT_STATUS_META[status] ?? { label: status, tone: 'neutral' };
}
const INCIDENT_PRIORITY_META: Record<IncidentPriority, Described> = {
  BAJA: { label: 'Baja', tone: 'neutral' },
  MEDIA: { label: 'Media', tone: 'info' },
  ALTA: { label: 'Alta', tone: 'danger' },
};
export function describeIncidentPriority(priority: IncidentPriority): Described {
  return INCIDENT_PRIORITY_META[priority] ?? { label: priority, tone: 'neutral' };
}

// ---- Checkout / manual payment (backend `CheckoutStatus`, `PaymentMethod`, proof decision; ADR-005) ----
export type CheckoutStatus =
  | 'AWAITING_PAYMENT_PROOF'
  | 'PROOF_SUBMITTED'
  | 'PAID'
  | 'PROOF_REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';
export const CHECKOUT_STATUSES: readonly CheckoutStatus[] = [
  'AWAITING_PAYMENT_PROOF',
  'PROOF_SUBMITTED',
  'PAID',
  'PROOF_REJECTED',
  'EXPIRED',
  'CANCELLED',
];
const CHECKOUT_STATUS_META: Record<CheckoutStatus, Described> = {
  AWAITING_PAYMENT_PROOF: { label: 'Esperando comprobante', tone: 'neutral' },
  PROOF_SUBMITTED: { label: 'En verificación', tone: 'info' },
  PAID: { label: 'Pagado', tone: 'success' },
  PROOF_REJECTED: { label: 'Comprobante rechazado', tone: 'danger' },
  EXPIRED: { label: 'Expirado', tone: 'neutral' },
  CANCELLED: { label: 'Cancelado', tone: 'danger' },
};
export function describeCheckoutStatus(status: CheckoutStatus): Described {
  return CHECKOUT_STATUS_META[status] ?? { label: status, tone: 'neutral' };
}

export type PaymentMethod = 'YAPE' | 'PLIN';
export const PAYMENT_METHODS: readonly PaymentMethod[] = ['YAPE', 'PLIN'];
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { YAPE: 'Yape', PLIN: 'Plin' };
export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

/** Decision on one proof attempt (customer `status` / admin `decision`). */
export type ProofDecision = 'PENDING' | 'APPROVED' | 'REJECTED';
const PROOF_DECISION_META: Record<ProofDecision, Described> = {
  PENDING: { label: 'Pendiente', tone: 'info' },
  APPROVED: { label: 'Aprobado', tone: 'success' },
  REJECTED: { label: 'Rechazado', tone: 'danger' },
};
export function describeProofDecision(decision: ProofDecision): Described {
  return PROOF_DECISION_META[decision] ?? { label: decision, tone: 'neutral' };
}
