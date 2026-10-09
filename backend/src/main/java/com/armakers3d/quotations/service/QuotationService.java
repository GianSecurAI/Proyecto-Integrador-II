package com.armakers3d.quotations.service;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.repository.OrderRepository;
import com.armakers3d.orders.service.PersonalizedOrderService;
import com.armakers3d.quotations.domain.InvalidQuotationTransitionException;
import com.armakers3d.quotations.domain.Quotation;
import com.armakers3d.quotations.domain.QuotationRules;
import com.armakers3d.quotations.domain.QuotationSearchCriteria;
import com.armakers3d.quotations.domain.QuotationStatus;
import com.armakers3d.quotations.repository.QuotationRepository;
import com.armakers3d.reports.domain.ReportRange;
import com.armakers3d.shared.error.ConflictException;
import com.armakers3d.shared.error.NotFoundException;
import com.armakers3d.shared.error.ValidationFailedException;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import com.armakers3d.users.service.CustomerDirectoryService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Quotations agreed with customers over WhatsApp (RF08, RF09, RF11). Staff register the agreed price (never computed
 * here), move the quotation to its outcome and, once it is accepted and the external payment is confirmed, generate the
 * personalized order from it (RN07, RN08). A quotation generates at most one order.
 */
@Service
public class QuotationService {

    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.quotations");

    /** A quotation with the customer data and the order generated from it (null until there is one). */
    public record QuotationView(
            Quotation quotation, String customerEmail, String customerName, String customerPhone, String orderId) {}

    public record RegisterCommand(
            Long staffId, Rol staffRole, String customerEmail, String description, BigDecimal agreedAmount, String notes) {}

    public record ChangeStatusCommand(
            Long quotationId, QuotationStatus status, String notes, Long staffId, Rol staffRole) {}

    public record GenerateOrderCommand(
            Long quotationId, Boolean paymentConfirmed, Long staffId, String staffEmail, Rol staffRole) {}

    public record Filter(QuotationStatus status, LocalDate from, LocalDate to, String q) {}

    private final QuotationRepository quotations;
    private final OrderRepository orders;
    private final CustomerDirectoryService customers;
    private final PersonalizedOrderService personalizedOrders;
    private final Clock clock;

    public QuotationService(
            QuotationRepository quotations,
            OrderRepository orders,
            CustomerDirectoryService customers,
            PersonalizedOrderService personalizedOrders,
            Clock clock) {
        this.quotations = quotations;
        this.orders = orders;
        this.customers = customers;
        this.personalizedOrders = personalizedOrders;
        this.clock = clock;
    }

    public QuotationView register(RegisterCommand cmd) {
        var valid = QuotationRules.validate(cmd.customerEmail(), cmd.description(), cmd.agreedAmount(), cmd.notes());
        var customer = customers.findOrCreateCustomer(cmd.staffId(), valid.customerEmail());
        Quotation saved = quotations.save(Quotation.register(
                customer.id(), valid.description(), valid.agreedAmount(), valid.notes(), cmd.staffId(), clock.instant()));
        audit.info("quotation.registered actor={} role={} quotation={} customer={}",
                cmd.staffId(), cmd.staffRole(), saved.id(), saved.customerId());
        return view(saved);
    }

    public Page<QuotationView> search(Filter filter, PageRequest pageRequest) {
        Set<Long> ownerIds = new HashSet<>();
        String q = filter.q() == null || filter.q().isBlank() ? null : filter.q().trim();
        if (q != null) {
            ownerIds.addAll(customers.customerIdsByEmailContaining(q));
        }
        ReportRange range = filter.from() == null && filter.to() == null
                ? null
                : ReportRange.resolve(
                        filter.from(), filter.to(), LocalDate.now(clock.withZone(ReportRange.BUSINESS_ZONE)));
        var criteria = new QuotationSearchCriteria(
                filter.status(),
                range == null ? null : range.fromInstant(),
                range == null ? null : range.toExclusiveInstant(),
                q,
                ownerIds);
        Page<Quotation> page = quotations.search(criteria, pageRequest);
        Map<Long, CustomerDirectoryService.ContactView> contacts =
                customers.contactsByIds(page.content().stream().map(Quotation::customerId).toList());
        return page.map(quotation -> toView(quotation, contacts.get(quotation.customerId())));
    }

    public QuotationView get(Long id) {
        return view(load(id));
    }

    public QuotationView changeStatus(ChangeStatusCommand cmd) {
        Quotation current = load(cmd.quotationId());
        Quotation updated = current.withStatus(cmd.status(), QuotationRules.notes(cmd.notes()), clock.instant());
        if (!quotations.replaceIfStatus(updated, current.status())) {
            throw InvalidQuotationTransitionException.concurrentChange();
        }
        audit.info("quotation.status_changed actor={} role={} quotation={} from={} to={}",
                cmd.staffId(), cmd.staffRole(), updated.id(), current.status(), updated.status());
        return view(updated);
    }

    /** RF11: generates the personalized order of an accepted quotation, after the external payment is confirmed. */
    public QuotationView generateOrder(GenerateOrderCommand cmd) {
        Quotation quotation = load(cmd.quotationId());
        if (!Boolean.TRUE.equals(cmd.paymentConfirmed())) {
            throw new ValidationFailedException(
                    "paymentConfirmed", "must be true: the external payment must be confirmed before generating the order");
        }
        if (quotation.status() != QuotationStatus.ACEPTADA) {
            throw new QuotationNotAcceptedException();
        }
        Order order = personalizedOrders.createFromQuotation(
                quotation.id(), quotation.customerId(), quotation.description(), quotation.agreedAmount(),
                cmd.staffId(), cmd.staffRole());
        audit.info("quotation.order_generated actor={} role={} quotation={} order={}",
                cmd.staffId(), cmd.staffRole(), quotation.id(), order.id());
        return view(quotation);
    }

    private Quotation load(Long id) {
        return quotations.findById(id).orElseThrow(() -> new NotFoundException("Quotation not found."));
    }

    private QuotationView view(Quotation quotation) {
        return toView(quotation, customers.contactsByIds(java.util.List.of(quotation.customerId()))
                .get(quotation.customerId()));
    }

    private QuotationView toView(Quotation quotation, CustomerDirectoryService.ContactView contact) {
        Optional<Order> order = orders.findByQuotationId(quotation.id());
        return new QuotationView(
                quotation,
                contact == null ? null : contact.email(),
                contact == null ? null : contact.name(),
                contact == null ? null : contact.phone(),
                order.map(Order::id).orElse(null));
    }

    /** 409: only an accepted quotation can generate an order (RN08). */
    public static class QuotationNotAcceptedException extends ConflictException {
        public QuotationNotAcceptedException() {
            super("QUOTATION_NOT_ACCEPTED", "Only an accepted quotation can generate a personalized order.");
        }
    }
}
