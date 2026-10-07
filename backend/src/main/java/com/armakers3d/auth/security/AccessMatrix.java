package com.armakers3d.auth.security;

import com.armakers3d.auth.domain.Rol;
import java.util.List;

/**
 * THE central role matrix for {@code /api/**} (Constitution Principle VII). One ordered list, first
 * match wins, consumed by {@code SecurityConfig} to build {@code authorizeHttpRequests} and by the
 * default-deny test that proves every controller mapping is covered. Anything under {@code /api}
 * that matches no rule is denied (401 anonymous / 403 authenticated), so a new controller is
 * unreachable until someone adds a rule here on purpose.
 *
 * <p>STATUS: the matrix is PROPOSED, derived from the SPA route guards and
 * {@code frontend-backend-contract-review.md} section 4.0; it is not approved by the Product Owner.
 * See {@code docs/architecture/rbac-matrix.md}. Ownership (object-level) rules are not expressed
 * here: they are enforced from the principal in the services (or {@code @PreAuthorize} where the
 * id is in the path).
 */
public final class AccessMatrix {

    /** Who may call an endpoint. Role names map to CUSTOMER / ADVISOR / ADMIN in the contract docs. */
    public enum Access {
        PUBLIC(),
        ANY_ROLE(Rol.CLIENTE, Rol.ASESOR, Rol.ADMINISTRADOR),
        CLIENTE(Rol.CLIENTE),
        STAFF(Rol.ASESOR, Rol.ADMINISTRADOR),
        ADMIN(Rol.ADMINISTRADOR);

        private final List<Rol> roles;

        Access(Rol... roles) {
            this.roles = List.of(roles);
        }

        public List<Rol> roles() {
            return roles;
        }

        public boolean isPublic() {
            return this == PUBLIC;
        }
    }

    /** {@code pattern} is a PathPattern; method-agnostic on purpose so MVC still answers 405. */
    public record Rule(String pattern, Access access) {}

    public static final List<Rule> RULES = List.of(
            // Authentication
            new Rule("/api/auth/otp/request", Access.PUBLIC),
            new Rule("/api/auth/otp/verify", Access.PUBLIC),
            new Rule("/api/auth/logout", Access.PUBLIC), // idempotent 204 by contract (E4)
            new Rule("/api/auth/me", Access.ANY_ROLE),
            // Customer self-service (own data only, enforced from the principal)
            new Rule("/api/customers/me", Access.CLIENTE), // GET/PUT; GET /api/customers/{id} retired (BE-06)
            // Customer orders: submit (POST), list (GET) and detail/tracking (GET /{id}). Own orders only; the owner
            // is the principal; not-owned ids are 404. Explicit paths on purpose (no /api/orders/**).
            new Rule("/api/orders", Access.CLIENTE),
            new Rule("/api/orders/*", Access.CLIENTE),
            // Staff order management (E24-E27): list, detail, status change, personalized registration.
            new Rule("/api/admin/orders", Access.STAFF),
            new Rule("/api/admin/orders/personalized", Access.STAFF),
            new Rule("/api/admin/orders/*", Access.STAFF),
            new Rule("/api/admin/orders/*/status", Access.STAFF),
            // Customer incidents (E22, E23 + own detail): own incidents only, owner = principal, not-owned ids are 404.
            new Rule("/api/incidents", Access.CLIENTE),
            new Rule("/api/incidents/*", Access.CLIENTE),
            // Staff incident management (E28-E31): list, detail, triage (PATCH), resolution.
            new Rule("/api/admin/incidents", Access.STAFF),
            new Rule("/api/admin/incidents/*", Access.STAFF),
            new Rule("/api/admin/incidents/*/resolution", Access.STAFF),
            // Administrative reports (E32, E33): ADMINISTRADOR only (ASESOR denied, PD-REP-06). Exact paths on purpose.
            new Rule("/api/admin/reports/orders", Access.ADMIN),
            new Rule("/api/admin/reports/incidents", Access.ADMIN),
            // Administration
            new Rule("/api/admin/users/**", Access.ADMIN),
            new Rule("/api/admin/products/**", Access.ADMIN),
            // Public catalog read (available products only). Listed narrowly, never as /api/catalog/**.
            new Rule("/api/catalog/products", Access.PUBLIC),
            new Rule("/api/catalog/products/*", Access.PUBLIC));

    private AccessMatrix() {}
}
