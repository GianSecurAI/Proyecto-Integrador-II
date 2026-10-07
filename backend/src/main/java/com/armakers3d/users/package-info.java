/**
 * Users domain: customer profile (names, phone) and administrator user management. There is
 * deliberately NO second identity store: the account itself ({@code auth.domain.Cliente}: id,
 * email, role, active) stays owned by {@code auth}, and this module works on it through the auth
 * {@code ClienteRepository} port and {@code SessionService} (auth is the foundational module every
 * feature may depend on). What {@code users} owns is the profile aggregate
 * ({@link com.armakers3d.users.domain.CustomerProfile}) and the administration use cases with their
 * rules (last-administrator protection, no self-lockout, session revocation, audit logging).
 *
 * <p>Profile persistence is in-memory until the database phase (needs a V4 migration); see
 * {@code docs/architecture/backend-foundation.md} section 18.
 */
package com.armakers3d.users;
