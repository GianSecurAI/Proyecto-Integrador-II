import {
  OrderKind,
  OrderStatus,
  describeOrderStatus,
} from '../../../shared/models/wire-enums';

export { describeOrderStatus };
export type { OrderKind, OrderStatus };

/** Semantic visual treatment for `shared/ui/status-badge`. */
export type OrderStatusBadgeTone = 'neutral' | 'info' | 'success' | 'danger';

// ---------------------------------------------------------------------------------------------
// Wire DTOs — exactly the backend JSON (`orders/dto/*`). Dates are ISO-8601 instants, money is a
// JSON number in soles, enums are UPPER_SNAKE (labels live in `shared/models/wire-enums.ts`).
// ---------------------------------------------------------------------------------------------

/** Backend `OrderHistoryEntryDto`. `previousStatus` is null only for the creation entry. */
export interface OrderHistoryEntryDto {
  previousStatus: OrderStatus | null;
  newStatus: OrderStatus;
  changedAt: string;
  responsible: string;
  note: string | null;
}

/** Backend `OrderSummaryDto` (customer list row). */
export interface OrderSummaryDto {
  id: string;
  placedAt: string;
  status: OrderStatus;
  kind: OrderKind;
  summary: string;
  totalAmount: number;
}

/** Backend `OrderResponseDto.Item`. */
export interface OrderItemDto {
  productId: number;
  title: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

/** Backend `OrderResponseDto.Delivery`. */
export interface OrderDeliveryDto {
  address: string;
  district: string;
  notes: string | null;
}

/** Backend `OrderResponseDto` (owner detail, and the 201/200 body of `POST /api/orders`). */
export interface OrderResponseDto extends OrderSummaryDto {
  items: OrderItemDto[];
  delivery: OrderDeliveryDto | null;
  statusHistory: OrderHistoryEntryDto[];
}

// ---------------------------------------------------------------------------------------------
// View models used by the pages (dates parsed once, in the mappers below).
// ---------------------------------------------------------------------------------------------

export interface OrderSummaryViewModel {
  readonly id: string;
  readonly placedAt: Date;
  readonly status: OrderStatus;
  readonly kind: OrderKind;
  /** Short server-built description, e.g. "2 unidades: Llavero y 1 producto más". */
  readonly summary: string;
  /** Server-computed total in soles. */
  readonly totalAmount: number;
}

/** One append-only entry of the order status history. */
export interface OrderStatusHistoryEntryViewModel {
  readonly previousStatus: OrderStatus | null;
  readonly newStatus: OrderStatus;
  readonly changedAt: Date;
  readonly responsible: string;
  readonly note: string | null;
}

export interface OrderItemViewModel {
  readonly productId: number;
  readonly title: string;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly lineTotal: number;
}

export interface OrderDeliveryViewModel {
  readonly address: string;
  readonly district: string;
  readonly notes: string | null;
}

/** Owner order detail. The current `status` and the history come from the server; this client
 * never derives one from the other and never decides what may happen next. */
export interface OrderDetailViewModel extends OrderSummaryViewModel {
  readonly items: readonly OrderItemViewModel[];
  readonly delivery: OrderDeliveryViewModel | null;
  readonly statusHistory: readonly OrderStatusHistoryEntryViewModel[];
}

export function toOrderSummaryViewModel(dto: OrderSummaryDto): OrderSummaryViewModel {
  return {
    id: dto.id,
    placedAt: new Date(dto.placedAt),
    status: dto.status,
    kind: dto.kind,
    summary: dto.summary,
    totalAmount: dto.totalAmount,
  };
}

export function toHistoryViewModel(entry: OrderHistoryEntryDto): OrderStatusHistoryEntryViewModel {
  return {
    previousStatus: entry.previousStatus,
    newStatus: entry.newStatus,
    changedAt: new Date(entry.changedAt),
    responsible: entry.responsible,
    note: entry.note,
  };
}

export function toOrderDetailViewModel(dto: OrderResponseDto): OrderDetailViewModel {
  return {
    ...toOrderSummaryViewModel(dto),
    items: dto.items ?? [],
    delivery: dto.delivery ?? null,
    statusHistory: (dto.statusHistory ?? []).map(toHistoryViewModel),
  };
}
