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

    @Test
    void purgeDeletesOnlySessionsExpiredOrRevokedBeforeTheCutoff() {
        Long owner = existingClienteId();
        Instant cutoff = T0.plusSeconds(100_000);
        repository().deleteExpiredOrRevokedBefore(cutoff); // clear rows other committed tests may have left
        // expired long ago -> deleted
        repository().save(new AuthenticatedSession("tok-purge-expired", owner, Rol.CLIENTE, T0, T0.plusSeconds(3600)));
        // revoked long ago, still nominally unexpired -> deleted
        AuthenticatedSession revoked = new AuthenticatedSession("tok-purge-revoked", owner, Rol.CLIENTE, T0, cutoff.plusSeconds(9999));
        revoked.revoke(T0.plusSeconds(10));
        repository().save(revoked);
        // revoked after the cutoff and active ones -> kept
        AuthenticatedSession revokedRecently = new AuthenticatedSession("tok-purge-recent", owner, Rol.CLIENTE, T0, cutoff.plusSeconds(9999));
        revokedRecently.revoke(cutoff.plusSeconds(1));
        repository().save(revokedRecently);
        repository().save(new AuthenticatedSession("tok-purge-active", owner, Rol.CLIENTE, T0, cutoff.plusSeconds(9999)));

        assertThat(repository().deleteExpiredOrRevokedBefore(cutoff)).isEqualTo(2);

        assertThat(repository().findById("tok-purge-expired")).isEmpty();
        assertThat(repository().findById("tok-purge-revoked")).isEmpty();
        assertThat(repository().findById("tok-purge-recent")).isPresent();
        assertThat(repository().findById("tok-purge-active")).isPresent();
        assertThat(repository().deleteExpiredOrRevokedBefore(cutoff)).isZero();
    }
}
