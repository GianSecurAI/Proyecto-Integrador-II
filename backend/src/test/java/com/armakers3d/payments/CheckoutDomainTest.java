package com.armakers3d.payments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.armakers3d.orders.domain.ContactInfo;
import com.armakers3d.orders.domain.DeliveryInfo;
import com.armakers3d.payments.domain.Checkout;
import com.armakers3d.payments.domain.CheckoutLine;
import com.armakers3d.payments.domain.CheckoutStatus;
import com.armakers3d.payments.domain.PaymentMethod;
import com.armakers3d.payments.domain.ProofAttempt;
import com.armakers3d.payments.domain.ProofDecision;
import com.armakers3d.payments.domain.ProofImageType;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/** Checkout domain rules, plus the module dependency rule: orders never depends on payments (ADR-005). */
class CheckoutDomainTest {

    private static final Instant T0 = Instant.parse("2026-10-07T12:00:00Z");
    private static final String ID = "3f2b8c1e-aaaa-4000-8000-000000000000";

    private static Checkout awaiting() {
        return Checkout.awaitingProof(ID, 1L,
                List.of(new CheckoutLine(1L, "A", new BigDecimal("21.90"), 2), new CheckoutLine(2L, "B", new BigDecimal("14.5"), 3)),
                new DeliveryInfo("Calle 1", "Surco", null), new ContactInfo("Ana", "999888777"), T0, T0.plus(Duration.ofHours(24)));
    }

    private static ProofAttempt proof(int number) {
        return ProofAttempt.submitted("att-" + number, number, PaymentMethod.YAPE, null, "key-" + number, ProofImageType.PNG, 10,
                "hash-" + number, T0);
    }

    @Test
    void theTotalIsDerivedFromTheLinesAndTheReferenceFromTheId() {
        Checkout c = awaiting();
        assertThat(c.total()).isEqualByComparingTo("87.30");
        assertThat(c.lines().get(1).unitPrice().scale()).isEqualTo(2);
        assertThat(c.reference()).isEqualTo("AM3D-3F2B8C1E");
    }

    @Test
    void theStatusMachineAllowsOnlyTheDocumentedTransitions() {
        assertThat(CheckoutStatus.AWAITING_PAYMENT_PROOF.canTransitionTo(CheckoutStatus.PROOF_SUBMITTED)).isTrue();
        assertThat(CheckoutStatus.AWAITING_PAYMENT_PROOF.canTransitionTo(CheckoutStatus.EXPIRED)).isTrue();
        assertThat(CheckoutStatus.AWAITING_PAYMENT_PROOF.canTransitionTo(CheckoutStatus.CANCELLED)).isTrue();
        assertThat(CheckoutStatus.AWAITING_PAYMENT_PROOF.canTransitionTo(CheckoutStatus.PAID)).isFalse(); // no payment without a proof
        assertThat(CheckoutStatus.AWAITING_PAYMENT_PROOF.canTransitionTo(CheckoutStatus.PROOF_REJECTED)).isFalse();
        // once a proof exists the checkout never expires
        assertThat(CheckoutStatus.PROOF_SUBMITTED.canTransitionTo(CheckoutStatus.EXPIRED)).isFalse();
        assertThat(CheckoutStatus.PROOF_REJECTED.canTransitionTo(CheckoutStatus.EXPIRED)).isFalse();
        assertThat(CheckoutStatus.PROOF_SUBMITTED.canTransitionTo(CheckoutStatus.PAID)).isTrue();
        assertThat(CheckoutStatus.PROOF_SUBMITTED.canTransitionTo(CheckoutStatus.PROOF_REJECTED)).isTrue();
        assertThat(CheckoutStatus.PROOF_SUBMITTED.canTransitionTo(CheckoutStatus.CANCELLED)).isTrue();
        assertThat(CheckoutStatus.PROOF_REJECTED.canTransitionTo(CheckoutStatus.PROOF_SUBMITTED)).isTrue();
        assertThat(CheckoutStatus.PROOF_REJECTED.canTransitionTo(CheckoutStatus.CANCELLED)).isTrue();
        assertThat(CheckoutStatus.PROOF_REJECTED.canTransitionTo(CheckoutStatus.PAID)).isFalse();
        for (CheckoutStatus terminal : List.of(CheckoutStatus.PAID, CheckoutStatus.EXPIRED, CheckoutStatus.CANCELLED)) {
            for (CheckoutStatus to : CheckoutStatus.values()) {
                assertThat(terminal.canTransitionTo(to)).as(terminal + " -> " + to).isFalse();
            }
        }
    }

    @Test
    void approvalMarksTheLatestProofAndRecordsTheAdministratorAndIsImmutable() {
        Checkout submitted = awaiting().withProof(proof(1));
        Checkout paid = submitted.approved(9L, T0.plusSeconds(60));
        assertThat(submitted.status()).isEqualTo(CheckoutStatus.PROOF_SUBMITTED); // immutable
        assertThat(paid.status()).isEqualTo(CheckoutStatus.PAID);
        assertThat(paid.approvedBy()).isEqualTo(9L);
        assertThat(paid.paidAt()).isEqualTo(T0.plusSeconds(60));
        assertThat(paid.latestAttempt().orElseThrow().decision()).isEqualTo(ProofDecision.APPROVED);
        assertThat(paid.withOrder("PED-000001").orderId()).isEqualTo("PED-000001");
        assertThatThrownBy(() -> awaiting().withOrder("PED-000001")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(paid::cancelled).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> paid.rejected(9L, "x", T0)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectionKeepsTheHistoryAndAllowsANewProof() {
        Checkout rejected = awaiting().withProof(proof(1)).rejected(9L, "Monto distinto", T0);
        assertThat(rejected.status()).isEqualTo(CheckoutStatus.PROOF_REJECTED);
        assertThat(rejected.latestAttempt().orElseThrow().rejectionReason()).isEqualTo("Monto distinto");
        Checkout again = rejected.withProof(proof(2));
        assertThat(again.status()).isEqualTo(CheckoutStatus.PROOF_SUBMITTED);
        assertThat(again.attempts()).extracting(ProofAttempt::decision).containsExactly(ProofDecision.REJECTED, ProofDecision.PENDING);
    }

    @Test
    void openMeansLiveAndAnAwaitingCheckoutStopsBeingOpenAtItsExpiry() {
        Checkout c = awaiting();
        assertThat(c.isOpen(T0)).isTrue();
        assertThat(c.isOpen(T0.plus(Duration.ofHours(24)))).isFalse();
        assertThat(c.isPastExpiry(T0.plus(Duration.ofHours(24)))).isTrue();
        // with a proof the checkout is open indefinitely and never "past expiry"
        Checkout submitted = c.withProof(proof(1));
        assertThat(submitted.isOpen(T0.plus(Duration.ofDays(30)))).isTrue();
        assertThat(submitted.isPastExpiry(T0.plus(Duration.ofDays(30)))).isFalse();
        assertThat(c.cancelled().isOpen(T0)).isFalse();
        assertThat(submitted.approved(1L, T0).isOpen(T0)).isFalse();
    }

    @Test
    void aCheckoutNeedsAtLeastOneLine() {
        assertThatThrownBy(() -> Checkout.awaitingProof("x", 1L, List.of(), null, null, T0, T0.plusSeconds(1)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void theCheckoutAggregateHoldsNoCardWalletOrEmailFields() {
        List<String> names = Stream.of(Checkout.class.getRecordComponents()).map(rc -> rc.getName().toLowerCase()).toList();
        assertThat(names).noneMatch(n -> n.contains("card") || n.contains("pan") || n.contains("cvv") || n.contains("token")
                || n.contains("secret") || n.contains("email") || n.contains("wallet") || n.contains("provider"));
    }

    @Test
    void theOrdersModuleNeverImportsThePaymentsModule() throws IOException {
        Path ordersMain = Path.of("src/main/java/com/armakers3d/orders");
        try (Stream<Path> files = Files.walk(ordersMain)) {
            List<String> offenders = files.filter(f -> f.toString().endsWith(".java"))
                    .filter(f -> {
                        try {
                            return Files.readString(f).contains("com.armakers3d.payments");
                        } catch (IOException e) {
                            throw new IllegalStateException(e);
                        }
                    })
                    .map(Path::toString)
                    .toList();
            assertThat(offenders).as("orders must not depend on payments").isEmpty();
        }
    }

    @Test
    void noPaymentGatewayCodeOrConfigurationRemains() throws IOException {
        for (String root : List.of("src/main/java", "src/main/resources")) {
            try (Stream<Path> files = Files.walk(Path.of(root))) {
                List<String> offenders = files.filter(Files::isRegularFile)
                        .filter(f -> {
                            try {
                                String text = Files.readString(f).toLowerCase();
                                return text.contains("mercadopago") || text.contains("payment_provider") || text.contains("paymentgateway")
                                        || text.contains("webhook-secret");
                            } catch (IOException e) {
                                throw new IllegalStateException(e);
                            }
                        })
                        .map(Path::toString)
                        .toList();
                assertThat(offenders).as("gateway leftovers under " + root).isEmpty();
            }
        }
    }
}
