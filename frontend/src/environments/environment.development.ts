// Local development environment configuration (used by `ng serve` / `development` build
// configuration via angular.json fileReplacements). `/api` is forwarded to the local Spring Boot
// server (http://localhost:8080) by `proxy.conf.json`, so the browser sees ONE origin and the
// SameSite=Strict session cookie works without weakening the backend's CORS/Security config.
export const environment = {
  production: false,
  apiBaseUrl: '/api',
  // Same placeholder as environment.ts — see the comment there.
  whatsappNumber: '51900000000',
  // PAYMENT ACCOUNTS shown next to the Yape/Plin QR (ADR-005, OPS-02). TODO(OPS-02): the Product
  // Owner must fill the real account holder name and phone number of each wallet; they are NOT
  // invented here. Empty values are simply not displayed. The QR images are static assets in
  // public/assets/payments/ (placeholders until replaced, see docs/architecture/payments-qr-assets.md).
  paymentAccounts: {
    yape: { holderName: '', phoneNumber: '' },
    plin: { holderName: '', phoneNumber: '' },
  },
};
