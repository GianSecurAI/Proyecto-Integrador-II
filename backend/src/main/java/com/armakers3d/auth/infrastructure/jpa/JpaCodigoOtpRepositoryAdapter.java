package com.armakers3d.auth.infrastructure.jpa;

import com.armakers3d.auth.domain.CodigoOtp;
import com.armakers3d.auth.domain.CodigoOtpStatus;
import com.armakers3d.auth.repository.CodigoOtpRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/** Database-backed {@link CodigoOtpRepository}; active in every profile except {@code nodb}. */
@Repository
@Profile("!nodb")
public class JpaCodigoOtpRepositoryAdapter implements CodigoOtpRepository {

    private final CodigoOtpJpaRepository jpa;

    public JpaCodigoOtpRepositoryAdapter(CodigoOtpJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public CodigoOtp save(CodigoOtp c) {
        return toDomain(jpa.save(new CodigoOtpEntity(
                c.getId(),
                c.getEmail(),
                c.getCodeHash(),
                c.getIssuedAt(),
                c.getExpiresAt(),
                c.getUsedAt(),
                c.getAttemptCount(),
                c.getStatus())));
    }

    @Override
    public Optional<CodigoOtp> findLatestByEmail(String email) {
        return jpa.findFirstByEmailOrderByIssuedAtDescIdDesc(email).map(JpaCodigoOtpRepositoryAdapter::toDomain);
    }

    @Override
    public List<CodigoOtp> findByEmailAndStatus(String email, CodigoOtpStatus status) {
        return jpa.findAllByEmailAndStatus(email, status).stream()
                .map(JpaCodigoOtpRepositoryAdapter::toDomain)
                .toList();
    }

    @Override
    public long countIssuedAfter(String email, Instant since) {
        return jpa.countByEmailAndIssuedAtAfter(email, since);
    }

    @Override
    public long sumFailedAttemptsIssuedAfter(String email, Instant since) {
        return jpa.sumFailedAttemptsIssuedAfter(email, since);
    }

    // @Transactional: the bulk UPDATE queries need a transaction; joins the service's when present.
    @Override
    @Transactional
    public int incrementAttemptCount(Long id) {
        jpa.incrementAttemptCount(id);
        return jpa.findAttemptCount(id).orElseThrow();
    }

    @Override
    @Transactional
    public boolean markVerifiedIfPending(Long id, Instant now) {
        return jpa.markVerifiedIfPending(id, now) == 1;
    }

    @Override
    @Transactional
    public int deleteIssuedBefore(Instant cutoff) {
        return jpa.deleteIssuedBefore(cutoff);
    }

    private static CodigoOtp toDomain(CodigoOtpEntity e) {
        return new CodigoOtp(
                e.getId(),
                e.getEmail(),
                e.getCodeHash(),
                e.getIssuedAt(),
                e.getExpiresAt(),
                e.getUsedAt(),
                e.getAttemptCount(),
                e.getStatus());
    }
}
