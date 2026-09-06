// Production/default environment configuration.
// NOTE (T006): Angular's current `ng generate environments` schematic names the default
// build's file `environment.ts` (used unless replaced) and the dev-time override
// `environment.development.ts`, which supersedes the older `environment.prod.ts` convention
// referenced in tasks.md. The `fileReplacements` wiring in angular.json achieves the same
// per-environment-configuration requirement (Constitution Principle XIV) — no code branches
// on environment, only this file swap.
export const environment = {
  production: true,
  // Same-origin default: the Angular app and the Spring Boot API are expected to be served
  // behind the same origin/reverse proxy in the deployed environment, so no absolute host is
  // hardcoded here (Principle XIV/XVIII). Override per deployment via a build-time
  // environment file if the API is ever hosted on a different origin.
  apiBaseUrl: '/api',
  // PLACEHOLDER pending the real Ar Makers 3D WhatsApp Business number from the Product Owner
  // (project requirements: custom orders/inquiries are redirected to WhatsApp, never an in-app checkout).
  // Must be replaced before this is used against real customers.
  whatsappNumber: '51900000000',
};
