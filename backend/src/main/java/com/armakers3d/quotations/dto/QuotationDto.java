package com.armakers3d.quotations.dto;

import com.armakers3d.quotations.domain.QuotationStatus;
import com.armakers3d.quotations.service.QuotationService.QuotationView;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Staff view of a quotation: the agreed price, its status, the customer and the order generated from it, if any. */
public record QuotationDto(
        Long id,
        String customerEmail,
        String customerName,
        String customerPhone,
        String description,
        BigDecimal agreedAmount,
        QuotationStatus status,
        List<QuotationStatus> allowedNextStatuses,
        String notes,
        Instant registeredAt,
        Instant updatedAt,
        String orderId) {

    public static QuotationDto from(QuotationView v) {
        var q = v.quotation();
        return new QuotationDto(
                q.id(), v.customerEmail(), v.customerName(), v.customerPhone(), q.description(), q.agreedAmount(),
                q.status(), q.status().allowedNext(), q.notes(), q.quotedAt(), q.updatedAt(), v.orderId());
    }
}
