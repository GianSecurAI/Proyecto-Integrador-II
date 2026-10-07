import { PaymentAttemptDto, PaymentDetailDto, PaymentSummaryDto } from '../models/admin-payment.model';

/** Test-only fixtures; JSON shapes copied from backend-foundation.md section 24.1. */
export const PAYMENT_ID = '3f2b8c1e-0000-4000-8000-000000000001';

export function makeSummary(overrides: Partial<PaymentSummaryDto> = {}): PaymentSummaryDto {
  return {
    checkoutId: PAYMENT_ID,
    reference: 'AM3D-3F2B8C1E',
    status: 'PROOF_SUBMITTED',
    customerName: 'Ana Torres',
    totalAmount: 87.3,
    currency: 'PEN',
    createdAt: '2026-10-07T17:00:00Z',
    submittedAt: '2026-10-07T17:30:00Z',
    attemptCount: 1,
    method: 'YAPE',
    duplicateProofWarning: false,
    ...overrides,
  };
}

export function makePaymentAttempt(overrides: Partial<PaymentAttemptDto> = {}): PaymentAttemptDto {
  return {
    attemptId: 'a1111111-0000-4000-8000-000000000001',
    number: 1,
    method: 'YAPE',
    operationCode: 'AB12CD34',
    submittedAt: '2026-10-07T17:30:00Z',
    contentType: 'image/png',
    sizeBytes: 204800,
    decision: 'PENDING',
    rejectionReason: null,
    decidedBy: null,
    decidedAt: null,
    duplicateProofWarning: false,
    ...overrides,
  };
}

export function makeDetail(overrides: Partial<PaymentDetailDto> = {}): PaymentDetailDto {
  return {
    checkoutId: PAYMENT_ID,
    reference: 'AM3D-3F2B8C1E',
    status: 'PROOF_SUBMITTED',
    orderId: null,
    customerId: 12,
    contact: { fullName: 'Ana Torres', phone: '987654321' },
    totalAmount: 87.3,
    currency: 'PEN',
    createdAt: '2026-10-07T17:00:00Z',
    paidAt: null,
    items: [{ productId: 1, title: 'Llavero A', unitPrice: 43.65, quantity: 2, lineTotal: 87.3 }],
    attempts: [makePaymentAttempt()],
    duplicateProofWarning: false,
    ...overrides,
  };
}
