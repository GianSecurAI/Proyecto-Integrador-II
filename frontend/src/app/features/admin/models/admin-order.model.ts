import {
  OrderDeliveryDto,
  OrderDeliveryViewModel,
  OrderHistoryEntryDto,
  OrderItemDto,
  OrderItemViewModel,
  OrderStatusHistoryEntryViewModel,
  OrderSummaryViewModel,
  toHistoryViewModel,
} from '../../account/models/order.model';
import { OrderKind, OrderStatus } from '../../../shared/models/wire-enums';

// ---------------------------------------------------------------------------------------------
// Wire DTOs — backend `AdminOrderSummaryDto` / `AdminOrderDetailDto` (and the 201/200 body of
// `POST /api/admin/orders/personalized`). Dates are ISO instants, money JSON numbers, enums
// UPPER_SNAKE. Nullable fields arrive as `null`.
// ---------------------------------------------------------------------------------------------

export interface AdminOrderSummaryDto {
  id: string;
  placedAt: string;
  status: OrderStatus;
  kind: OrderKind;
  summary: string;
  totalAmount: number;
  customerEmail: string;
  customerName: string | null;
  customerPhone: string | null;
}

export interface AdminOrderDetailDto {
  id: string;
  placedAt: string;
  status: OrderStatus;
  kind: OrderKind;
  summary: string;
  totalAmount: number;
  /** Amount agreed with the customer by staff (personalized orders only; never calculated). */
  agreedAmount: number | null;
  /** Description of the personalized job (personalized orders only). */
  description: string | null;
  items: OrderItemDto[];
  delivery: OrderDeliveryDto | null;
  customerEmail: string;
  customerName: string | null;
  customerPhone: string | null;
  /** Staff member who registered a personalized order. */
  registeredBy: string | null;
  statusHistory: OrderHistoryEntryDto[];
  /** The ONLY statuses the server will currently accept — the UI offers exactly these. */
  allowedNextStatuses: OrderStatus[];
}

// ---------------------------------------------------------------------------------------------
// View models
// ---------------------------------------------------------------------------------------------

export interface AdminOrderSummaryViewModel extends OrderSummaryViewModel {
  readonly customerEmail: string;
  readonly customerName: string | null;
  readonly customerPhone: string | null;
}

export interface AdminOrderViewModel extends AdminOrderSummaryViewModel {
  readonly agreedAmount: number | null;
  readonly description: string | null;
  readonly items: readonly OrderItemViewModel[];
  readonly delivery: OrderDeliveryViewModel | null;
  readonly registeredBy: string | null;
  readonly statusHistory: readonly OrderStatusHistoryEntryViewModel[];
  /** Server-provided `allowedNextStatuses` — the frontend never evaluates transition rules. */
  readonly allowedNextStatuses: readonly OrderStatus[];
}

export function toAdminOrderSummaryViewModel(dto: AdminOrderSummaryDto): AdminOrderSummaryViewModel {
  return {
    id: dto.id,
    placedAt: new Date(dto.placedAt),
    status: dto.status,
    kind: dto.kind,
    summary: dto.summary,
    totalAmount: dto.totalAmount,
    customerEmail: dto.customerEmail,
    customerName: dto.customerName,
    customerPhone: dto.customerPhone,
  };
}

export function toAdminOrderViewModel(dto: AdminOrderDetailDto): AdminOrderViewModel {
  return {
    ...toAdminOrderSummaryViewModel(dto),
    agreedAmount: dto.agreedAmount,
    description: dto.description,
    items: dto.items ?? [],
    delivery: dto.delivery ?? null,
    registeredBy: dto.registeredBy,
    statusHistory: (dto.statusHistory ?? []).map(toHistoryViewModel),
    allowedNextStatuses: dto.allowedNextStatuses ?? [],
  };
}

/** Form value of the personalized-order registration screen. Maps 1:1 onto backend
 * `RegisterPersonalizedOrderRequestDto` (`customerEmail`, `description`, `agreedAmount`,
 * `paymentConfirmed`). */
export interface RegisterPersonalizedOrderFormValue {
  readonly customerEmail: string;
  readonly description: string;
  readonly agreedAmount: number | null;
  readonly paymentConfirmed: boolean;
}

/** Backend limits (`PersonalizedOrderRules`) mirrored for UX validation only. */
export const PERSONALIZED_LIMITS = {
  emailMax: 255,
  descriptionMax: 1000,
  amountMax: 999999.99,
} as const;
