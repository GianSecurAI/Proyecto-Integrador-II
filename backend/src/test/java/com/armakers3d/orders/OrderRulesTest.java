package com.armakers3d.orders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;

import com.armakers3d.orders.domain.ContactInfo;
import com.armakers3d.orders.domain.DeliveryInfo;
import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderLine;
import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderRules;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.orders.domain.RequestedItem;
import com.armakers3d.shared.error.HasFieldErrors;
import com.armakers3d.shared.error.ValidationFailedException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Domain rules without Spring: rounding, totals, initial status, validation and fingerprint. */
class OrderRulesTest {

    private static final DeliveryInfo DELIVERY = new DeliveryInfo("Calle 1", "Surco", null);
    private static final ContactInfo CONTACT = new ContactInfo("Ana Perez", "999888777");

    private static List<String> errorFields(List<RequestedItem> items, DeliveryInfo d, ContactInfo c) {
        Throwable thrown = catchThrowable(() -> OrderRules.validate(items, d, c));
        assertThat(thrown).isInstanceOf(ValidationFailedException.class);
        return ((HasFieldErrors) thrown).getFieldErrors().stream().map(e -> e.field()).toList();
    }

    @Test
    void unitPriceIsRoundedHalfUpToTwoDecimalsAndLineTotalToo() {
        OrderLine line = new OrderLine(1L, "X", new BigDecimal("10.005"), 3);
        assertThat(line.unitPrice()).isEqualTo(new BigDecimal("10.01"));
        assertThat(line.lineTotal()).isEqualTo(new BigDecimal("30.03"));
        assertThat(new OrderLine(1L, "X", new BigDecimal("10.004"), 1).unitPrice()).isEqualTo(new BigDecimal("10.00"));
    }

    @Test
    void totalIsTheSumOfRoundedLineTotalsWithScaleTwo() {
        var lines = List.of(
                new OrderLine(1L, "A", new BigDecimal("0.125"), 3), // 0.13 * 3 = 0.39
                new OrderLine(2L, "B", new BigDecimal("2.5"), 2), // 5.00
                new OrderLine(3L, "C", new BigDecimal("19.99"), 99)); // 1979.01
        Order order = Order.placeStandard("PED-000001", 7L, lines, DELIVERY, CONTACT, Instant.EPOCH);
        assertThat(order.total()).isEqualTo(new BigDecimal("1984.40"));
        assertThat(order.total().scale()).isEqualTo(2);
        assertThat(order.totalUnits()).isEqualTo(104);
    }

    @Test
    void aNewStandardOrderStartsPendienteAndEstandar() {
        Order order = Order.placeStandard(
                "PED-000001", 7L, List.of(new OrderLine(1L, "A", BigDecimal.ONE, 1)), DELIVERY, CONTACT, Instant.EPOCH);
        assertThat(order.status()).isEqualTo(OrderStatus.PENDIENTE);
        assertThat(order.kind()).isEqualTo(OrderKind.ESTANDAR);
        assertThat(order.belongsTo(7L)).isTrue();
        assertThat(order.belongsTo(8L)).isFalse();
    }

    @Test
    void anOrderWithoutLinesCannotBeBuilt() {
        assertThatThrownBy(() -> Order.placeStandard("PED-000001", 7L, List.of(), DELIVERY, CONTACT, Instant.EPOCH))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void validateTrimsAndAcceptsBoundaryQuantities() {
        var validated = OrderRules.validate(
                List.of(new RequestedItem(1L, 1), new RequestedItem(2L, 99)),
                new DeliveryInfo("  Calle 1 ", " Surco ", "  "),
                new ContactInfo(" Ana ", " 999888777 "));
        assertThat(validated.delivery()).isEqualTo(new DeliveryInfo("Calle 1", "Surco", null));
        assertThat(validated.contact()).isEqualTo(new ContactInfo("Ana", "999888777"));
    }

    @Test
    void validateReportsEveryProblemAtOnce() {
        var items = new ArrayList<RequestedItem>();
        items.add(new RequestedItem(1L, 0));
        items.add(new RequestedItem(1L, 100));
        items.add(new RequestedItem(null, 5));
        items.add(null);
        List<String> fields = errorFields(items, new DeliveryInfo(" ", "Surco", null), new ContactInfo("Ana", "x"));
        assertThat(fields).contains(
                "items[0].quantity", "items[1].productId", "items[1].quantity", "items[2].productId", "items[3]",
                "delivery.address", "contact.phone");
    }

    @Test
    void validateRejectsEmptyAndOversizedItemLists() {
        assertThat(errorFields(List.of(), DELIVERY, CONTACT)).containsExactly("items");
        var many = new ArrayList<RequestedItem>();
        for (long i = 1; i <= OrderRules.ITEMS_MAX + 1; i++) {
            many.add(new RequestedItem(i, 1));
        }
        assertThat(errorFields(many, DELIVERY, CONTACT)).containsExactly("items");
    }

    @Test
    void validateRejectsControlCharactersButAllowsLineBreaksInNotes() {
        assertThat(errorFields(List.of(new RequestedItem(1L, 1)), new DeliveryInfo("a\tb", "Surco", null), CONTACT))
                .containsExactly("delivery.address");
        assertThat(errorFields(List.of(new RequestedItem(1L, 1)), new DeliveryInfo("a", "Surco", "x\u0000y"), CONTACT))
                .containsExactly("delivery.notes");
        var ok = OrderRules.validate(List.of(new RequestedItem(1L, 1)), new DeliveryInfo("a", "Surco", "line1\nline2"), CONTACT);
        assertThat(ok.delivery().notes()).isEqualTo("line1\nline2");
    }

    @Test
    void fingerprintIgnoresLineOrderButNotContent() {
        var a = OrderRules.validate(List.of(new RequestedItem(1L, 1), new RequestedItem(2L, 2)), DELIVERY, CONTACT);
        var reordered = OrderRules.validate(List.of(new RequestedItem(2L, 2), new RequestedItem(1L, 1)), DELIVERY, CONTACT);
        var otherQty = OrderRules.validate(List.of(new RequestedItem(1L, 1), new RequestedItem(2L, 3)), DELIVERY, CONTACT);
        var otherAddress = OrderRules.validate(
                List.of(new RequestedItem(1L, 1), new RequestedItem(2L, 2)), new DeliveryInfo("Calle 2", "Surco", null), CONTACT);
        // Field boundary shifting must not collide: ("ab","c") vs ("a","bc").
        var split1 = OrderRules.validate(List.of(new RequestedItem(1L, 1)), new DeliveryInfo("ab", "c", null), CONTACT);
        var split2 = OrderRules.validate(List.of(new RequestedItem(1L, 1)), new DeliveryInfo("a", "bc", null), CONTACT);

        assertThat(reordered.fingerprint()).isEqualTo(a.fingerprint());
        assertThat(otherQty.fingerprint()).isNotEqualTo(a.fingerprint());
        assertThat(otherAddress.fingerprint()).isNotEqualTo(a.fingerprint());
        assertThat(split1.fingerprint()).isNotEqualTo(split2.fingerprint());
    }
}
