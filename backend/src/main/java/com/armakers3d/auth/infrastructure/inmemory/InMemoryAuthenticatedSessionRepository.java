package com.armakers3d.auth.infrastructure.inmemory;

import com.armakers3d.auth.domain.AuthenticatedSession;
import com.armakers3d.auth.repository.AuthenticatedSessionRepository;
import java.util.Map;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

/**
 * In-memory {@link AuthenticatedSessionRepository} for the {@code nodb} profile only. Stores and
 * returns copies because {@link AuthenticatedSession} is mutable (revocation), matching the JPA
 * adapter where a loaded object is a detached snapshot.
 */
@Repository
@Profile("nodb")
public class InMemoryAuthenticatedSessionRepository implements AuthenticatedSessionRepository {

    private final Map<String, AuthenticatedSession> byToken = new ConcurrentHashMap<>();

    @Override
    public AuthenticatedSession save(AuthenticatedSession session) {
        byToken.put(session.getId(), copy(session));
        return copy(session);
    }

    @Override
    public Optional<AuthenticatedSession> findById(String token) {
        return Optional.ofNullable(byToken.get(token)).map(InMemoryAuthenticatedSessionRepository::copy);
    }

    @Override
    public int revokeAllForCliente(Long clienteId, Instant now) {
        AtomicInteger revoked = new AtomicInteger();
        byToken.replaceAll((token, s) -> {
            if (s.getClienteId().equals(clienteId) && s.getRevokedAt() == null) {
                AuthenticatedSession updated = copy(s);
                updated.revoke(now);
                revoked.incrementAndGet();
                return updated;
            }
            return s;
        });
        return revoked.get();
    }

    @Override
    public int deleteExpiredOrRevokedBefore(Instant cutoff) {
        int before = byToken.size();
        byToken.values().removeIf(s -> s.getExpiresAt().isBefore(cutoff)
                || (s.getRevokedAt() != null && s.getRevokedAt().isBefore(cutoff)));
        return before - byToken.size();
    }

    /** Test/dev helper; not part of the port. */
    public void clear() {
        byToken.clear();
    }

    private static AuthenticatedSession copy(AuthenticatedSession s) {
        return new AuthenticatedSession(
                s.getId(), s.getClienteId(), s.getRol(), s.getCreatedAt(), s.getExpiresAt(), s.getRevokedAt());
    }
}
