package com.armakers3d.orders.controller;

import com.armakers3d.auth.security.AuthenticatedUser;
import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.orders.dto.AdminOrderDetailDto;
import com.armakers3d.orders.dto.AdminOrderSummaryDto;
import com.armakers3d.orders.dto.StatusChangeRequestDto;
import com.armakers3d.orders.mapper.OrderDtoMapper;
import com.armakers3d.orders.service.OrderQueryService;
import com.armakers3d.orders.service.OrderStatusService;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Staff order management (contract E24-E26). ASESOR and ADMINISTRADOR only (central role matrix). Thin:
 * the actor of a status change is always the principal; the transition rules live in the domain.
 */
@RestController
@RequestMapping("/api/admin/orders")
@Tag(name = "Admin orders", description = "Order list, detail and status changes (ASESOR, ADMINISTRADOR).")
public class AdminOrderController {

    private final OrderQueryService queries;
    private final OrderStatusService statusService;

    public AdminOrderController(OrderQueryService queries, OrderStatusService statusService) {
        this.queries = queries;
        this.statusService = statusService;
    }

    @GetMapping
    @Operation(
            summary = "List and filter all orders",
            description = "Filters: q (order id or customer email substring, max 100), status, kind, from/to"
                    + " (YYYY-MM-DD inclusive, America/Lima, on placedAt); sort = placedAt[,asc|desc];"
                    + " page, size (1..100).")
    public Page<AdminOrderSummaryDto> list(
            @RequestParam(required = false) @Size(max = 100, message = "must be at most 100 characters") String q,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) OrderKind kind,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") @Min(value = 0, message = "page must be >= 0") int page,
            @RequestParam(defaultValue = "20")
                    @Min(value = 1, message = "size must be between 1 and 100")
                    @Max(value = 100, message = "size must be between 1 and 100")
                    int size,
            @RequestParam(required = false) String sort) {
        return queries.listForStaff(
                        new OrderQueryService.StaffFilter(q, status, kind, from, to), sort, new PageRequest(page, size))
                .map(OrderDtoMapper::toAdminSummary);
    }

    @GetMapping("/{orderId}")
    @Operation(summary = "Order detail with history and allowed next statuses")
    public AdminOrderDetailDto get(@PathVariable String orderId) {
        return OrderDtoMapper.toAdminDetail(queries.getForStaff(orderId));
    }

    @PatchMapping("/{orderId}/status")
    @Operation(
            summary = "Change the status of an order",
            description = "Body: status, note (optional, max 500). Allowed transitions are enforced by the server"
                    + " (order-lifecycle.md); anything else is 409 INVALID_STATUS_TRANSITION, including re-sending"
                    + " the current status and a concurrent change that lost the race. The actor is the"
                    + " authenticated staff member.")
    public AdminOrderDetailDto changeStatus(
            @AuthenticationPrincipal AuthenticatedUser staff,
            @PathVariable String orderId,
            @Valid @RequestBody StatusChangeRequestDto request) {
        return OrderDtoMapper.toAdminDetail(statusService.changeStatus(new OrderStatusService.ChangeStatusCommand(
                orderId, request.status(), request.note(), staff.id(), staff.rol())));
    }
}
