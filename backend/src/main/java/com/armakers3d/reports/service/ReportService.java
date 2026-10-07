package com.armakers3d.reports.service;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.incidents.domain.IncidentPriority;
import com.armakers3d.incidents.domain.IncidentStatus;
import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.reports.domain.ReportRange;
import com.armakers3d.reports.dto.IncidentReportDto;
import com.armakers3d.reports.dto.OrderReportDto;
import com.armakers3d.reports.repository.IncidentReportSource;
import com.armakers3d.reports.repository.OrderReportSource;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Administrative reports (contract E32, E33; RF-19; PD-REP-*). Read-only aggregates computed through the report
 * ports; this class owns the range rules, the open/resolved definition and the audit line. Who may call it
 * (ADMINISTRADOR) is decided by the central role matrix; the actor always comes from the principal.
 * Audit lines carry the actor, report type and filters only, never any data of the report.
 */
@Service
public class ReportService {

    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.reports");

    private final OrderReportSource orderSource;
    private final IncidentReportSource incidentSource;
    private final Clock clock;

    public ReportService(OrderReportSource orderSource, IncidentReportSource incidentSource, Clock clock) {
        this.orderSource = orderSource;
        this.incidentSource = incidentSource;
        this.clock = clock;
    }

    public OrderReportDto orders(LocalDate from, LocalDate to, OrderStatus status, Long actorId, Rol actorRole) {
        ReportRange range = resolve(from, to);
        var agg = orderSource.aggregate(
                new OrderReportSource.Query(range.fromInstant(), range.toExclusiveInstant(), status));
        long standard = agg.countByKind().getOrDefault(OrderKind.ESTANDAR, 0L);
        long custom = agg.countByKind().getOrDefault(OrderKind.PERSONALIZADO, 0L);
        BigDecimal standardAmount = agg.amountByKind().getOrDefault(OrderKind.ESTANDAR, BigDecimal.ZERO.setScale(2));
        BigDecimal customAmount =
                agg.amountByKind().getOrDefault(OrderKind.PERSONALIZADO, BigDecimal.ZERO.setScale(2));
        List<OrderReportDto.StatusCount> byStatus = Arrays.stream(OrderStatus.values())
                .map(s -> new OrderReportDto.StatusCount(s, agg.countByStatus().getOrDefault(s, 0L)))
                .toList();
        audit.info("report.generated actor={} role={} report=orders from={} to={} status={}",
                actorId, actorRole, range.from(), range.to(), status);
        return new OrderReportDto(range.from(), range.to(), standard + custom, standard, custom, byStatus,
                standardAmount.add(customAmount), standardAmount, customAmount);
    }

    public IncidentReportDto incidents(
            LocalDate from, LocalDate to, IncidentStatus status, Long actorId, Rol actorRole) {
        ReportRange range = resolve(from, to);
        var agg = incidentSource.aggregate(
                new IncidentReportSource.Query(range.fromInstant(), range.toExclusiveInstant(), status));
        List<IncidentReportDto.StatusCount> byStatus = Arrays.stream(IncidentStatus.values())
                .map(s -> new IncidentReportDto.StatusCount(s, agg.countByStatus().getOrDefault(s, 0L)))
                .toList();
        List<IncidentReportDto.PriorityCount> byPriority = Arrays.stream(IncidentPriority.values())
                .map(p -> new IncidentReportDto.PriorityCount(p, agg.countByPriority().getOrDefault(p, 0L)))
                .toList();
        long total = byStatus.stream().mapToLong(IncidentReportDto.StatusCount::count).sum();
        long open = agg.countByStatus().getOrDefault(IncidentStatus.ABIERTA, 0L)
                + agg.countByStatus().getOrDefault(IncidentStatus.EN_REVISION, 0L);
        long resolved = agg.countByStatus().getOrDefault(IncidentStatus.RESUELTA, 0L);
        audit.info("report.generated actor={} role={} report=incidents from={} to={} status={}",
                actorId, actorRole, range.from(), range.to(), status);
        return new IncidentReportDto(range.from(), range.to(), total, open, resolved, byStatus, byPriority);
    }

    private ReportRange resolve(LocalDate from, LocalDate to) {
        return ReportRange.resolve(from, to, LocalDate.now(clock.withZone(ReportRange.BUSINESS_ZONE)));
    }
}
