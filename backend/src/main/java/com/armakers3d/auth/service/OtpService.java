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
import com.armakers3d.shared.notification.EmailDeliveryException;
import com.armakers3d.shared.notification.EmailSender;
import com.armakers3d.shared.util.EmailAddress;
import com.armakers3d.auth.domain.AccountCreatedEvent;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.locks.ReentrantLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
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
    private final ApplicationEventPublisher events;
    private final SecureRandom secureRandom = new SecureRandom();

    // BCrypt is used purely as an adaptive one-way hash for the 6-digit code (research.md #2) —
    // not as a "password" mechanism; Constitution Principle VI still holds (no password auth for
    // customers). It is reused here because spring-security-crypto already provides a
    // well-reviewed adaptive hash implementation, avoiding a bespoke KDF implementation
    // (Principle II: no new mechanism without justification).
    private final PasswordEncoder codeEncoder = new BCryptPasswordEncoder();

    /**
     * Hash compared against when no code exists for the email, so that "never requested a code" costs the
     * same BCrypt work as "wrong code" (security review M6, timing oracle). Not derived from any secret.
     */
    private final String dummyHash = codeEncoder.encode("000000");

    /**
     * Per-email critical section for issuance (security review M4): count-then-insert is not atomic, so
     * parallel requests could each pass the throttle and exceed the limit (or leave two PENDING codes).
     * Striped by email hash; deliberately held OUTSIDE any transaction (see requestOtp) so a waiter always
     * sees the previous holder's committed row. In-process, hence single-instance only, like the other
     * in-memory guards; a multi-instance deployment needs a database-level guard.
     */
    private final ReentrantLock[] issueLocks = newLocks(64);

    public OtpService(
            ClienteRepository clienteRepository,
            CodigoOtpRepository codigoOtpRepository,
            EmailSender emailSender,
            Clock clock,
            OtpPolicyProperties policy,
            ApplicationEventPublisher events) {
        this.clienteRepository = clienteRepository;
        this.codigoOtpRepository = codigoOtpRepository;
        this.emailSender = emailSender;
        this.clock = clock;
        this.policy = policy;
        this.events = events;
    }

    /** The outcome of a successful verification, handed to the controller to build the session. */
    public record VerificationResult(Cliente cliente, boolean accountJustCreated) {}

    /**
     * FR-001, FR-002, FR-004, FR-012, FR-013: issues a new code and always behaves identically
     * regardless of whether the email is already registered. Never throws for "email not
     * registered" — throttling is the only rejection reason, and it must use the exact same
     * exception/wording an existing-email throttle would (FR-004 extends to the throttled case).
     *
     * <p>Not {@code @Transactional} on purpose (M4): the per-email lock must be taken and released
     * outside any transaction, otherwise the lock could be released before the insert commits and the
     * next request would still count the old state. Each repository call commits on its own, which is
     * safe here (a failure between superseding and saving only leaves the older code superseded).
     * The email is sent after the lock is released so a slow SMTP server cannot stall other requests.
     */
    public void requestOtp(String rawEmail) {
        requestOtp(rawEmail, null);
    }

    public void requestOtp(String rawEmail, CodigoOtp.RegistrationProfile registrationProfile) {
        String email = normalize(rawEmail);
        Instant now = clock.instant();
        String masked = EmailAddress.mask(email);

        String code = generateCode();
        String codeHash = codeEncoder.encode(code);

        ReentrantLock lock = issueLocks[Math.floorMod(email.hashCode(), issueLocks.length)];
        lock.lock();
        try {
            long recentRequests =
                    codigoOtpRepository.countIssuedAfter(
                            email, now.minus(Duration.ofMinutes(policy.getRequestWindowMinutes())));
            if (recentRequests >= policy.getMaxRequestsPerWindow()) {
                log.info("otp.request.throttled email={}", masked);
                throw new OtpRequestThrottledException();
            }
            superseceExistingPendingCodes(email);
            codigoOtpRepository.save(
                    new CodigoOtp(
                            email,
                            codeHash,
                            now,
                            now.plus(Duration.ofMinutes(policy.getExpiryMinutes())),
                            registrationProfile));
        } finally {
            lock.unlock();
        }

        // FR-002/FR-017: the plaintext code is used only transiently, for hashing and for the
        // outbound email body — it is never logged and never persisted in reversible form.
        try {
            emailSender.send(
                    email,
                    "Your Ar Makers 3D verification code",
                    "Your one-time code is " + code + ". It expires in " + policy.getExpiryMinutes() + " minutes.");
        } catch (EmailDeliveryException ex) {
            // The response stays the generic acknowledgment (no delivery diagnostics, spec Edge Cases);
            // only the class is logged because the body carries the code (FR-002/FR-017).
            log.warn("Email dispatch failed ({}); caller response remains generic.", ex.getClass().getSimpleName());
        }

        log.info("otp.request.issued email={}", masked);
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
        String masked = EmailAddress.mask(email);
        Instant now = clock.instant();

        // M1: cumulative failed-attempt cap per email across ALL recent codes, checked before anything else
        // so a fresh code cannot be used to reset the guess budget. Locks even the correct code.
        long recentFailures = codigoOtpRepository.sumFailedAttemptsIssuedAfter(
                email, now.minus(Duration.ofMinutes(policy.getFailedAttemptsWindowMinutes())));
        if (recentFailures >= policy.getMaxFailedAttemptsPerEmail()) {
            log.info("otp.verify.lockout email={} reason=cumulative_failures", masked);
            throw new OtpAttemptLimitExceededException();
        }

        CodigoOtp codigoOtp = codigoOtpRepository.findLatestByEmail(email).orElse(null);
        if (codigoOtp == null) {
            // M6: same BCrypt cost as a wrong code, so response time does not reveal "no code was ever requested".
            codeEncoder.matches(submittedCode, dummyHash);
            log.info("otp.verify.failed email={} reason=no_code_issued", masked);
            throw new InvalidOtpCodeException();
        }

        if (codigoOtp.getStatus() == CodigoOtpStatus.VERIFIED) {
            log.info("otp.verify.failed email={} reason=already_used", masked);
            throw new OtpAlreadyUsedException();
        }
        if (codigoOtp.getStatus() == CodigoOtpStatus.SUPERSEDED) {
            // Defense in depth: under the normal flow the latest row for an email is never
            // SUPERSEDED (only older rows are, by requestOtp) — a superseded code submitted by a
            // user compares against the *newer* latest row instead and naturally falls through
            // to the hash-mismatch branch below. This guard only protects against a future bug
            // that might load the wrong row.
            log.info("otp.verify.failed email={} reason=superseded", masked);
            throw new OtpExpiredException();
        }
        if (codigoOtp.getStatus() == CodigoOtpStatus.PENDING && codigoOtp.isExpiredAt(now)) {
            codigoOtp.markExpired();
            codigoOtpRepository.save(codigoOtp);
            log.info("otp.verify.failed email={} reason=expired", masked);
            throw new OtpExpiredException();
        }
        if (codigoOtp.getStatus() == CodigoOtpStatus.EXPIRED) {
            log.info("otp.verify.failed email={} reason=expired", masked);
            throw new OtpExpiredException();
        }

        // FR-011: every submission consumes one attempt atomically BEFORE the code is compared, so
        // parallel guesses cannot exceed the limit. The attempt that *reaches* the limit still
        // gets its true rejection reason (401); only the *next* one is blocked outright (429),
        // matching contracts/otp-auth-api.md. The correct code is also refused once locked out.
        int attemptNumber = codigoOtpRepository.incrementAttemptCount(codigoOtp.getId());
        if (attemptNumber > policy.getMaxAttempts()) {
            log.info("otp.verify.lockout email={}", masked);
            throw new OtpAttemptLimitExceededException();
        }

        boolean matches = codeEncoder.matches(submittedCode, codigoOtp.getCodeHash());
        if (!matches) {
            log.info("otp.verify.failed email={} reason=invalid_code attemptCount={}", masked, attemptNumber);
            throw new InvalidOtpCodeException();
        }

        // FR-010: the code is consumed (VERIFIED, terminally unusable) before anything else is
        // evaluated, via an atomic PENDING->VERIFIED transition so that two concurrent
        // submissions of the correct code cannot both succeed. A deactivated account still
        // consumes the code; it must not remain replayable.
        if (!codigoOtpRepository.markVerifiedIfPending(codigoOtp.getId(), now)) {
            log.info("otp.verify.failed email={} reason=already_used", masked);
            throw new OtpAlreadyUsedException();
        }

        Cliente cliente = clienteRepository.findByEmail(email).orElse(null);
        boolean accountJustCreated = cliente == null;
        if (cliente == null) {
            cliente = clienteRepository.save(new Cliente(email, now));
            events.publishEvent(new AccountCreatedEvent(cliente.getId(), codigoOtp.getRegistrationProfile()));
        } else if (!cliente.isActive()) {
            log.info("otp.verify.failed email={} reason=account_deactivated", masked);
            throw new AccountDeactivatedException();
        }

        log.info(
                "otp.verify.success email={} accountStatus={}",
                masked,
                accountJustCreated ? "created" : "existing");
        return new VerificationResult(cliente, accountJustCreated);
    }

    private void superseceExistingPendingCodes(String email) {
        List<CodigoOtp> pending = codigoOtpRepository.findByEmailAndStatus(email, CodigoOtpStatus.PENDING);
        for (CodigoOtp existing : pending) {
            existing.markSuperseded();
            codigoOtpRepository.save(existing);
        }
    }

    private static ReentrantLock[] newLocks(int n) {
        ReentrantLock[] locks = new ReentrantLock[n];
        for (int i = 0; i < n; i++) {
            locks[i] = new ReentrantLock();
        }
        return locks;
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
        return EmailAddress.normalize(email);
    }
}
