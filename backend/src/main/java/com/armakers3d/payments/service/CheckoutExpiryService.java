package com.armakers3d.payments.service;

import com.armakers3d.payments.domain.Checkout;
import com.armakers3d.payments.domain.CheckoutStatus;
import com.armakers3d.payments.repository.CheckoutRepository;
import java.time.Clock;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * The single place a checkout becomes EXPIRED (ADR-005): the scheduled job calls {@link #expireStale()} and a
 * customer read calls {@link #expireIfDue} (lazy check, so the answer is right even between job runs). ONLY an
 * AWAITING_PAYMENT_PROOF checkout past its 24 h changes: as soon as a proof exists (PROOF_SUBMITTED, PROOF_REJECTED)
 * the checkout does not expire and the administrator must resolve it. The change is a compare-and-set, so it can
 * never overwrite a proof submitted at the last moment.
 */
@Service
public class CheckoutExpiryService {

    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.payments");

    private final CheckoutRepository checkouts;
    private final Clock clock;

    public CheckoutExpiryService(CheckoutRepository checkouts, Clock clock) {
        this.checkouts = checkouts;
        this.clock = clock;
    }

    /** Expires every stale AWAITING_PAYMENT_PROOF checkout; returns how many changed. Logs masked ids only. */
    public int expireStale() {
        Instant now = clock.instant();
        int expired = 0;
        for (Checkout stale : checkouts.findAwaitingProofExpiredAt(now)) {
            if (checkouts.replaceIfStatus(stale.expired(), CheckoutStatus.AWAITING_PAYMENT_PROOF)) {
                audit.info("checkout.expired checkout={} source=job", LogMasks.checkout(stale.id()));
                expired++;
            }
        }
        return expired;
    }

    /** Lazy variant for one checkout; returns the checkout as it is afterwards. */
    public Checkout expireIfDue(Checkout checkout) {
        if (!checkout.isPastExpiry(clock.instant())) {
            return checkout;
        }
        if (checkouts.replaceIfStatus(checkout.expired(), CheckoutStatus.AWAITING_PAYMENT_PROOF)) {
            audit.info("checkout.expired checkout={} source=read", LogMasks.checkout(checkout.id()));
        }
        return checkouts.findById(checkout.id()).orElse(checkout);
    }
}
