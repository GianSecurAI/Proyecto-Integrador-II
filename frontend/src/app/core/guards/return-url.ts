/**
 * Accepts a post-login `returnUrl` only when it is an in-app absolute path (`/checkout`,
 * `/admin/orders?x=1`); anything else (external URLs, protocol-relative `//host`, backslashes,
 * other schemes) yields `null` so the caller falls back to the role's default route.
 * Navigation UX only: the target route's own guard and the backend still authorize.
 */
export function safeReturnUrl(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes(String.fromCharCode(92))) {
    return null;
  }
  return value;
}
