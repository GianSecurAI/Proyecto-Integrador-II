import {
  CHECKOUT_STATUSES,
  describeCheckoutStatus,
  describeProofDecision,
  paymentMethodLabel,
} from './wire-enums';

describe('wire-enums — checkout / payments (ADR-005)', () => {
  it('labels every checkout status in Spanish with a tone', () => {
    expect(CHECKOUT_STATUSES.length).toBe(6);
    for (const status of CHECKOUT_STATUSES) {
      const meta = describeCheckoutStatus(status);
      expect(meta.label).not.toBe(status);
      expect(meta.tone).toBeTruthy();
    }
    expect(describeCheckoutStatus('PROOF_SUBMITTED').label).toBe('En verificación');
    expect(describeCheckoutStatus('PAID').tone).toBe('success');
  });

  it('labels payment methods and proof decisions', () => {
    expect(paymentMethodLabel('YAPE')).toBe('Yape');
    expect(paymentMethodLabel('PLIN')).toBe('Plin');
    expect(describeProofDecision('REJECTED').tone).toBe('danger');
    expect(describeProofDecision('APPROVED').label).toBe('Aprobado');
  });

  it('falls back to the raw value for an unknown status', () => {
    expect(describeCheckoutStatus('SOMETHING' as never).label).toBe('SOMETHING');
  });
});
