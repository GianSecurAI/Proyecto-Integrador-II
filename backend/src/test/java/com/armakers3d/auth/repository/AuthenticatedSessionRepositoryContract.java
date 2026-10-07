package com.armakers3d.auth.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.armakers3d.auth.domain.AuthenticatedSession;
import com.armakers3d.auth.domain.Rol;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/** Behavior every {@link AuthenticatedSessionRepository} adapter must share (JPA and in-memory). */
abstract class AuthenticatedSessionRepositoryContract {

    private static final Instant T0 = Instant.parse("2026-01-01T10:00:00Z");

    protected abstract AuthenticatedSessionRepository repository();

    /** JPA enforces the cliente foreign key, so each adapter test supplies a real account id. */
    protected abstract Long existingClienteId();

    private AuthenticatedSession session(String token, Rol rol) {
        return new AuthenticatedSession(token, existingClienteId(), rol, T0, T0.plusSeconds(3600));
    }

    @Test
    void saveAndFindByTokenRoundTrip() {
        AuthenticatedSession original = session("tok-contract-1", Rol.CLIENTE);
        repository().save(original);

        AuthenticatedSession found = repository().findById("tok-contract-1").orElseThrow();
        assertThat(found.getClienteId()).isEqualTo(original.getClienteId());
        assertThat(found.getRol()).isEqualTo(Rol.CLIENTE);
        assertThat(found.getCreatedAt()).isEqualTo(T0);
        assertThat(found.getExpiresAt()).isEqualTo(T0.plusSeconds(3600));
        assertThat(found.getRevokedAt()).isNull();
        assertThat(found.isValidAt(T0.plusSeconds(10))).isTrue();
    }

    @Test
    void unknownTokenIsEmpty() {
        assertThat(repository().findById("tok-contract-missing")).isEmpty();
    }

    @Test
    void revocationAndExpiryInvalidateTheSessionAndRevocationIsPersisted() {
        repository().save(session("tok-contract-2", Rol.ADMINISTRADOR));

        AuthenticatedSession loaded = repository().findById("tok-contract-2").orElseThrow();
        assertThat(loaded.isValidAt(T0.plusSeconds(3601))).isFalse();
        loaded.revoke(T0.plusSeconds(5));
        repository().save(loaded);

        AuthenticatedSession reloaded = repository().findById("tok-contract-2").orElseThrow();
        assertThat(reloaded.getRevokedAt()).isEqualTo(T0.plusSeconds(5));
        assertThat(reloaded.isValidAt(T0.plusSeconds(10))).isFalse();
    }

    @Test
    void returnedObjectsAreSnapshotsNotLiveViews() {
        repository().save(session("tok-contract-3", Rol.CLIENTE));

        repository().findById("tok-contract-3").orElseThrow().revoke(T0); // not saved

        assertThat(repository().findById("tok-contract-3").orElseThrow().getRevokedAt()).isNull();
    }

    @Test
    void revokeAllForClienteRevokesOnlyThatAccountsActiveSessions() {
        Long owner = existingClienteId();
        Long other = existingClienteId();
        repository().save(new AuthenticatedSession("tok-rev-a", owner, Rol.CLIENTE, T0, T0.plusSeconds(3600)));
        repository().save(new AuthenticatedSession("tok-rev-b", owner, Rol.CLIENTE, T0, T0.plusSeconds(3600)));
        AuthenticatedSession alreadyRevoked = new AuthenticatedSession("tok-rev-c", owner, Rol.CLIENTE, T0, T0.plusSeconds(3600));
        alreadyRevoked.revoke(T0.plusSeconds(1));
        repository().save(alreadyRevoked);
        repository().save(new AuthenticatedSession("tok-rev-other", other, Rol.CLIENTE, T0, T0.plusSeconds(3600)));

        int revoked = repository().revokeAllForCliente(owner, T0.plusSeconds(60));

        assertThat(revoked).isEqualTo(2);
        assertThat(repository().findById("tok-rev-a").orElseThrow().getRevokedAt()).isEqualTo(T0.plusSeconds(60));
        assertThat(repository().findById("tok-rev-b").orElseThrow().isValidAt(T0.plusSeconds(61))).isFalse();
        assertThat(repository().findById("tok-rev-c").orElseThrow().getRevokedAt()).isEqualTo(T0.plusSeconds(1));
        assertThat(repository().findById("tok-rev-other").orElseThrow().getRevokedAt()).isNull();
        assertThat(repository().revokeAllForCliente(owner, T0.plusSeconds(120))).isZero();
    }
}
