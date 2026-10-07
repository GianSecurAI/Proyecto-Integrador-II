import { CheckoutStatus, PaymentMethod, ProofDecision } from '../../../shared/models/wire-enums';
import { CheckoutItemDto } from '../../checkout/models/checkout.model';

/** Wire types of `/api/admin/payments` (backend-foundation.md section 24.1, ADR-005). */
export interface PaymentSummaryDto {
  checkoutId: string;
  reference: string;
  status: CheckoutStatus;
  customerName: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  submittedAt: string | null;
  attemptCount: number;
  method: PaymentMethod | null;
  duplicateProofWarning: boolean;
}

export interface PaymentAttemptDto {
  attemptId: string;
  number: number;
  method: PaymentMethod;
  operationCode: string | null;
  submittedAt: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  decision: ProofDecision;
  rejectionReason: string | null;
  decidedBy: number | null;
  decidedAt: string | null;
  duplicateProofWarning: boolean;
}

export interface PaymentDetailDto {
  checkoutId: string;
  reference: string;
  status: CheckoutStatus;
  orderId: string | null;
  customerId: number;
  contact: { fullName: string; phone: string };
  totalAmount: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  items: CheckoutItemDto[];
  attempts: PaymentAttemptDto[];
  duplicateProofWarning: boolean;
}

/** Rejection reason rules of the backend (1..300 characters after trim, no control characters). */
export const REJECTION_REASON_MAX = 300;
