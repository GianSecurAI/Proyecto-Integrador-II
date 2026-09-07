import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CartStateService } from '../../cart/services/cart-state.service';

/**
 * Blocks entering `/checkout` with an empty cart — redirects to `/cart` instead, reusing that
 * page's own empty-state messaging/CTA rather than duplicating it (per this feature's scope
 * note). Only guards route ENTRY; a cart that becomes empty WHILE already on the checkout page
 * (e.g. the visitor removes every line in the cart-review step) is handled by
 * `../components/cart-review-step/cart-review-step.component.ts` itself, since a `canActivate`
 * guard only re-runs on navigation, not on live signal changes.
 */
export const checkoutCartNotEmptyGuard: CanActivateFn = () => {
  const cart = inject(CartStateService);
  const router = inject(Router);
  return cart.isEmpty() ? router.parseUrl('/cart') : true;
};
