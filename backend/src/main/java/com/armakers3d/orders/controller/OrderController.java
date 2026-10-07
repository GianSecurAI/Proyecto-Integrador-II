package com.armakers3d.orders.controller;

import com.armakers3d.auth.security.AuthenticatedUser;
import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.orders.dto.OrderResponseDto;
import com.armakers3d.orders.dto.OrderSummaryDto;
import com.armakers3d.orders.mapper.OrderDtoMapper;
import com.armakers3d.orders.service.OrderQueryService;
import com.armakers3d.shared.error.ApiError;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Standard catalog orders of the authenticated customer: READ ONLY. A standard order is created exclusively from a
 * confirmed payment (payments module, BE-09); the interim customer-facing {@code POST /api/orders} was removed
 * (BE-10). Role access (CLIENTE only) comes from the central role matrix; the owner is always the authenticated
 * principal. Reads (E20 list, E21 detail, which also serves tracking per D-07) only ever reach the caller's own
 * orders; an unknown id and a not-owned id are the same 404.
 */
@RestController
@RequestMapping("/api/orders")
@Tag(name = "Orders", description = "Orders of the authenticated customer.")
public class OrderController {

    private final OrderQueryService queries;

    public OrderController(OrderQueryService queries) {
        this.queries = queries;
    }

    @GetMapping
    @Operation(
            summary = "List the authenticated customer's own orders",
            description = "Filters status, kind; sort = placedAt[,asc|desc] (default placedAt,desc); page (0-based),"
                    + " size (1..100, default 20). Only the caller's own orders, whatever the query says.")
    public Page<OrderSummaryDto> list(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) OrderKind kind,
            @RequestParam(defaultValue = "0") @Min(value = 0, message = "page must be >= 0") int page,
            @RequestParam(defaultValue = "20")
                    @Min(value = 1, message = "size must be between 1 and 100")
                    @Max(value = 100, message = "size must be between 1 and 100")
                    int size,
            @RequestParam(required = false) String sort) {
        return queries.listForCustomer(
                        user.id(), new OrderQueryService.CustomerFilter(status, kind), sort, new PageRequest(page, size))
                .map(OrderDtoMapper::toSummary);
    }

    @GetMapping("/{orderId}")
    @Operation(
            summary = "Order detail with status history (also the tracking view)",
            description = "Owner only. An unknown id and an id owned by someone else are both 404 NOT_FOUND."
                    + " There is no public tracking endpoint (D-07).")
    @ApiResponse(
            responseCode = "404",
            description = "Unknown or not owned by the caller.",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public OrderResponseDto get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String orderId) {
        return OrderDtoMapper.toResponse(queries.getForCustomer(user.id(), orderId));
    }
}
