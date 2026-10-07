package com.armakers3d.reports.controller;

import com.armakers3d.auth.security.AuthenticatedUser;
import com.armakers3d.incidents.domain.IncidentStatus;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.reports.dto.IncidentReportDto;
import com.armakers3d.reports.dto.OrderReportDto;
import com.armakers3d.reports.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Administrative reports (contract E32, E33). ADMINISTRADOR only (central role matrix). Thin: delegates to {@link ReportService}. */
@RestController
@RequestMapping("/api/admin/reports")
@Tag(name = "Admin reports", description = "Read-only order and incident aggregates (ADMINISTRADOR).")
public class AdminReportController {

    private final ReportService service;

    public AdminReportController(ReportService service) {
        this.service = service;
    }

    @GetMapping("/orders")
    @Operation(
            summary = "Order report: counts by status and kind, amounts excluding cancelled orders",
            description = "from/to: YYYY-MM-DD inclusive, America/Lima, on placedAt; default the last 30 days ending"
                    + " today; from <= to and at most 366 days, else 400. Optional status filter.")
    public OrderReportDto orders(
            @AuthenticationPrincipal AuthenticatedUser admin,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) OrderStatus status) {
        return service.orders(from, to, status, admin.id(), admin.rol());
    }

    @GetMapping("/incidents")
    @Operation(
            summary = "Incident report: counts by status and priority, open vs resolved",
            description = "from/to as in the order report, on reportedAt. Optional status filter.")
    public IncidentReportDto incidents(
            @AuthenticationPrincipal AuthenticatedUser admin,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) IncidentStatus status) {
        return service.incidents(from, to, status, admin.id(), admin.rol());
    }
}
