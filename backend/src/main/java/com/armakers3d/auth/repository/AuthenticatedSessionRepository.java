package com.armakers3d.auth.repository;

import com.armakers3d.auth.domain.AuthenticatedSession;
import java.time.Instant;
import java.util.Optional;

/** Port for server-side session persistence (backend-foundation.md section 10). The id is the token. */
public interface AuthenticatedSessionRepository {

    /** Inserts or overwrites the session with the same id. */
    AuthenticatedSession save(AuthenticatedSession session);

    Optional<AuthenticatedSession> findById(String token);

    /**
     * Revokes every not-yet-revoked session of the account (deactivation, role change). Returns how
     * many sessions were revoked. Atomic: one statement/one pass, no read-modify-write by callers.
     */
    int revokeAllForCliente(Long clienteId, Instant now);
}
