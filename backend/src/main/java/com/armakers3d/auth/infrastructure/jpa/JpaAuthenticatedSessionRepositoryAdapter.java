package com.armakers3d.auth.infrastructure.jpa;

import com.armakers3d.auth.domain.AuthenticatedSession;
import com.armakers3d.auth.repository.AuthenticatedSessionRepository;
import java.time.Instant;
import java.util.Optional;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/** Database-backed {@link AuthenticatedSessionRepository}; active in every profile except {@code nodb}. */
@Repository
@Profile("!nodb")
public class JpaAuthenticatedSessionRepositoryAdapter implements AuthenticatedSessionRepository {

    private final AuthenticatedSessionJpaRepository jpa;

    public JpaAuthenticatedSessionRepositoryAdapter(AuthenticatedSessionJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public AuthenticatedSession save(AuthenticatedSession s) {
        return toDomain(jpa.save(new AuthenticatedSessionEntity(
                s.getId(), s.getClienteId(), s.getRol(), s.getCreatedAt(), s.getExpiresAt(), s.getRevokedAt())));
    }

    @Override
    public Optional<AuthenticatedSession> findById(String token) {
        return jpa.findById(token).map(JpaAuthenticatedSessionRepositoryAdapter::toDomain);
    }

    @Override
    @Transactional
    public int revokeAllForCliente(Long clienteId, Instant now) {
        return jpa.revokeAllForCliente(clienteId, now);
    }

    private static AuthenticatedSession toDomain(AuthenticatedSessionEntity e) {
        return new AuthenticatedSession(
                e.getId(), e.getClienteId(), e.getRol(), e.getCreatedAt(), e.getExpiresAt(), e.getRevokedAt());
    }
}
