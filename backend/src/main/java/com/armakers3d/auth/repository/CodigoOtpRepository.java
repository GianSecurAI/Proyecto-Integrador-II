package com.armakers3d.auth.repository;

import com.armakers3d.auth.domain.CodigoOtp;
import com.armakers3d.auth.domain.CodigoOtpStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Port for one-time-code persistence (backend-foundation.md section 10). Ids are assigned by the
 * adapter on first save. Objects returned are snapshots; changes only take effect through
 * {@link #save} or the two atomic operations below.
 */
public interface CodigoOtpRepository {

    /** Inserts when the id is null, otherwise overwrites the stored row. Returns the stored code. */
    CodigoOtp save(CodigoOtp codigoOtp);

    /**
     * The row FR-003 says verification must be evaluated against: the most recently issued row
     * for the email regardless of its status. Ties on {@code issuedAt} are broken by id so "the
     * newest one" is deterministic.
     */
    Optional<CodigoOtp> findLatestByEmail(String email);

    /** All rows with the given status for an email (used to supersede PENDING rows, FR-013). */
    List<CodigoOtp> findByEmailAndStatus(String email, CodigoOtpStatus status);

    /** Count of codes issued for an email strictly after {@code since} (FR-012). */
    long countIssuedAfter(String email, Instant since);

    /**
     * Total FAILED verification attempts across every code of the email issued strictly after {@code since}
     * (security review M1). The one successful attempt that consumed a VERIFIED code is not a failure, so
     * VERIFIED rows contribute {@code attemptCount - 1}; every other row contributes its whole count.
     */
    long sumFailedAttemptsIssuedAfter(String email, Instant since);

    /**
     * Atomically increments the attempt counter and returns the new value. Atomicity matters:
     * concurrent guesses must each consume one attempt, otherwise a burst of parallel requests
     * could exceed the attempt limit (FR-011).
     */
    int incrementAttemptCount(Long id);

    /**
     * Atomically moves the code from PENDING to VERIFIED, stamping {@code usedAt}. Returns false
     * if it was no longer PENDING, which guarantees single use even under concurrent submission
     * of the correct code (FR-010).
     */
    boolean markVerifiedIfPending(Long id, Instant now);

    /**
     * Deletes every code issued strictly before {@code cutoff} (daily purge, DB-06 / R2). Returns how many rows were
     * removed. Codes older than the cutoff can no longer matter: they are expired, and the throttling windows are
     * far shorter.
     */
    int deleteIssuedBefore(Instant cutoff);
}
