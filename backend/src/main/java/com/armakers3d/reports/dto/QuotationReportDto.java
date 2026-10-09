package com.armakers3d.reports.dto;

import com.armakers3d.quotations.domain.QuotationStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Quotation report (RF17): how many quotations were registered in the range, how each ended, and the agreed amount of
 * the accepted ones. The amounts are the prices staff typed; the system never computes them.
 */
public record QuotationReportDto(
        LocalDate from,
        LocalDate to,
        long totalQuotations,
        List<StatusCount> byStatus,
        BigDecimal totalAmount,
        BigDecimal acceptedAmount) {

    public record StatusCount(QuotationStatus status, long count, BigDecimal amount) {}
}
