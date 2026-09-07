/**
 * UI ViewModel for the RF-04 profile screen (`pages/profile/profile.page.ts`) — NOT a
 * persistence/DTO assumption. It is deliberately kept structurally distinct from both:
 * - the mock's raw seed shape (`../mocks/customer-profile.mock.ts` — `CustomerProfileSeed`, which
 *   uses `registeredAt: string` instead of `memberSince: Date`), and
 * - the backend `Cliente` entity (`backend/src/main/java/com/armakers3d/auth/domain/Cliente.java`
 *   — which has `id`, `rol`, `active`, none of which this screen needs or displays).
 *
 * The mapping between the seed and this ViewModel (currently trivial — see
 * `services/customer-profile-mock.service.ts`) is deliberate so that a future real API
 * integration (whatever shape RF-04's eventual DTO takes) only requires changing that mapping
 * function, never reshaping this component or its template.
 */
export interface CustomerProfileViewModel {
  /** Read-only: the customer's OTP identity. Changing it is a distinct, unspecified concern. */
  readonly email: string;
  readonly memberSince: Date;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
}

/** The only fields this screen ever lets a customer edit — see mock's field-provenance comment. */
export type EditableCustomerProfileFields = Pick<
  CustomerProfileViewModel,
  'firstName' | 'lastName' | 'phone'
>;
