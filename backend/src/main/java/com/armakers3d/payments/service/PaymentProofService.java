package com.armakers3d.payments.service;

import com.armakers3d.payments.config.PaymentsProperties;
import com.armakers3d.payments.domain.Checkout;
import com.armakers3d.payments.domain.CheckoutStatus;
import com.armakers3d.payments.domain.PaymentMethod;
import com.armakers3d.payments.domain.ProofAttempt;
import com.armakers3d.payments.repository.CheckoutRepository;
import com.armakers3d.payments.service.exception.CheckoutStateException;
import com.armakers3d.payments.service.exception.InvalidProofImageException;
import com.armakers3d.payments.service.exception.PayloadTooLargeException;
import com.armakers3d.payments.service.exception.ProofAttemptsExceededException;
import com.armakers3d.payments.service.exception.ProofStorageUnavailableException;
import com.armakers3d.payments.storage.ProofStorage;
import com.armakers3d.payments.storage.ProofStorageException;
import com.armakers3d.shared.error.NotFoundException;
import com.armakers3d.shared.error.ValidationFailedException;
import java.time.Clock;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Receives and serves payment proofs (ADR-005). The upload rules live here and only here: state (a proof is only
 * accepted while AWAITING_PAYMENT_PROOF or PROOF_REJECTED), attempt limit, method and operation-code validation,
 * size limit, content inspection by magic bytes ({@link ProofImageInspector}: the client's Content-Type and file
 * name are never used), random storage key, SHA-256, and a compare-and-set that appends the attempt and moves the
 * checkout to PROOF_SUBMITTED. Two concurrent uploads cannot both win: the loser's stored bytes are removed.
 * Logs carry ids only: never file content, names or the operation code.
 */
@Service
public class PaymentProofService {

    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.payments");
    private static final Pattern OPERATION_CODE = Pattern.compile("^[A-Za-z0-9]{6,20}$");

    /** {@code content} is the raw uploaded file; {@code method} and {@code operationCode} are the raw form fields. */
    public record SubmitProofCommand(Long customerId, String checkoutId, String method, String operationCode, byte[] content) {}

    private final CheckoutService checkoutService;
    private final CheckoutRepository checkouts;
    private final ProofStorage storage;
    private final PaymentsProperties properties;
    private final Clock clock;
    private final ProofImageInspector inspector = new ProofImageInspector();

    public PaymentProofService(
            CheckoutService checkoutService, CheckoutRepository checkouts, ProofStorage storage,
            PaymentsProperties properties, Clock clock) {
        this.checkoutService = checkoutService;
        this.checkouts = checkouts;
        this.storage = storage;
        this.properties = properties;
        this.clock = clock;
    }

    public Checkout submit(SubmitProofCommand cmd) {
        Checkout checkout = checkoutService.findOwned(cmd.customerId(), cmd.checkoutId());
        if (checkout.status() != CheckoutStatus.AWAITING_PAYMENT_PROOF && checkout.status() != CheckoutStatus.PROOF_REJECTED) {
            throw new CheckoutStateException("A payment proof cannot be uploaded for this checkout in its current state.");
        }
        if (checkout.attempts().size() >= properties.getMaxProofAttempts()) {
            throw new ProofAttemptsExceededException();
        }

        PaymentMethod method = parseMethod(cmd.method());
        String operationCode = normalizeOperationCode(cmd.operationCode());
        byte[] content = cmd.content();
        if (content == null || content.length == 0) {
            throw new InvalidProofImageException("The uploaded file is empty.");
        }
        if (content.length > properties.getProof().getMaxBytes()) {
            throw new PayloadTooLargeException();
        }
        ProofImageInspector.Inspected image = inspector.inspect(content);

        String storageKey = UUID.randomUUID().toString();
        try {
            storage.store(checkout.id(), storageKey, content);
        } catch (ProofStorageException ex) {
            audit.error("payment.proof.storage_refused checkout={} reason={}", LogMasks.checkout(checkout.id()), ex.reason());
            throw switch (ex.reason()) {
                case CHECKOUT_CAPACITY -> new PayloadTooLargeException();
                case TOTAL_CAPACITY, DUPLICATE_KEY -> new ProofStorageUnavailableException();
            };
        }

        ProofAttempt attempt = ProofAttempt.submitted(
                UUID.randomUUID().toString(), checkout.attempts().size() + 1, method, operationCode, storageKey,
                image.type(), content.length, image.sha256(), clock.instant());
        Checkout updated = checkout.withProof(attempt);
        if (!checkouts.replaceIfStatus(updated, checkout.status())) {
            storage.delete(storageKey); // a concurrent upload, decision or cancellation won: leave no orphan bytes
            throw new CheckoutStateException("A payment proof cannot be uploaded for this checkout in its current state.");
        }
        boolean duplicate = checkouts.findCheckoutIdsByProofHash(image.sha256()).stream().anyMatch(id -> !id.equals(checkout.id()));
        audit.info("payment.proof.submitted actor={} checkout={} attempt={} number={} type={} bytes={} duplicate={}",
                cmd.customerId(), LogMasks.checkout(checkout.id()), attempt.id(), attempt.number(), image.type(),
                content.length, duplicate);
        return updated;
    }

    /** Owner-only: the bytes of one of the customer's own proofs. Unknown checkout/attempt/key is a 404. */
    public ProofContent contentForOwner(Long customerId, String checkoutId, String attemptId) {
        return content(checkoutService.findOwned(customerId, checkoutId), attemptId);
    }

    /** Shared by the owner and the administrator paths: resolves the attempt of an already authorized checkout. */
    ProofContent content(Checkout checkout, String attemptId) {
        ProofAttempt attempt = checkout.attempt(attemptId).orElseThrow(() -> new NotFoundException("Payment proof not found."));
        byte[] bytes = storage.load(attempt.storageKey()).orElseThrow(() -> new NotFoundException("Payment proof not found."));
        return new ProofContent(bytes, attempt.type());
    }

    private static PaymentMethod parseMethod(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ValidationFailedException("method", "is required (YAPE or PLIN)");
        }
        try {
            return PaymentMethod.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ValidationFailedException("method", "must be YAPE or PLIN");
        }
    }

    private static String normalizeOperationCode(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String code = raw.trim();
        if (!OPERATION_CODE.matcher(code).matches()) {
            throw new ValidationFailedException("operationCode", "must be 6 to 20 letters or digits");
        }
        return code;
    }
}
