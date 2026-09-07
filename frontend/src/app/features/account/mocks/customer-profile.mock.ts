/**
 * Isolated seed fixture for the RF-04 ("Gestión de perfil de cliente",
 * docs/discovery/06-system-definition.md line 53) preview screen. No REST contract for a
 * customer-profile GET/PUT endpoint is defined yet (01-requirements-analysis.md line 308: RF-04's
 * Gherkin is empty and its editable fields are undefined by that spec). This raw fixture shape is
 * deliberately named and shaped differently from `CustomerProfileViewModel`
 * (../models/customer-profile.model.ts) — `registeredAt` instead of `createdAt`, no `id`/`rol`/
 * `active` — precisely so it is never mistaken for, or silently reused as, the backend `Cliente`
 * entity/DTO shape once RF-04 gets a real API contract. Mirrors the isolation pattern already used
 * by `features/catalog/mocks/product-details.mock.ts`.
 *
 * Field provenance (Constitution Principle I traceability):
 * - `email` / `registeredAt`: the only two fields with a real backend counterpart — see
 *   `backend/src/main/java/com/armakers3d/auth/domain/Cliente.java` (`email`, `createdAt`).
 * - `firstName` / `lastName` / `phone`: approved as optional customer profile fields by the
 *   Product Owner amendment in `specs/001-customer-otp-auth/spec.md`
 *   ("Amendment (2026-09-07, Product Owner decision)"), already collected (as UX-only, unsent
 *   values) by `features/auth/pages/register/register.page.ts`. Reused here as the sole editable
 *   field set — no other field (address, birthdate, document ID, avatar, payment info, gender...)
 *   has any approved-requirement backing, so none is added.
 */
export interface CustomerProfileSeed {
  readonly email: string;
  readonly registeredAt: string; // ISO 8601
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
}

export const CUSTOMER_PROFILE_SEED: CustomerProfileSeed = {
  email: 'maria.gomez@example.com',
  registeredAt: '2025-11-03T14:20:00Z',
  firstName: 'María',
  lastName: 'Gómez',
  phone: '987 654 321',
};
