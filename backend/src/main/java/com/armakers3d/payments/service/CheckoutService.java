package com.armakers3d.payments.service;

import com.armakers3d.catalog.service.CatalogService;
import com.armakers3d.orders.domain.ContactInfo;
import com.armakers3d.orders.domain.DeliveryInfo;
import com.armakers3d.orders.domain.OrderRules;
import com.armakers3d.orders.domain.RequestedItem;
import com.armakers3d.orders.domain.ValidatedOrder;
import com.armakers3d.orders.repository.IdempotencyStore;
import com.armakers3d.orders.service.IdempotencyKeys;
import com.armakers3d.orders.service.exception.IdempotencyKeyReusedException;
import com.armakers3d.orders.service.exception.ProductUnavailableException;
import com.armakers3d.payments.config.PaymentsProperties;
import com.armakers3d.payments.domain.Checkout;
import com.armakers3d.payments.domain.CheckoutLine;
import com.armakers3d.payments.domain.CheckoutStatus;
import com.armakers3d.payments.repository.CheckoutRepository;
import com.armakers3d.payments.service.exception.CheckoutStateException;
import com.armakers3d.shared.error.ApiError;
import com.armakers3d.shared.error.ConflictException;
import com.armakers3d.shared.error.NotFoundException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Customer side of the standard catalog checkout (CLAUDE.md standard flow steps 3-4, ADR-005): validates the
 * request, re-reads every product from the catalog (business rule 9), snapshots title and unit price SERVER-side,
 * computes the total and enforces the open-checkout cap. The customer then pays by Yape/Plin outside the system and
 * uploads a proof ({@link PaymentProofService}); the order is NOT created here but only when an administrator
 * approves ({@link PaymentVerificationService}). The client sends product ids, quantities, delivery and contact:
 * never a price, total, status or customer id (the owner is the authenticated principal).
 */
@Service
public class CheckoutService {

    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.payments");
    /** Keys of this flow are namespaced so they can never collide with the order flows sharing the store. */
    private static final String KEY_NAMESPACE = "checkout:";

    /** {@code customerId} comes from the principal. {@code idempotencyKey} is null when absent. */
    public record CreateCheckoutCommand(
            Long customerId,
            String idempotencyKey,
            List<RequestedItem> items,
            DeliveryInfo delivery,
            ContactInfo contact) {}

    public record CreatedCheckout(Checkout checkout, boolean replayed) {}

    private final CheckoutRepository checkouts;
    private final IdempotencyStore idempotency;
    private final CatalogService catalog;
    private final CheckoutExpiryService expiry;
    private final PaymentsProperties properties;
    private final Clock clock;

    public CheckoutService(
            CheckoutRepository checkouts, IdempotencyStore idempotency, CatalogService catalog,
            CheckoutExpiryService expiry, PaymentsProperties properties, Clock clock) {
        this.checkouts = checkouts;
        this.idempotency = idempotency;
        this.catalog = catalog;
        this.expiry = expiry;
        this.properties = properties;
        this.clock = clock;
    }

    public CreatedCheckout create(CreateCheckoutCommand command) {
        String key = IdempotencyKeys.normalize(command.idempotencyKey());
        ValidatedOrder validated = OrderRules.validate(command.items(), command.delivery(), command.contact());

        if (key == null) {
            return new CreatedCheckout(createNew(command, validated), false);
        }
        var result = idempotency.executeOnce(
                command.customerId(),
                KEY_NAMESPACE + key,
                validated.fingerprint(),
                clock.instant(),
                OrderRules.IDEMPOTENCY_TTL,
                () -> createNew(command, validated).id());
        return switch (result.outcome()) {
            case CREATED -> new CreatedCheckout(load(result.orderId()), false);
            case REPLAYED -> {
                Checkout original = load(result.orderId());
                audit.info("checkout.create.replayed actor={} checkout={}", command.customerId(), LogMasks.checkout(original.id()));
                yield new CreatedCheckout(original, true);
            }
            case MISMATCH -> {
                audit.warn("checkout.create.key_reused actor={}", command.customerId());
                throw new IdempotencyKeyReusedException();
            }
        };
    }

    /**
     * Owner-only read. Unknown, malformed and not-owned ids are the same 404. Applies the lazy expiry, so the answer
     * is right even if the expiry job has not run yet. Used by every customer operation on a checkout.
     */
    public Checkout findOwned(Long customerId, String checkoutId) {
        Checkout checkout = CheckoutIds.parse(checkoutId)
                .flatMap(checkouts::findById)
                .filter(c -> c.belongsTo(customerId))
                .orElseThrow(() -> new NotFoundException("Checkout not found."));
        return expiry.expireIfDue(checkout);
    }

    /** Customer cancellation before PAID. Idempotent on an already CANCELLED checkout; PAID or EXPIRED is a 409. */
    public Checkout cancel(Long customerId, String checkoutId) {
        Checkout current = findOwned(customerId, checkoutId);
        if (current.status() == CheckoutStatus.CANCELLED) {
            return current;
        }
        if (!current.status().canTransitionTo(CheckoutStatus.CANCELLED)) {
            throw new CheckoutStateException("This checkout can no longer be cancelled.");
        }
        if (!checkouts.replaceIfStatus(current.cancelled(), current.status())) {
            // Lost a race (an administrator decided, or a second cancel): re-read and answer from the real state.
            Checkout now = checkouts.findById(current.id()).orElse(current);
            if (now.status() == CheckoutStatus.CANCELLED) {
                return now;
            }
            throw new CheckoutStateException("This checkout can no longer be cancelled.");
        }
        audit.info("checkout.cancelled actor={} checkout={} from={}", customerId, LogMasks.checkout(current.id()), current.status());
        return checkouts.findById(current.id()).orElseThrow();
    }

    private Checkout createNew(CreateCheckoutCommand command, ValidatedOrder validated) {
        List<CheckoutLine> lines = new ArrayList<>();
        List<ApiError.FieldError> unavailable = new ArrayList<>();
        List<RequestedItem> items = validated.items();
        for (int i = 0; i < items.size(); i++) {
            RequestedItem item = items.get(i);
            var product = catalog.findOrderable(item.productId());
            if (product.isEmpty()) {
                unavailable.add(new ApiError.FieldError("items[" + i + "].productId", "product is not available"));
            } else {
                var p = product.get();
                lines.add(new CheckoutLine(p.id(), p.title(), p.unitPrice(), item.quantity()));
            }
        }
        if (!unavailable.isEmpty()) {
            throw new ProductUnavailableException(unavailable);
        }

        Instant now = clock.instant();
        Checkout created = Checkout.awaitingProof(
                UUID.randomUUID().toString(), command.customerId(), lines, validated.delivery(), validated.contact(), now,
                now.plus(Duration.ofHours(properties.getCheckoutTtlHours())));
        if (!checkouts.insertIfOpenBelow(created, properties.getMaxOpenCheckouts(), now)) {
            audit.warn("checkout.create.too_many_open actor={}", command.customerId());
            throw new ConflictException("Too many checkouts are open. Complete, cancel or wait for them to expire.");
        }
        // Ids and counts only: no name, phone, address, notes or amount in logs.
        audit.info("checkout.created actor={} checkout={} lines={} units={}", command.customerId(),
                LogMasks.checkout(created.id()), created.lines().size(),
                created.lines().stream().mapToInt(CheckoutLine::quantity).sum());
        return created;
    }

    private Checkout load(String checkoutId) {
        return checkouts.findById(checkoutId)
                .orElseThrow(() -> new IllegalStateException("Idempotent checkout vanished"));
    }
}
