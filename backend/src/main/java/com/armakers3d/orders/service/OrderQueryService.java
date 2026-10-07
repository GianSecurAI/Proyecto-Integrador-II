package com.armakers3d.orders.service;

import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderSearchCriteria;
import com.armakers3d.orders.domain.OrderSort;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.orders.domain.StatusHistoryEntry;
import com.armakers3d.orders.repository.OrderRepository;
import com.armakers3d.shared.error.NotFoundException;
import com.armakers3d.shared.error.ValidationFailedException;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import com.armakers3d.users.service.CustomerDirectoryService;
import com.armakers3d.users.service.CustomerDirectoryService.ContactView;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Read side of orders (contract E20, E21, E24, E25). Object-level rule (Principle VII, contract 4.0):
 * a customer only ever reaches orders whose owner is the authenticated account; an order that is
 * unknown and an order owned by someone else produce the SAME {@code 404 NOT_FOUND}, so existence
 * cannot be probed. Staff (role checked by the central matrix) see every order. There is no public
 * tracking: tracking is the owner detail (D-07 recommendation, see order-lifecycle.md).
 */
@Service
public class OrderQueryService {

    /** Contract 4.0: filter dates are calendar days in America/Lima. */
    static final ZoneId BUSINESS_ZONE = ZoneId.of("America/Lima");

    public record CustomerFilter(OrderStatus status, OrderKind kind) {}

    public record StaffFilter(String q, OrderStatus status, OrderKind kind, LocalDate from, LocalDate to) {}

    /** An order with the staff-only data around it: owner contact and the emails of the history actors. */
    public record StaffOrderView(Order order, ContactView customer, Map<Long, String> actorEmails) {}

    private final OrderRepository orders;
    private final CustomerDirectoryService directory;

    public OrderQueryService(OrderRepository orders, CustomerDirectoryService directory) {
        this.orders = orders;
        this.directory = directory;
    }

    public Page<Order> listForCustomer(Long customerId, CustomerFilter filter, String sort, PageRequest page) {
        var criteria = new OrderSearchCriteria(customerId, filter.status(), filter.kind(), null, null, null, null);
        return orders.search(criteria, OrderSort.parse(sort), page);
    }

    /** Unknown id and not-owned id are indistinguishable by design. */
    public Order getForCustomer(Long customerId, String orderId) {
        return orders.findById(orderId)
                .filter(o -> o.belongsTo(customerId))
                .orElseThrow(() -> new NotFoundException("Order not found."));
    }

    public Page<StaffOrderView> listForStaff(StaffFilter filter, String sort, PageRequest page) {
        requireSaneYear("from", filter.from());
        requireSaneYear("to", filter.to());
        if (filter.from() != null && filter.to() != null && filter.from().isAfter(filter.to())) {
            throw new ValidationFailedException("from", "must not be after to");
        }
        String q = filter.q() == null || filter.q().isBlank() ? null : filter.q().trim();
        Set<Long> ownerIds = q == null ? null : directory.customerIdsByEmailContaining(q);
        Instant from = filter.from() == null ? null : filter.from().atStartOfDay(BUSINESS_ZONE).toInstant();
        Instant toExclusive =
                filter.to() == null ? null : filter.to().plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant();
        var criteria = new OrderSearchCriteria(null, filter.status(), filter.kind(), from, toExclusive, q, ownerIds);
        Page<Order> found = orders.search(criteria, OrderSort.parse(sort), page);
        Map<Long, ContactView> contacts =
                directory.contactsByIds(found.content().stream().map(Order::customerId).toList());
        return found.map(o -> new StaffOrderView(o, contacts.get(o.customerId()), Map.of()));
    }

    /** An absurd year would overflow when the exclusive end bound is built (was a 500). */
    private static void requireSaneYear(String field, LocalDate value) {
        if (value != null && (value.getYear() < 2000 || value.getYear() > 2999)) {
            throw new ValidationFailedException(field, "year must be between 2000 and 2999");
        }
    }

    public StaffOrderView getForStaff(String orderId) {
        Order order = orders.findById(orderId).orElseThrow(() -> new NotFoundException("Order not found."));
        return staffView(order);
    }

    /** Builds the staff view of an order (owner contact + history actor emails). */
    StaffOrderView staffView(Order order) {
        Set<Long> ids = new HashSet<>();
        ids.add(order.customerId());
        order.history().stream().map(StatusHistoryEntry::actorId).filter(java.util.Objects::nonNull).forEach(ids::add);
        Map<Long, ContactView> contacts = directory.contactsByIds(List.copyOf(ids));
        Map<Long, String> emails = new java.util.HashMap<>();
        contacts.forEach((id, c) -> emails.put(id, c.email()));
        return new StaffOrderView(order, contacts.get(order.customerId()), emails);
    }
}
