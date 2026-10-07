// Local development environment configuration (used by `ng serve` / `development` build
// configuration via angular.json fileReplacements). `/api` is forwarded to the local Spring Boot
// server (http://localhost:8080) by `proxy.conf.json`, so the browser sees ONE origin and the
// SameSite=Strict session cookie works without weakening the backend's CORS/Security config.
export const environment = {
  production: false,
  apiBaseUrl: '/api',
  // Same placeholder as environment.ts — see the comment there.
  whatsappNumber: '51900000000',
};
