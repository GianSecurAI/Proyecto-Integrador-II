package com.armakers3d.orders.controller;

import com.armakers3d.auth.security.AuthenticatedUser;
import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.orders.dto.OrderResponseDto;
import com.armakers3d.orders.dto.OrderSummaryDto;
import com.armakers3d.orders.dto.PlaceOrderRequestDto;
import com.armakers3d.orders.mapper.OrderDtoMapper;
import com.armakers3d.orders.service.OrderQueryService;
import com.armakers3d.orders.service.OrderService;
import com.armakers3d.orders.service.PlacedOrder;
import com.armakers3d.shared.error.ApiError;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Standard catalog orders of the authenticated customer. Role access (CLIENTE only) comes from the
 * central role matrix; the owner is always the authenticated principal. Thin: map, delegate, choose the
 * status code. Reads (E20 list, E21 detail, which also serves tracking per D-07) only ever reach the
 * caller's own orders; an unknown id and a not-owned id are the same 404.
 */
@RestController
@RequestMapping("/api/orders")
@Tag(name = "Orders", description = "Orders of the authenticated customer.")
public class OrderController {

    /** Echoed on a replayed (idempotent) response so a client can tell it from a fresh creation. */
    static final String REPLAYED_HEADER = "Idempotent-Replayed";

    private final OrderService orderService;
    private final OrderQueryService queries;

    public OrderController(OrderService orderService, OrderQueryService queries) {
        this.orderService = orderService;
        this.queries = queries;
    }

    @PostMapping
    @Operation(
            summary = "Submit a standard catalog order (no payment step yet)",
            description = "Body: items (productId, quantity 1..99), delivery, contact. Prices and totals are"
                    + " computed by the server. Optional Idempotency-Key header (UUID): the same key with the same"
                    + " body returns the original order with 200 and Idempotent-Replayed: true (a fresh creation is"
                    + " 201); the same key with a different body is 409 IDEMPOTENCY_KEY_REUSED. Keys are per"
                    + " customer and remembered 24 hours.")
    @ApiResponse(responseCode = "201", description = "Order created.")
    @ApiResponse(responseCode = "200", description = "Replay of an earlier submission with the same Idempotency-Key.")
    @ApiResponse(
            responseCode = "409",
            description = "PRODUCT_UNAVAILABLE (fieldErrors per line) or IDEMPOTENCY_KEY_REUSED.",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public ResponseEntity<OrderResponseDto> place(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody PlaceOrderRequestDto request) {
        PlacedOrder placed = orderService.placeStandardOrder(OrderDtoMapper.toCommand(user.id(), idempotencyKey, request));
        OrderResponseDto body = OrderDtoMapper.toResponse(placed.order());
        if (placed.replayed()) {
            return ResponseEntity.ok().header(REPLAYED_HEADER, "true").body(body);
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
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
