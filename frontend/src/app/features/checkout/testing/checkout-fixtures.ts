import { CheckoutAttemptDto, CheckoutDto } from '../models/checkout.model';

/** Test-only fixtures; JSON shapes copied from backend-foundation.md section 24.1. Not imported by app code. */
export const CHECKOUT_ID = '3f2b8c1e-0000-4000-8000-000000000001';

export function makeAttempt(overrides: Partial<CheckoutAttemptDto> = {}): CheckoutAttemptDto {
  return {
    attemptId: 'a1111111-0000-4000-8000-000000000001',
    number: 1,
    method: 'YAPE',
    operationCode: 'AB12CD34',
    submittedAt: '2026-10-07T17:30:00Z',
    status: 'PENDING',
    rejectionReason: null,
    ...overrides,
  };
}

export function makeCheckout(overrides: Partial<CheckoutDto> = {}): CheckoutDto {
  return {
    checkoutId: CHECKOUT_ID,
    status: 'AWAITING_PAYMENT_PROOF',
    orderId: null,
    totalAmount: 87.3,
    currency: 'PEN',
    createdAt: '2026-10-07T17:00:00Z',
    expiresAt: '2026-10-08T17:00:00Z',
    items: [{ productId: 1, title: 'Llavero A', unitPrice: 43.65, quantity: 2, lineTotal: 87.3 }],
    paymentInstructions: { methods: ['YAPE', 'PLIN'], amount: 87.3, currency: 'PEN', reference: 'AM3D-3F2B8C1E' },
    proofStatus: 'NONE',
    rejectionReason: null,
    attemptsRemaining: 5,
    attempts: [],
    ...overrides,
  };
}

/** A tiny File with the given MIME type (content is irrelevant to the client-side checks). */
export function makeFile(name = 'pago.png', type = 'image/png', size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}
