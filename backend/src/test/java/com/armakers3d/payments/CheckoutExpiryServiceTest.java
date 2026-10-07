package com.armakers3d.payments;

import static org.assertj.core.api.Assertions.assertThat;

import com.armakers3d.orders.domain.ContactInfo;
import com.armakers3d.orders.domain.DeliveryInfo;
import com.armakers3d.payments.domain.Checkout;
import com.armakers3d.payments.domain.CheckoutLine;
import com.armakers3d.payments.domain.CheckoutStatus;
import com.armakers3d.payments.domain.PaymentMethod;
import com.armakers3d.payments.domain.ProofAttempt;
import com.armakers3d.payments.domain.ProofImageType;
import com.armakers3d.payments.infrastructure.inmemory.InMemoryCheckoutRepository;
import com.armakers3d.payments.service.CheckoutExpiryService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Expiry with a fixed clock: only a proof-less AWAITING_PAYMENT_PROOF checkout older than 24 h expires. */
class CheckoutExpiryServiceTest {

    private static final Instant T0 = Instant.parse("2026-10-07T12:00:00Z");
    private static final Duration TTL = Duration.ofHours(24);

    private final InMemoryCheckoutRepository repo = new InMemoryCheckoutRepository();

    private Checkout awaiting(String id, Instant created) {
        Checkout c = Checkout.awaitingProof(id, 1L, List.of(new CheckoutLine(1L, "A", new BigDecimal("5.00"), 1)),
                new DeliveryInfo("Calle 1", "Surco", null), new ContactInfo("Ana", "999888777"), created, created.plus(TTL));
        repo.insertIfOpenBelow(c, 100, created);
        return c;
    }

    private static ProofAttempt proof() {
        return ProofAttempt.submitted("a1", 1, PaymentMethod.PLIN, null, "k1", ProofImageType.PNG, 5, "h", T0);
    }

    private CheckoutExpiryService serviceAt(Instant now) {
        return new CheckoutExpiryService(repo, Clock.fixed(now, ZoneOffset.UTC));
    }

    @Test
    void aStaleAwaitingCheckoutExpiresAndAFreshOneDoesNot() {
        awaiting("stale", T0);
        awaiting("fresh", T0.plus(Duration.ofHours(20)));

        int expired = serviceAt(T0.plus(Duration.ofHours(25))).expireStale();

        assertThat(expired).isEqualTo(1);
        assertThat(repo.findById("stale").orElseThrow().status()).isEqualTo(CheckoutStatus.EXPIRED);
        assertThat(repo.findById("fresh").orElseThrow().status()).isEqualTo(CheckoutStatus.AWAITING_PAYMENT_PROOF);
    }

    @Test
    void theBoundaryIsInclusiveAtTheExpiryInstant() {
        awaiting("edge", T0);
        assertThat(serviceAt(T0.plus(TTL).minusSeconds(1)).expireStale()).isZero();
        assertThat(serviceAt(T0.plus(TTL)).expireStale()).isEqualTo(1);
    }

    @Test
    void aCheckoutWithAProofNeverExpiresWhateverItsAge() {
        Checkout submitted = awaiting("submitted", T0);
        repo.replaceIfStatus(submitted.withProof(proof()), CheckoutStatus.AWAITING_PAYMENT_PROOF);
        Checkout rejected = awaiting("rejected", T0);
        Checkout withProof = rejected.withProof(proof());
        repo.replaceIfStatus(withProof, CheckoutStatus.AWAITING_PAYMENT_PROOF);
        repo.replaceIfStatus(withProof.rejected(9L, "no", T0), CheckoutStatus.PROOF_SUBMITTED);

        assertThat(serviceAt(T0.plus(Duration.ofDays(60))).expireStale()).isZero();

        assertThat(repo.findById("submitted").orElseThrow().status()).isEqualTo(CheckoutStatus.PROOF_SUBMITTED);
        assertThat(repo.findById("rejected").orElseThrow().status()).isEqualTo(CheckoutStatus.PROOF_REJECTED);
    }

    @Test
    void terminalCheckoutsNeverChangeAndRunningTwiceIsIdempotent() {
        Checkout cancelled = awaiting("cancelled", T0);
        repo.replaceIfStatus(cancelled.cancelled(), CheckoutStatus.AWAITING_PAYMENT_PROOF);
        awaiting("stale", T0);

        CheckoutExpiryService service = serviceAt(T0.plus(Duration.ofDays(5)));
        assertThat(service.expireStale()).isEqualTo(1);
        assertThat(service.expireStale()).isZero();
        assertThat(repo.findById("cancelled").orElseThrow().status()).isEqualTo(CheckoutStatus.CANCELLED);
    }

    @Test
    void theLazyCheckNeverOverwritesAProofSubmittedAtTheLastMoment() {
        Checkout stale = awaiting("race", T0);
        // the customer uploads a proof between the read and the expiry write
        repo.replaceIfStatus(stale.withProof(proof()), CheckoutStatus.AWAITING_PAYMENT_PROOF);

        Checkout result = serviceAt(T0.plus(Duration.ofHours(30))).expireIfDue(stale);

        assertThat(result.status()).isEqualTo(CheckoutStatus.PROOF_SUBMITTED);
    }
}
