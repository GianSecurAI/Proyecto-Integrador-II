package com.armakers3d.orders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.orders.domain.ContactInfo;
import com.armakers3d.orders.domain.DeliveryInfo;
import com.armakers3d.orders.domain.InvalidStatusTransitionException;
import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderLine;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.orders.domain.StatusHistoryEntry;
import com.armakers3d.shared.error.ValidationFailedException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * Domain-level transition rules. The allowed table is written out here independently from the
 * production code, straight from docs/architecture/order-lifecycle.md section 3; every other
 * from-to pair (25 pairs in total) must be rejected.
 */
class OrderTransitionTest {

    private static final Instant T0 = Instant.parse("2026-10-06T10:00:00Z");
    private static final Instant T1 = Instant.parse("2026-10-06T11:00:00Z");

    /** order-lifecycle.md section 3, verbatim. */
    private static final Map<OrderStatus, List<OrderStatus>> DOC_TABLE = Map.of(
            OrderStatus.CONFIRMADO, List.of(OrderStatus.EN_PRODUCCION, OrderStatus.CANCELADO),
            OrderStatus.EN_PRODUCCION, List.of(OrderStatus.ENVIADO, OrderStatus.CANCELADO),
            OrderStatus.ENVIADO, List.of(OrderStatus.ENTREGADO),
            OrderStatus.ENTREGADO, List.of(),
            OrderStatus.CANCELADO, List.of());

    /** An order in an arbitrary status (history is not walked: the domain only checks the current status). */
    static Order orderIn(OrderStatus status) {
        Order base = Order.placeStandard(
                "PED-000001", 7L, List.of(new OrderLine(1L, "A", new BigDecimal("2.00"), 1)),
                new DeliveryInfo("Calle 1", "Surco", null), new ContactInfo("Ana", "999888777"), T0);
        return new Order(base.id(), base.customerId(), base.kind(), status, base.lines(), base.delivery(),
                base.contact(), base.createdAt(), null, base.history());
    }

    static Stream<Arguments> allowed() {
        List<Arguments> args = new ArrayList<>();
        DOC_TABLE.forEach((from, tos) -> tos.forEach(to -> args.add(Arguments.of(from, to))));
        return args.stream();
    }

    static Stream<Arguments> rejected() {
        List<Arguments> args = new ArrayList<>();
        for (OrderStatus from : OrderStatus.values()) {
            for (OrderStatus to : OrderStatus.values()) {
                if (!DOC_TABLE.get(from).contains(to)) {
                    args.add(Arguments.of(from, to));
                }
            }
        }
        return args.stream();
    }

    @Test
    void theTableCoversEveryFiveByFivePairExactlyOnce() {
        assertThat(allowed().count() + rejected().count()).isEqualTo(25);
        assertThat(allowed().count()).isEqualTo(5);
        assertThat(rejected().count()).isEqualTo(20);
    }

    @ParameterizedTest(name = "{0} -> {1} is allowed")
    @MethodSource("allowed")
    void everyDocumentedTransitionIsAllowedAndAppendsOneHistoryEntry(OrderStatus from, OrderStatus to) {
        Order before = orderIn(from);

        Order after = before.transitionTo(to, 42L, Rol.ASESOR, "  listo  ", T1);

        assertThat(after.status()).isEqualTo(to);
        assertThat(after.history()).hasSize(before.history().size() + 1);
        StatusHistoryEntry entry = after.history().get(after.history().size() - 1);
        assertThat(entry).isEqualTo(new StatusHistoryEntry(from, to, 42L, Rol.ASESOR, T1, "listo"));
        // Immutability: the original order and its history are untouched; everything else is carried over.
        assertThat(before.status()).isEqualTo(from);
        assertThat(before.history()).hasSize(1);
        assertThat(after.id()).isEqualTo(before.id());
        assertThat(after.lines()).isEqualTo(before.lines());
        assertThat(after.createdAt()).isEqualTo(before.createdAt());
        assertThat(after.history().subList(0, before.history().size())).isEqualTo(before.history());
    }

    @ParameterizedTest(name = "{0} -> {1} is rejected")
    @MethodSource("rejected")
    void everyOtherPairIsRejectedWithoutChangingTheOrder(OrderStatus from, OrderStatus to) {
        Order before = orderIn(from);

        assertThatThrownBy(() -> before.transitionTo(to, 42L, Rol.ADMINISTRADOR, null, T1))
                .isInstanceOf(InvalidStatusTransitionException.class)
                .satisfies(e -> {
                    var ex = (InvalidStatusTransitionException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("INVALID_STATUS_TRANSITION");
                    assertThat(ex.getStatus().value()).isEqualTo(409);
                });
        assertThat(before.status()).isEqualTo(from);
        assertThat(before.history()).hasSize(1);
    }

    @Test
    void theEnumTableMatchesTheDocument() {
        for (OrderStatus s : OrderStatus.values()) {
            assertThat(s.allowedNext()).as(s.name()).containsExactlyInAnyOrderElementsOf(DOC_TABLE.get(s));
        }
        assertThat(OrderStatus.ENTREGADO.isTerminal()).isTrue();
        assertThat(OrderStatus.CANCELADO.isTerminal()).isTrue();
        assertThat(OrderStatus.values()).hasSize(5);
        assertThat(OrderStatus.CONFIRMADO.canTransitionTo(null)).isFalse();
    }

    @Test
    void skippingAndCancellingAfterShipmentAreIllegal() {
        assertThat(OrderStatus.CONFIRMADO.canTransitionTo(OrderStatus.ENVIADO)).isFalse();
        assertThat(OrderStatus.ENVIADO.canTransitionTo(OrderStatus.CANCELADO)).isFalse();
        assertThatThrownBy(() -> orderIn(OrderStatus.CONFIRMADO).transitionTo(OrderStatus.ENVIADO, 1L, Rol.ASESOR, null, T1))
                .isInstanceOf(InvalidStatusTransitionException.class);
        assertThatThrownBy(() -> orderIn(OrderStatus.ENVIADO).transitionTo(OrderStatus.CANCELADO, 1L, Rol.ASESOR, null, T1))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void aNullTargetIsRejected() {
        assertThatThrownBy(() -> orderIn(OrderStatus.CONFIRMADO).transitionTo(null, 1L, Rol.ASESOR, null, T1))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void creationWritesTheInitialHistoryEntryForBothFlows() {
        Order standard = orderIn(OrderStatus.CONFIRMADO);
        assertThat(standard.history()).containsExactly(
                new StatusHistoryEntry(null, OrderStatus.CONFIRMADO, 7L, Rol.CLIENTE, T0, null));

        Order personalized = Order.registerPersonalized(
                "PED-000002", 7L, 99L, Rol.ASESOR, "Figura", new BigDecimal("10.00"), T0);
        assertThat(personalized.history()).containsExactly(
                new StatusHistoryEntry(null, OrderStatus.CONFIRMADO, 99L, Rol.ASESOR, T0, null));
    }

    @Test
    void historyStaysOrderedAcrossAWalkThroughTheWholeLifecycle() {
        Order o = orderIn(OrderStatus.CONFIRMADO);
        OrderStatus[] path = {OrderStatus.EN_PRODUCCION, OrderStatus.ENVIADO, OrderStatus.ENTREGADO};
        Instant t = T0;
        for (OrderStatus next : path) {
            t = t.plusSeconds(60);
            o = o.transitionTo(next, 5L, Rol.ASESOR, null, t);
        }
        assertThat(o.history()).extracting(StatusHistoryEntry::toStatus).containsExactly(
                OrderStatus.CONFIRMADO, OrderStatus.EN_PRODUCCION, OrderStatus.ENVIADO, OrderStatus.ENTREGADO);
        assertThat(o.history()).extracting(StatusHistoryEntry::fromStatus).containsExactly(
                null, OrderStatus.CONFIRMADO, OrderStatus.EN_PRODUCCION, OrderStatus.ENVIADO);
        assertThat(o.history()).extracting(StatusHistoryEntry::at).isSorted();
        assertThat(o.history().get(o.history().size() - 1).toStatus()).isEqualTo(o.status());
    }

    @Test
    void noteIsTrimmedBlankBecomesNullAndLimitsApply() {
        Order o = orderIn(OrderStatus.CONFIRMADO);
        assertThat(o.transitionTo(OrderStatus.EN_PRODUCCION, 1L, Rol.ASESOR, "   ", T1).history().get(1).note()).isNull();
        assertThat(o.transitionTo(OrderStatus.EN_PRODUCCION, 1L, Rol.ASESOR, null, T1).history().get(1).note()).isNull();
        assertThat(o.transitionTo(OrderStatus.EN_PRODUCCION, 1L, Rol.ASESOR, "x".repeat(500), T1).history().get(1).note())
                .hasSize(500);
        assertThatThrownBy(() -> o.transitionTo(OrderStatus.EN_PRODUCCION, 1L, Rol.ASESOR, "x".repeat(501), T1))
                .isInstanceOf(ValidationFailedException.class);
        assertThatThrownBy(() -> o.transitionTo(OrderStatus.EN_PRODUCCION, 1L, Rol.ASESOR, "bad\u0000note", T1))
                .isInstanceOf(ValidationFailedException.class);
    }

    @Test
    void anInvalidTransitionIsCheckedBeforeTheNote() {
        // The status is the first rule: an illegal change never reports a note problem instead.
        assertThatThrownBy(() -> orderIn(OrderStatus.ENTREGADO)
                        .transitionTo(OrderStatus.EN_PRODUCCION, 1L, Rol.ASESOR, "x".repeat(501), T1))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }
}
