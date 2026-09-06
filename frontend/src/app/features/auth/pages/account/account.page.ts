import { Component } from '@angular/core';

/**
 * Minimal placeholder landing page for a just-authenticated customer.
 *
 * Non-obvious "why" this exists: this feature (001-customer-otp-auth) is scoped to
 * authentication only — full profile/order/incident views belong to the separate
 * customer-profile-management feature (RF-04, spec.md Assumptions), which does not exist yet.
 * `tasks.md` T029 nonetheless requires the "enter code" screen to redirect somewhere on
 * success, and User Story 1 Scenario 5 requires that a customer's own session be recognizable
 * ("they are recognized as an authenticated customer"). This page exists only to be that
 * concrete, honest landing spot and to prove the `authGuard`/session flow end-to-end — it is
 * intentionally empty of any business feature so as not to invent scope beyond this feature's
 * approved spec (Constitution Principle I).
 */
@Component({
  selector: 'app-account-page',
  standalone: true,
  template: `
    <main class="auth-page">
      <section class="auth-card">
        <h1>Tu cuenta</h1>
        <p>Has iniciado sesión correctamente como cliente de Ar Makers 3D.</p>
      </section>
    </main>
  `,
  styleUrls: ['../../auth-shared.css'],
})
export class AccountPage {}
