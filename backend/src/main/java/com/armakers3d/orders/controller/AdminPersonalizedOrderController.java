package com.armakers3d.orders.controller;

import com.armakers3d.auth.security.AuthenticatedUser;
import com.armakers3d.orders.dto.AdminOrderDetailDto;
import com.armakers3d.orders.dto.RegisterPersonalizedOrderRequestDto;
import com.armakers3d.orders.mapper.OrderDtoMapper;
import com.armakers3d.orders.service.PersonalizedOrderService;
import com.armakers3d.orders.service.RegisterPersonalizedOrderCommand;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Staff registration of a personalized order after external quotation and payment. Role access (ASESOR,
 * ADMINISTRADOR) comes from the central role matrix; the registering staff member is always the principal.
 */
@RestController
@RequestMapping("/api/admin/orders/personalized")
@Tag(name = "Personalized orders (staff)", description = "Registration of personalized orders by advisors/administrators.")
public class AdminPersonalizedOrderController {

    static final String REPLAYED_HEADER = "Idempotent-Replayed";

    private final PersonalizedOrderService service;

    public AdminPersonalizedOrderController(PersonalizedOrderService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(
            summary = "Register a personalized order paid outside the system",
            description = "Body: customerEmail, description (1..1000), agreedAmount (> 0, <= 999999.99, 2 dp, entered by"
                    + " staff, never calculated), paymentConfirmed (must be true). Initial status CONFIRMADO. An unknown"
                    + " email creates the customer account (D-13); a staff or deactivated account is 409"
                    + " CUSTOMER_NOT_ELIGIBLE. Optional Idempotency-Key (UUID), scoped per staff member: same key and body"
                    + " replays with 200 and Idempotent-Replayed: true, same key with another body is 409.")
    @ApiResponse(responseCode = "201", description = "Order registered.")
    @ApiResponse(responseCode = "200", description = "Replay of an earlier registration with the same Idempotency-Key.")
    public ResponseEntity<AdminOrderDetailDto> register(
            @AuthenticationPrincipal AuthenticatedUser staff,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody RegisterPersonalizedOrderRequestDto request) {
        var result = service.register(new RegisterPersonalizedOrderCommand(
                staff.id(), staff.email(), staff.rol(), idempotencyKey,
                request.customerEmail(), request.description(), request.agreedAmount(), request.paymentConfirmed()));
        AdminOrderDetailDto body = OrderDtoMapper.toPersonalizedResponse(result);
        if (result.replayed()) {
            return ResponseEntity.ok().header(REPLAYED_HEADER, "true").body(body);
        }
        // Location points at the staff detail endpoint (E25).
        return ResponseEntity.created(URI.create("/api/admin/orders/" + body.id())).body(body);
    }
}
