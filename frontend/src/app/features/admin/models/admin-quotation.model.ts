import { BadgeTone } from '../../../shared/models/wire-enums';

/** Backend `QuotationStatus`. REGISTRADA can become any of the other three; those outcomes are final. */
export type QuotationStatus = 'REGISTRADA' | 'ACEPTADA' | 'RECHAZADA' | 'VENCIDA';

export const QUOTATION_STATUSES: readonly QuotationStatus[] = [
  'REGISTRADA',
  'ACEPTADA',
  'RECHAZADA',
  'VENCIDA',
];

const QUOTATION_STATUS_META: Record<QuotationStatus, { label: string; tone: BadgeTone }> = {
  REGISTRADA: { label: 'Registrada', tone: 'info' },
  ACEPTADA: { label: 'Aceptada', tone: 'success' },
  RECHAZADA: { label: 'Rechazada', tone: 'danger' },
  VENCIDA: { label: 'Vencida', tone: 'neutral' },
};

export function describeQuotationStatus(status: QuotationStatus): { label: string; tone: BadgeTone } {
  return QUOTATION_STATUS_META[status];
}

/** Backend `QuotationDto`: the price staff agreed with the customer over WhatsApp (never computed by the system). */
export interface AdminQuotation {
  id: number;
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  description: string;
  agreedAmount: number;
  status: QuotationStatus;
  allowedNextStatuses: QuotationStatus[];
  notes: string | null;
  registeredAt: string;
  updatedAt: string;
  /** The personalized order generated from this quotation, once there is one. */
  orderId: string | null;
}

export interface CreateQuotationRequest {
  customerEmail: string;
  description: string;
  agreedAmount: number;
  notes?: string;
}

export const QUOTATION_LIMITS = { emailMax: 255, descriptionMax: 1000, notesMax: 500, amountMax: 999999.99 } as const;
