package com.armakers3d.auth.service;

import com.armakers3d.auth.config.OtpPolicyProperties;
import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.CodigoOtp;
import com.armakers3d.auth.domain.CodigoOtpStatus;
import com.armakers3d.auth.repository.ClienteRepository;
import com.armakers3d.auth.repository.CodigoOtpRepository;
import com.armakers3d.auth.service.exception.AccountDeactivatedException;
import com.armakers3d.auth.service.exception.InvalidOtpCodeException;
import com.armakers3d.auth.service.exception.OtpAlreadyUsedException;
import com.armakers3d.auth.service.exception.OtpAttemptLimitExceededException;
import com.armakers3d.auth.service.exception.OtpExpiredException;
import com.armakers3d.auth.service.exception.OtpRequestThrottledException;
import com.armakers3d.shared.error.ApiException;
import com.armakers3d.shared.notification.EmailSender;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Owns every OTP business rule: issuance, throttling, verification, expiry/single-use/attempt
 * enforcement, and account creation-on-first-verification. This is the single place these rules
 * live (Prohibited Practices #3) — controllers only translate this service's outcomes into HTTP
 * responses.
 */
@Service
public class OtpService {

    private static final Logger log = LoggerFactory.getLogger(OtpService.class);
    private static final int CODE_DIGITS = 6;
    private static final int CODE_MODULUS = 1_000_000;

    private final ClienteRepository clienteRepository;
    private final CodigoOtpRepository codigoOtpRepository;
    private final EmailSender emailSender;
    private final Clock clock;
    private final OtpPolicyProperties policy;
    private final SecureRandom secureRandom = new SecureRandom();

    // BCrypt is used purely as an adaptive one-way hash for the 6-digit code (research.md #2) —
    // not as a "password" mechanism; Constitution Principle VI still holds (no password auth for
    // customers). It is reused here because spring-security-crypto already provides a
    // well-reviewed adaptive hash implementation, avoiding a bespoke KDF implementation
    // (Principle II: no new mechanism without justification).
    private final PasswordEncoder codeEncoder = new BCryptPasswordEncoder();

    public OtpService(
            ClienteRepository clienteRepository,
            CodigoOtpRepository codigoOtpRepository,
            EmailSender emailSender,
            Clock clock,
            OtpPolicyProperties policy) {
        this.clienteRepository = clienteRepository;
        this.codigoOtpRepository = codigoOtpRepository;
        this.emailSender = emailSender;
        this.clock = clock;
        this.policy = policy;
    }

    /** The outcome of a successful verification, handed to the controller to build the session. */
    public record VerificationResult(Cliente cliente, boolean accountJustCreated) {}

    /**
     * FR-001, FR-002, FR-004, FR-012, FR-013: issues a new code and always behaves identically
     * regardless of whether the email is already registered. Never throws for "email not
     * registered" — throttling is the only rejection reason, and it must use the exact same
     * exception/wording an existing-email throttle would (FR-004 extends to the throttled case).
     */
    @Transactional
    public void requestOtp(String rawEmail) {
        String email = normalize(rawEmail);
        Instant now = clock.instant();

        long recentRequests =
                codigoOtpRepository.countByEmailAndIssuedAtAfter(
                        email, now.minus(Duration.ofMinutes(policy.getRequestWindowMinutes())));
        if (recentRequests >= policy.getMaxRequestsPerWindow()) {
            log.info("otp.request.throttled email={}", email);
            throw new OtpRequestThrottledException();
        }

        superseceExistingPendingCodes(email);

        String code = generateCode();
        String codeHash = codeEncoder.encode(code);
        CodigoOtp codigoOtp =
                new CodigoOtp(email, codeHash, now, now.plus(Duration.ofMinutes(policy.getExpiryMinutes())));
        codigoOtpRepository.save(codigoOtp);

        // FR-002/FR-017: the plaintext code is used only transiently, for hashing and for the
        // outbound email body — it is never logged and never persisted in reversible form.
        emailSender.send(
                email,
                "Your Ar Makers 3D verification code",
                "Your one-time code is " + code + ". It expires in " + policy.getExpiryMinutes() + " minutes.");

        log.info("otp.request.issued email={}", email);
    }

    /**
     * FR-003, FR-004a, FR-005–FR-011, FR-015: verifies a code against the most recently issued
     * row for the email and, on success, creates the Cliente if needed.
     *
     * <p>{@code noRollbackFor = ApiException.class} is deliberate and load-bearing, not
     * cosmetic: every rejection branch below (invalid code, expired, attempt-limit reached) is
     * itself an {@code ApiException} thrown *after* a mutation this method needs committed (the
     * incremented {@code attemptCount}, or the lazy PENDING-&gt;EXPIRED transition). Spring's
     * default behavior rolls back the whole transaction on any unchecked exception, which would
     * silently discard every failed-attempt counter increment — defeating FR-011's attempt limit
     * entirely (a real bug caught by this feature's own T019/attempt-limit tests during
     * implementation, not a hypothetical).
     */
    @Transactional(noRollbackFor = ApiException.class)
    public VerificationResult verifyOtp(String rawEmail, String submittedCode) {
        String email = normalize(rawEmail);
        Instant now = clock.instant();

        CodigoOtp codigoOtp =
                codigoOtpRepository
                        .findFirstByEmailOrderByIssuedAtDescIdDesc(email)
                        .orElseThrow(
                                () -> {
                                    log.info("otp.verify.failed email={} reason=no_code_issued", email);
                                    return new InvalidOtpCodeException();
                                });

        if (codigoOtp.getStatus() == CodigoOtpStatus.VERIFIED) {
            log.info("otp.verify.failed email={} reason=already_used", email);
            throw new OtpAlreadyUsedException();
        }
        if (codigoOtp.getStatus() == CodigoOtpStatus.SUPERSEDED) {
            // Defense in depth: under the normal flow the latest row for an email is never
            // SUPERSEDED (only older rows are, by requestOtp) — a superseded code submitted by a
            // user compares against the *newer* latest row instead and naturally falls through
            // to the hash-mismatch branch below. This guard only protects against a future bug
            // that might load the wrong row.
            log.info("otp.verify.failed email={} reason=superseded", email);
            throw new OtpExpiredException();
        }
        if (codigoOtp.getStatus() == CodigoOtpStatus.PENDING && codigoOtp.isExpiredAt(now)) {
            codigoOtp.markExpired();
            codigoOtpRepository.save(codigoOtp);
            log.info("otp.verify.failed email={} reason=expired", email);
            throw new OtpExpiredException();
        }
        if (codigoOtp.getStatus() == CodigoOtpStatus.EXPIRED) {
            log.info("otp.verify.failed email={} reason=expired", email);
            throw new OtpExpiredException();
        }

        // FR-011: the limit check happens before comparing this submission's code, so the attempt
        // that *reaches* the limit still gets its true rejection reason (401), and only the
        // *next* one is blocked outright (429) — matching contracts/otp-auth-api.md.
        if (codigoOtp.getAttemptCount() >= policy.getMaxAttempts()) {
            log.info("otp.verify.lockout email={}", email);
            throw new OtpAttemptLimitExceededException();
        }

        boolean matches = codeEncoder.matches(submittedCode, codigoOtp.getCodeHash());
        if (!matches) {
            codigoOtp.incrementAttemptCount();
            codigoOtpRepository.save(codigoOtp);
            log.info("otp.verify.failed email={} reason=invalid_code attemptCount={}", email, codigoOtp.getAttemptCount());
            throw new InvalidOtpCodeException();
        }

        // FR-010: mark VERIFIED (and therefore terminally unusable) before evaluating anything
        // else, so the code is single-use regardless of what happens next (e.g. a deactivated
        // account still consumes the code; it must not remain replayable).
        codigoOtp.markVerified(now);
        codigoOtpRepository.save(codigoOtp);

        Cliente cliente = clienteRepository.findByEmail(email).orElse(null);
        boolean accountJustCreated = cliente == null;
        if (cliente == null) {
            cliente = clienteRepository.save(new Cliente(email, now));
        } else if (!cliente.isActive()) {
            log.info("otp.verify.failed email={} reason=account_deactivated", email);
            throw new AccountDeactivatedException();
        }

        log.info(
                "otp.verify.success email={} accountStatus={}",
                email,
                accountJustCreated ? "created" : "existing");
        return new VerificationResult(cliente, accountJustCreated);
    }

    private void superseceExistingPendingCodes(String email) {
        List<CodigoOtp> pending = codigoOtpRepository.findAllByEmailAndStatus(email, CodigoOtpStatus.PENDING);
        for (CodigoOtp existing : pending) {
            existing.markSuperseded();
        }
        codigoOtpRepository.saveAll(pending);
    }

    private String generateCode() {
        int value = secureRandom.nextInt(CODE_MODULUS);
        return String.format(Locale.ROOT, "%0" + CODE_DIGITS + "d", value);
    }

    /**
     * Case-insensitive email matching (data-model.md) is implemented by normalizing to
     * lower-case at every read/write boundary in this one place, rather than duplicating
     * case-folding logic in repository queries or the database schema (Prohibited Practices #3).
     */
    private String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
