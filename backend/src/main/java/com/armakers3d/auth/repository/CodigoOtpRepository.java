package com.armakers3d.auth.repository;

import com.armakers3d.auth.domain.CodigoOtp;
import com.armakers3d.auth.domain.CodigoOtpStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CodigoOtpRepository extends JpaRepository<CodigoOtp, Long> {

    /**
     * The single row FR-003 says verification must be evaluated against: the most recently
     * issued row for the email, regardless of its current status (an already-VERIFIED or
     * EXPIRED latest row still needs to be found so verify can return the correct rejection
     * reason instead of a generic "no code" answer). Ordered by {@code id} as a secondary key,
     * not just {@code issuedAt}: two codes requested for the same email within the same
     * millisecond would otherwise tie on timestamp alone, making "the newest one" ambiguous —
     * {@code id} (an auto-incrementing surrogate key) is guaranteed monotonic with insertion
     * order and breaks the tie deterministically.
     */
    Optional<CodigoOtp> findFirstByEmailOrderByIssuedAtDescIdDesc(String email);

    /** All still-PENDING rows for an email, superseded whenever a new code is requested (FR-013). */
    List<CodigoOtp> findAllByEmailAndStatus(String email, CodigoOtpStatus status);

    /** Count of codes issued for an email within the throttling window (FR-012). */
    long countByEmailAndIssuedAtAfter(String email, Instant since);
}
