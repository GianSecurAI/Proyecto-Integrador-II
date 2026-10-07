package com.armakers3d.payments.controller;

import com.armakers3d.auth.security.AuthenticatedUser;
import com.armakers3d.payments.domain.CheckoutStatus;
import com.armakers3d.payments.dto.PaymentDetailDto;
import com.armakers3d.payments.dto.PaymentSummaryDto;
import com.armakers3d.payments.dto.RejectPaymentRequestDto;
import com.armakers3d.payments.mapper.CheckoutDtoMapper;
import com.armakers3d.payments.service.PaymentVerificationService;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Manual payment verification (ADR-005). ADMINISTRADOR only (central role matrix; ASESOR is denied, DECIDED-BY-DEFAULT,
 * switching to STAFF is one rule in {@code AccessMatrix}). The acting administrator is the principal, never a body
 * field. Thin: delegate to {@link PaymentVerificationService}, which owns every rule.
 */
@RestController
@RequestMapping("/api/admin/payments")
@Tag(name = "Admin payments", description = "Verify Yape/Plin payment proofs and create the orders (ADMINISTRADOR).")
public class AdminPaymentController {

    private final PaymentVerificationService verification;

    public AdminPaymentController(PaymentVerificationService verification) {
        this.verification = verification;
    }

    @GetMapping
    @Operation(
            summary = "Payment verification queue",
            description = "Filter status (default PROOF_SUBMITTED), page (0-based), size (1..100). Oldest proof first.")
    public Page<PaymentSummaryDto> list(
            @RequestParam(defaultValue = "PROOF_SUBMITTED") CheckoutStatus status,
            @RequestParam(defaultValue = "0") @Min(value = 0, message = "page must be >= 0") int page,
            @RequestParam(defaultValue = "20")
                    @Min(value = 1, message = "size must be between 1 and 100")
                    @Max(value = 100, message = "size must be between 1 and 100")
                    int size) {
        return verification.list(status, new PageRequest(page, size)).map(CheckoutDtoMapper::toSummary);
    }

    @GetMapping("/{checkoutId}")
    @Operation(summary = "Payment detail: customer, amount, lines, proof attempts and duplicate warning")
    public PaymentDetailDto get(@PathVariable String checkoutId) {
        return CheckoutDtoMapper.toDetail(verification.detail(checkoutId));
    }

    @GetMapping("/{checkoutId}/proof/{attemptId}")
    @Operation(summary = "View a payment proof image (inline, nosniff, private no-store, restrictive CSP)")
    public ResponseEntity<byte[]> proof(@PathVariable String checkoutId, @PathVariable String attemptId) {
        return ProofResponses.inline(verification.proof(checkoutId, attemptId));
    }

    @PostMapping("/{checkoutId}/approve")
    @Operation(
            summary = "Approve the payment: the standard order is created (CONFIRMADO)",
            description = "Idempotent: approving an already PAID checkout returns it without creating a second order."
                    + " 409 CHECKOUT_STATE_CONFLICT unless the checkout has a submitted proof or is already PAID.")
    public PaymentDetailDto approve(@AuthenticationPrincipal AuthenticatedUser admin, @PathVariable String checkoutId) {
        return CheckoutDtoMapper.toDetail(verification.approve(admin.id(), admin.rol(), checkoutId));
    }

    @PostMapping("/{checkoutId}/reject")
    @Operation(
            summary = "Reject the submitted proof with a reason shown to the customer",
            description = "Body: reason (required, 1..300). 409 CHECKOUT_STATE_CONFLICT unless a proof is submitted."
                    + " The customer is e-mailed (best effort) and may upload a new proof (max 5 per checkout).")
    public PaymentDetailDto reject(
            @AuthenticationPrincipal AuthenticatedUser admin,
            @PathVariable String checkoutId,
            @Valid @RequestBody RejectPaymentRequestDto request) {
        return CheckoutDtoMapper.toDetail(verification.reject(admin.id(), checkoutId, request.reason()));
    }
}
