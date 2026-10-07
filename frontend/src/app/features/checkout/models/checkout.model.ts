import { CheckoutStatus, PaymentMethod, ProofDecision } from '../../../shared/models/wire-enums';

/**
 * Wire types of the customer checkout API (`docs/architecture/backend-foundation.md` section
 * 24.1, ADR-005). Timestamps stay ISO-8601 strings (formatted at render time); money is a plain
 * PEN number the server computed. The SPA never derives or decides any of these values.
 */
export interface CheckoutItemDto {
  productId: number;
  title: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface PaymentInstructionsDto {
  methods: PaymentMethod[];
  amount: number;
  currency: string;
  /** Short reference (`AM3D-XXXXXXXX`) the customer writes in the wallet note. */
  reference: string;
}

export interface CheckoutAttemptDto {
  attemptId: string;
  number: number;
  method: PaymentMethod;
  operationCode: string | null;
  submittedAt: string;
  status: ProofDecision;
  rejectionReason: string | null;
}

export interface CheckoutDto {
  checkoutId: string;
  status: CheckoutStatus;
  /** Only when `PAID`. */
  orderId: string | null;
  totalAmount: number;
  currency: string;
  createdAt: string;
  /** Only while `AWAITING_PAYMENT_PROOF`. */
  expiresAt: string | null;
  items: CheckoutItemDto[];
  paymentInstructions: PaymentInstructionsDto;
  proofStatus: 'NONE' | ProofDecision;
  /** Only while `PROOF_REJECTED`. */
  rejectionReason: string | null;
  attemptsRemaining: number;
  attempts: CheckoutAttemptDto[];
}

/** Body of `POST /api/checkout` — the ONLY fields the client may send. There is deliberately no
 * price, total, status or customer-id field: the server prices and owns the checkout. */
export interface CreateCheckoutRequest {
  items: { productId: number; quantity: number }[];
  delivery: { address: string; district: string; notes?: string };
  contact: { fullName: string; phone: string };
}
