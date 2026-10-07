package com.armakers3d.payments.mapper;

import com.armakers3d.orders.domain.ContactInfo;
import com.armakers3d.orders.domain.DeliveryInfo;
import com.armakers3d.orders.domain.RequestedItem;
import com.armakers3d.payments.domain.Checkout;
import com.armakers3d.payments.domain.CheckoutStatus;
import com.armakers3d.payments.domain.PaymentMethod;
import com.armakers3d.payments.domain.ProofAttempt;
import com.armakers3d.payments.dto.CheckoutDto;
import com.armakers3d.payments.dto.CreateCheckoutRequestDto;
import com.armakers3d.payments.dto.PaymentDetailDto;
import com.armakers3d.payments.dto.PaymentSummaryDto;
import com.armakers3d.payments.service.CheckoutService.CreateCheckoutCommand;
import com.armakers3d.payments.service.PaymentVerificationService.PaymentView;
import java.util.List;

/** Wire shape to use-case command and domain checkout to responses. Only contract fields are copied. */
public final class CheckoutDtoMapper {

    private CheckoutDtoMapper() {}

    /** {@code customerId} comes from the authenticated principal, never from the body. */
    public static CreateCheckoutCommand toCommand(Long customerId, String idempotencyKey, CreateCheckoutRequestDto dto) {
        List<RequestedItem> items = dto.items() == null
                ? null
                : dto.items().stream()
                        .map(i -> i == null ? null : new RequestedItem(i.productId(), i.quantity()))
                        .toList();
        var delivery = dto.delivery() == null
                ? null
                : new DeliveryInfo(dto.delivery().address(), dto.delivery().district(), dto.delivery().notes());
        var contact = dto.contact() == null
                ? null
                : new ContactInfo(dto.contact().fullName(), dto.contact().phone());
        return new CreateCheckoutCommand(customerId, idempotencyKey, items, delivery, contact);
    }

    public static CheckoutDto toCheckout(Checkout c, int maxAttempts) {
        var items = items(c);
        var instructions = new CheckoutDto.PaymentInstructions(
                List.of(PaymentMethod.values()), c.total(), Checkout.CURRENCY, c.reference());
        var latest = c.latestAttempt();
        String proofStatus = latest.map(a -> a.decision().name()).orElse("NONE");
        String rejection = c.status() == CheckoutStatus.PROOF_REJECTED
                ? latest.map(ProofAttempt::rejectionReason).orElse(null)
                : null;
        var attempts = c.attempts().stream()
                .map(a -> new CheckoutDto.Attempt(a.id(), a.number(), a.method(), a.operationCode(), a.submittedAt(),
                        a.decision(), a.rejectionReason()))
                .toList();
        return new CheckoutDto(
                c.id(), c.status(), c.orderId(), c.total(), Checkout.CURRENCY, c.createdAt(),
                c.status() == CheckoutStatus.AWAITING_PAYMENT_PROOF ? c.expiresAt() : null, items, instructions,
                proofStatus, rejection, Math.max(0, maxAttempts - c.attempts().size()), attempts);
    }

    public static PaymentSummaryDto toSummary(PaymentView view) {
        Checkout c = view.checkout();
        var latest = c.latestAttempt();
        boolean duplicate = latest.map(a -> view.isDuplicate(a.id())).orElse(false);
        return new PaymentSummaryDto(c.id(), c.reference(), c.status(), c.contact().fullName(), c.total(), Checkout.CURRENCY,
                c.createdAt(), latest.map(ProofAttempt::submittedAt).orElse(null), c.attempts().size(),
                latest.map(ProofAttempt::method).orElse(null), duplicate);
    }

    public static PaymentDetailDto toDetail(PaymentView view) {
        Checkout c = view.checkout();
        var attempts = c.attempts().stream()
                .map(a -> new PaymentDetailDto.Attempt(a.id(), a.number(), a.method(), a.operationCode(), a.submittedAt(),
                        a.type().contentType(), a.sizeBytes(), a.decision(), a.rejectionReason(), a.decidedBy(),
                        a.decidedAt(), view.isDuplicate(a.id())))
                .toList();
        return new PaymentDetailDto(c.id(), c.reference(), c.status(), c.orderId(), c.customerId(),
                new PaymentDetailDto.Contact(c.contact().fullName(), c.contact().phone()), c.total(), Checkout.CURRENCY,
                c.createdAt(), c.paidAt(), items(c), attempts, view.hasDuplicate());
    }

    private static List<CheckoutDto.Item> items(Checkout c) {
        return c.lines().stream()
                .map(l -> new CheckoutDto.Item(l.productId(), l.title(), l.unitPrice(), l.quantity(), l.lineTotal()))
                .toList();
    }
}
