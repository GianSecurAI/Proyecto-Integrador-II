import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CheckoutStateService } from '../state/checkout-state.service';

/**
 * `/checkout/confirmacion` is reachable ONLY right after a real, successful mock order-creation
 * response (`CheckoutStateService.placedOrder` is set exclusively by
 * `../components/order-review-step/order-review-step.component.ts`, right after
 * `CustomerOrdersMockService.createStandardOrder(...)` resolves). Visiting this route directly —
 * e.g. bookmarking it, or a fresh page load where all in-memory state is gone — has nothing to
 * confirm, so it redirects to `/cart` instead of rendering a dead-end/stale confirmation.
 */
export const checkoutConfirmationGuard: CanActivateFn = () => {
  const checkoutState = inject(CheckoutStateService);
  const router = inject(Router);
  return checkoutState.placedOrder() ? true : router.parseUrl('/cart');
};
