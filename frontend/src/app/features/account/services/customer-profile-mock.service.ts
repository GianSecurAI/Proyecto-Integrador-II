import { Injectable, signal } from '@angular/core';
import { Observable, map, switchMap, tap, throwError, timer } from 'rxjs';
import { CUSTOMER_PROFILE_SEED, CustomerProfileSeed } from '../mocks/customer-profile.mock';
import { CustomerProfileViewModel, EditableCustomerProfileFields } from '../models/customer-profile.model';

/**
 * TEMPORARY PREVIEW-ONLY MAGIC VALUE.
 * This reserved phone value lets a reviewer/QA preview the "save failed" error state from the UI
 * alone (see the on-screen notice in `profile.page.html`) without a real backend. It carries no
 * security or validation meaning whatsoever — a future integrator replacing this mock with a real
 * profile-update endpoint MUST delete this block entirely rather than adapt it. Mirrors the
 * `MOCK_EXPIRED_OTP`/`MOCK_INVALID_OTP` pattern in `features/auth/services/auth-preview.service.ts`.
 */
export const MOCK_SAVE_FAILURE_PHONE = '000-000-000';

function toViewModel(seed: CustomerProfileSeed): CustomerProfileViewModel {
  return {
    email: seed.email,
    memberSince: new Date(seed.registeredAt),
    firstName: seed.firstName,
    lastName: seed.lastName,
    phone: seed.phone,
  };
}

/**
 * Isolated, frontend-only preview service for the RF-04 profile screen. No REST contract is
 * defined for reading/updating a customer profile yet (see mock's doc comment). Holds the
 * current mock profile as a signal so `ProfilePage`'s view mode always reflects the latest saved
 * state, and simulates network latency via `timer(...)` on both `load()` and `save()` (same
 * pattern as `AuthMockService`). Never touches `localStorage`/`sessionStorage`, never logs any
 * profile field.
 */
@Injectable({ providedIn: 'root' })
export class CustomerProfileMockService {
  private readonly state = signal<CustomerProfileViewModel>(toViewModel(CUSTOMER_PROFILE_SEED));

  /** Current mock profile. Read-only signal — mutated only through `save()`. */
  readonly profile = this.state.asReadonly();

  /** Simulates an initial fetch. Does not mutate state; the signal is already seeded. */
  load(): Observable<CustomerProfileViewModel> {
    return timer(400).pipe(map(() => this.state()));
  }

  /**
   * Simulates a profile update. Fails deterministically when `phone` equals
   * `MOCK_SAVE_FAILURE_PHONE` (see doc comment above) so the UI's error path can be previewed;
   * otherwise applies `changes` to the in-memory state and resolves with the updated profile.
   */
  save(changes: EditableCustomerProfileFields): Observable<CustomerProfileViewModel> {
    if (changes.phone.trim() === MOCK_SAVE_FAILURE_PHONE) {
      return timer(500).pipe(
        switchMap(() => throwError(() => new Error('Mock profile save failure'))),
      );
    }
    return timer(500).pipe(
      tap(() => this.state.update((current) => ({ ...current, ...changes }))),
      map(() => this.state()),
    );
  }
}
