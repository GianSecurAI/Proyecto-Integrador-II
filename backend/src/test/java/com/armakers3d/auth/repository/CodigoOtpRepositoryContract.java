package com.armakers3d.auth.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.armakers3d.auth.domain.CodigoOtp;
import com.armakers3d.auth.domain.CodigoOtpStatus;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/** Behavior every {@link CodigoOtpRepository} adapter must share (JPA and in-memory). */
abstract class CodigoOtpRepositoryContract {

    private static final Instant T0 = Instant.parse("2026-01-01T10:00:00Z");

    protected abstract CodigoOtpRepository repository();

    private CodigoOtp newCode(String email, Instant issuedAt) {
        return new CodigoOtp(email, "$2a$hash", issuedAt, issuedAt.plusSeconds(600));
    }

    @Test
    void saveAssignsIdAndStartsPendingWithZeroAttempts() {
        CodigoOtp saved = repository().save(newCode("otp-a@example.test", T0));

        assertThat(saved.getId()).isNotNull();
        CodigoOtp found = repository().findLatestByEmail("otp-a@example.test").orElseThrow();
        assertThat(found.getStatus()).isEqualTo(CodigoOtpStatus.PENDING);
        assertThat(found.getAttemptCount()).isZero();
        assertThat(found.getCodeHash()).isEqualTo("$2a$hash");
        assertThat(found.getIssuedAt()).isEqualTo(T0);
        assertThat(found.getExpiresAt()).isEqualTo(T0.plusSeconds(600));
        assertThat(found.getUsedAt()).isNull();
    }

    @Test
    void latestIsNewestByIssuedAtThenByInsertionOrder() {
        repository().save(newCode("otp-latest@example.test", T0));
        CodigoOtp tieOlder = repository().save(newCode("otp-latest@example.test", T0.plusSeconds(5)));
        CodigoOtp tieNewer = repository().save(newCode("otp-latest@example.test", T0.plusSeconds(5)));

        assertThat(repository().findLatestByEmail("otp-latest@example.test").orElseThrow().getId())
                .isEqualTo(tieNewer.getId())
                .isNotEqualTo(tieOlder.getId());
        assertThat(repository().findLatestByEmail("otp-nobody@example.test")).isEmpty();
    }

    @Test
    void findByEmailAndStatusAndSaveUpdateSupportSupersedingPendingCodes() {
        repository().save(newCode("otp-sup@example.test", T0));
        repository().save(newCode("otp-sup@example.test", T0.plusSeconds(1)));
        repository().save(newCode("otp-other@example.test", T0));

        var pending = repository().findByEmailAndStatus("otp-sup@example.test", CodigoOtpStatus.PENDING);
        assertThat(pending).hasSize(2);
        pending.forEach(c -> {
            c.markSuperseded();
            repository().save(c);
        });

        assertThat(repository().findByEmailAndStatus("otp-sup@example.test", CodigoOtpStatus.PENDING)).isEmpty();
        assertThat(repository().findByEmailAndStatus("otp-sup@example.test", CodigoOtpStatus.SUPERSEDED))
                .hasSize(2);
        assertThat(repository().findByEmailAndStatus("otp-other@example.test", CodigoOtpStatus.PENDING))
                .hasSize(1);
    }

    @Test
    void countIssuedAfterIsStrictAndPerEmail() {
        repository().save(newCode("otp-count@example.test", T0));
        repository().save(newCode("otp-count@example.test", T0.plusSeconds(60)));
        repository().save(newCode("otp-count-other@example.test", T0.plusSeconds(60)));

        assertThat(repository().countIssuedAfter("otp-count@example.test", T0.minusSeconds(1))).isEqualTo(2);
        assertThat(repository().countIssuedAfter("otp-count@example.test", T0)).isEqualTo(1);
        assertThat(repository().countIssuedAfter("otp-count@example.test", T0.plusSeconds(60))).isZero();
    }

    @Test
    void incrementAttemptCountReturnsTheNewValueAndPersists() {
        CodigoOtp saved = repository().save(newCode("otp-inc@example.test", T0));

        assertThat(repository().incrementAttemptCount(saved.getId())).isEqualTo(1);
        assertThat(repository().incrementAttemptCount(saved.getId())).isEqualTo(2);
        assertThat(repository().findLatestByEmail("otp-inc@example.test").orElseThrow().getAttemptCount())
                .isEqualTo(2);
    }

    @Test
    void markVerifiedIfPendingSucceedsExactlyOnce() {
        CodigoOtp saved = repository().save(newCode("otp-ver@example.test", T0));
        Instant usedAt = T0.plusSeconds(30);

        assertThat(repository().markVerifiedIfPending(saved.getId(), usedAt)).isTrue();
        assertThat(repository().markVerifiedIfPending(saved.getId(), usedAt)).isFalse();

        CodigoOtp found = repository().findLatestByEmail("otp-ver@example.test").orElseThrow();
        assertThat(found.getStatus()).isEqualTo(CodigoOtpStatus.VERIFIED);
        assertThat(found.getUsedAt()).isEqualTo(usedAt);
    }

    @Test
    void markVerifiedIfPendingRefusesNonPendingCodes() {
        CodigoOtp saved = repository().save(newCode("otp-ver2@example.test", T0));
        saved.markExpired();
        repository().save(saved);

        assertThat(repository().markVerifiedIfPending(saved.getId(), T0)).isFalse();
        assertThat(repository().findLatestByEmail("otp-ver2@example.test").orElseThrow().getStatus())
                .isEqualTo(CodigoOtpStatus.EXPIRED);
    }

    @Test
    void returnedObjectsAreSnapshotsNotLiveViews() {
        CodigoOtp saved = repository().save(newCode("otp-snap@example.test", T0));
        CodigoOtp loaded = repository().findLatestByEmail("otp-snap@example.test").orElseThrow();

        loaded.markExpired(); // not saved

        assertThat(repository().findLatestByEmail("otp-snap@example.test").orElseThrow().getStatus())
                .isEqualTo(CodigoOtpStatus.PENDING);
        assertThat(saved.getStatus()).isEqualTo(CodigoOtpStatus.PENDING);
    }

    @Test
    void sumFailedAttemptsCountsFailuresAcrossCodesWithinTheWindowAndNotTheSuccessfulOne() {
        String email = "otp-sum@example.test";
        CodigoOtp first = repository().save(newCode(email, T0));
        repository().incrementAttemptCount(first.getId());
        repository().incrementAttemptCount(first.getId());
        CodigoOtp second = repository().save(newCode(email, T0.plusSeconds(60)));
        repository().incrementAttemptCount(second.getId());
        repository().markVerifiedIfPending(second.getId(), T0.plusSeconds(61)); // 1 attempt = the success, 0 failures
        CodigoOtp old = repository().save(newCode(email, T0.minusSeconds(7200)));
        repository().incrementAttemptCount(old.getId());
        repository().save(newCode("otp-sum-other@example.test", T0));

        assertThat(repository().sumFailedAttemptsIssuedAfter(email, T0.minusSeconds(3600))).isEqualTo(2);
        assertThat(repository().sumFailedAttemptsIssuedAfter(email, T0.minusSeconds(86400))).isEqualTo(3);
        assertThat(repository().sumFailedAttemptsIssuedAfter(email, T0.plusSeconds(3600))).isZero();
        assertThat(repository().sumFailedAttemptsIssuedAfter("otp-nobody@example.test", T0.minusSeconds(3600))).isZero();
    }

    @Test
    void purgeDeletesOnlyCodesIssuedBeforeTheCutoff() {
        repository().deleteIssuedBefore(T0.plusSeconds(86_400)); // clear rows other committed tests may have left
        repository().save(newCode("otp-purge@example.test", T0));
        repository().save(newCode("otp-purge@example.test", T0.plusSeconds(10)));
        CodigoOtp kept = repository().save(newCode("otp-purge@example.test", T0.plusSeconds(100_000)));

        assertThat(repository().deleteIssuedBefore(T0.plusSeconds(86_400))).isEqualTo(2);

        assertThat(repository().findLatestByEmail("otp-purge@example.test").orElseThrow().getId()).isEqualTo(kept.getId());
        assertThat(repository().countIssuedAfter("otp-purge@example.test", T0.minusSeconds(1))).isEqualTo(1);
        assertThat(repository().deleteIssuedBefore(T0.plusSeconds(86_400))).isZero();
    }
}
