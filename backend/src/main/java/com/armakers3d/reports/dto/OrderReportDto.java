package com.armakers3d.reports.dto;

import com.armakers3d.orders.domain.OrderStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * E32 response. {@code from}/{@code to} are the EFFECTIVE inclusive Lima dates. The three amounts are the sum of the
 * server-calculated order totals EXCLUDING CANCELADO orders (PD-REP-03); they are the committed order value, not
 * collected payments (orders carry no payment data, PD-ORD-01). Extension beyond the contract review: the amounts.
 */
public record OrderReportDto(
        LocalDate from,
        LocalDate to,
        long totalOrders,
        long standardOrders,
        long customOrders,
        List<StatusCount> byStatus,
        BigDecimal totalAmount,
        BigDecimal standardAmount,
        BigDecimal customAmount) {

    public record StatusCount(OrderStatus status, long count) {}
}
