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
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;

/** Port behavior of the in-memory checkout adapter (the contract a JPA adapter must also meet). */
class InMemoryCheckoutRepositoryTest {

    private static final Instant T0 = Instant.parse("2026-10-07T12:00:00Z");
    private final InMemoryCheckoutRepository repo = new InMemoryCheckoutRepository();

    private static Checkout checkout(Long customer, Instant created) {
        return Checkout.awaitingProof(UUID.randomUUID().toString(), customer,
                List.of(new CheckoutLine(1L, "A", new BigDecimal("5.00"), 1)), new DeliveryInfo("Calle 1", "Surco", null),
                new ContactInfo("Ana", "999888777"), created, created.plus(Duration.ofHours(24)));
    }

    private static ProofAttempt proof(String hash) {
        return ProofAttempt.submitted(UUID.randomUUID().toString(), 1, PaymentMethod.YAPE, null, UUID.randomUUID().toString(),
                ProofImageType.JPEG, 10, hash, T0);
    }

    @Test
    void theOpenCapIsPerCustomerAndProofLessCheckoutsStopCountingAfterTheirTtl() {
        for (int i = 0; i < 3; i++) {
            assertThat(repo.insertIfOpenBelow(checkout(1L, T0), 3, T0)).isTrue();
        }
        assertThat(repo.insertIfOpenBelow(checkout(1L, T0), 3, T0)).isFalse();
        assertThat(repo.insertIfOpenBelow(checkout(2L, T0), 3, T0)).isTrue(); // another customer
        Instant later = T0.plus(Duration.ofHours(25));
        assertThat(repo.insertIfOpenBelow(checkout(1L, later), 3, later)).isTrue();
    }

    @Test
    void terminalCheckoutsDoNotCountAndACheckoutWithAProofCountsForever() {
        Checkout a = checkout(1L, T0);
        Checkout b = checkout(1L, T0);
        Checkout c = checkout(1L, T0);
        repo.insertIfOpenBelow(a, 3, T0);
        repo.insertIfOpenBelow(b, 3, T0);
        repo.insertIfOpenBelow(c, 3, T0);
        repo.replaceIfStatus(a.cancelled(), CheckoutStatus.AWAITING_PAYMENT_PROOF);
        repo.replaceIfStatus(b.expired(), CheckoutStatus.AWAITING_PAYMENT_PROOF);
        assertThat(repo.insertIfOpenBelow(checkout(1L, T0), 3, T0)).isTrue();
        assertThat(repo.insertIfOpenBelow(checkout(1L, T0), 3, T0)).isTrue();
        assertThat(repo.insertIfOpenBelow(checkout(1L, T0), 3, T0)).isFalse();

        // 30 days later only c (proof submitted, never expires) is still open: two more fit, the third does not
        repo.replaceIfStatus(c.withProof(proof("h")), CheckoutStatus.AWAITING_PAYMENT_PROOF);
        Instant much = T0.plus(Duration.ofDays(30));
        assertThat(repo.insertIfOpenBelow(checkout(1L, much), 3, much)).isTrue();
        assertThat(repo.insertIfOpenBelow(checkout(1L, much), 3, much)).isTrue();
        assertThat(repo.insertIfOpenBelow(checkout(1L, much), 3, much)).isFalse();
    }

    @Test
    void ofManyConcurrentInsertsForOneCustomerExactlyTheCapSucceed() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(12);
        List<Future<Boolean>> futures = new ArrayList<>();
        for (int i = 0; i < 40; i++) {
            futures.add(pool.submit(() -> repo.insertIfOpenBelow(checkout(9L, T0), 3, T0)));
        }
        int inserted = 0;
        for (Future<Boolean> f : futures) {
            inserted += f.get() ? 1 : 0;
        }
        pool.shutdown();
        assertThat(inserted).isEqualTo(3);
    }

    @Test
    void replaceIfStatusIsACompareAndSet() {
        Checkout c = checkout(1L, T0);
        repo.insertIfOpenBelow(c, 3, T0);
        assertThat(repo.replaceIfStatus(c.expired(), CheckoutStatus.PAID)).isFalse(); // wrong expectation
        assertThat(repo.replaceIfStatus(c.expired(), CheckoutStatus.AWAITING_PAYMENT_PROOF)).isTrue();
        assertThat(repo.replaceIfStatus(c.cancelled(), CheckoutStatus.AWAITING_PAYMENT_PROOF)).isFalse(); // already EXPIRED
        assertThat(repo.findById(c.id()).orElseThrow().status()).isEqualTo(CheckoutStatus.EXPIRED);
        assertThat(repo.replaceIfStatus(checkout(1L, T0), CheckoutStatus.AWAITING_PAYMENT_PROOF)).isFalse(); // unknown id
        assertThat(repo.findById("unknown")).isEmpty();
    }

    @Test
    void ofManyConcurrentProofSubmissionsExactlyOneWins() throws Exception {
        Checkout c = checkout(1L, T0);
        repo.insertIfOpenBelow(c, 3, T0);
        ExecutorService pool = Executors.newFixedThreadPool(8);
        List<Future<Boolean>> futures = new ArrayList<>();
        for (int i = 0; i < 30; i++) {
            futures.add(pool.submit(() -> repo.replaceIfStatus(c.withProof(proof("h")), CheckoutStatus.AWAITING_PAYMENT_PROOF)));
        }
        int winners = 0;
        for (Future<Boolean> f : futures) {
            winners += f.get() ? 1 : 0;
        }
        pool.shutdown();
        assertThat(winners).isEqualTo(1);
        assertThat(repo.findById(c.id()).orElseThrow().attempts()).hasSize(1);
    }

    @Test
    void expiredSearchReturnsOnlyStaleAwaitingAndStatusSearchFilters() {
        Checkout stale = checkout(1L, T0);
        Checkout fresh = checkout(2L, T0.plus(Duration.ofHours(20)));
        Checkout submitted = checkout(3L, T0);
        repo.insertIfOpenBelow(stale, 3, T0);
        repo.insertIfOpenBelow(fresh, 3, T0);
        repo.insertIfOpenBelow(submitted, 3, T0);
        repo.replaceIfStatus(submitted.withProof(proof("h")), CheckoutStatus.AWAITING_PAYMENT_PROOF);
        assertThat(repo.findAwaitingProofExpiredAt(T0.plus(Duration.ofHours(25)))).extracting(Checkout::id).containsExactly(stale.id());
        assertThat(repo.findByStatus(CheckoutStatus.PROOF_SUBMITTED)).extracting(Checkout::id).containsExactly(submitted.id());
    }

    @Test
    void proofHashLookupFindsEveryCheckoutHoldingThatHash() {
        Checkout a = checkout(1L, T0);
        Checkout b = checkout(2L, T0);
        repo.insertIfOpenBelow(a, 3, T0);
        repo.insertIfOpenBelow(b, 3, T0);
        repo.replaceIfStatus(a.withProof(proof("same")), CheckoutStatus.AWAITING_PAYMENT_PROOF);
        repo.replaceIfStatus(b.withProof(proof("same")), CheckoutStatus.AWAITING_PAYMENT_PROOF);
        assertThat(repo.findCheckoutIdsByProofHash("same")).containsExactlyInAnyOrder(a.id(), b.id());
        assertThat(repo.findCheckoutIdsByProofHash("other")).isEmpty();
    }
}
