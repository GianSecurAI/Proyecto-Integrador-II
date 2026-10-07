package com.armakers3d.payments.controller;

import com.armakers3d.auth.security.AuthenticatedUser;
import com.armakers3d.payments.config.PaymentsProperties;
import com.armakers3d.payments.dto.CheckoutDto;
import com.armakers3d.payments.dto.CreateCheckoutRequestDto;
import com.armakers3d.payments.mapper.CheckoutDtoMapper;
import com.armakers3d.payments.service.CheckoutService;
import com.armakers3d.payments.service.PaymentProofService;
import com.armakers3d.shared.error.ApiError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
import org.springframework.web.multipart.MultipartFile;

/**
 * Standard catalog checkout of the authenticated customer (ADR-005): create, read, upload the Yape/Plin payment
 * proof, view own proof, cancel. CLIENTE only (central role matrix); the owner is the principal, never a body field.
 * Thin: map, delegate, choose the status code. The order is created by the administrator's approval, never here.
 */
@RestController
@RequestMapping("/api/checkout")
@Tag(name = "Checkout", description = "Start a catalog checkout, upload the Yape/Plin payment proof and follow it (CLIENTE).")
public class CheckoutController {

    /** Echoed on a replayed (idempotent) response so a client can tell it from a fresh creation. */
    static final String REPLAYED_HEADER = "Idempotent-Replayed";

    private final CheckoutService checkouts;
    private final PaymentProofService proofs;
    private final PaymentsProperties properties;

    public CheckoutController(CheckoutService checkouts, PaymentProofService proofs, PaymentsProperties properties) {
        this.checkouts = checkouts;
        this.proofs = proofs;
        this.properties = properties;
    }

    @PostMapping
    @Operation(
            summary = "Start a checkout for the cart (manual Yape/Plin payment)",
            description = "Body: items (productId, quantity 1..99), delivery, contact. Prices, totals, currency (PEN)"
                    + " and the owner are decided by the server; any price/total/status in the body is ignored."
                    + " Optional Idempotency-Key header (UUID): the same key with the same body returns the original"
                    + " checkout with 200 and Idempotent-Replayed: true (a fresh creation is 201); the same key with a"
                    + " different body is 409 IDEMPOTENCY_KEY_REUSED. At most 3 checkouts may be open at the same time"
                    + " (409 CONFLICT). The response carries paymentInstructions (amount, reference). The customer pays"
                    + " by scanning the Yape/Plin QR and uploads the proof; the order exists only after an administrator"
                    + " approves it.")
    @ApiResponse(responseCode = "201", description = "Checkout created (status AWAITING_PAYMENT_PROOF).")
    @ApiResponse(responseCode = "200", description = "Replay of an earlier submission with the same Idempotency-Key.")
    @ApiResponse(
            responseCode = "409",
            description = "PRODUCT_UNAVAILABLE (fieldErrors per line), IDEMPOTENCY_KEY_REUSED or CONFLICT (too many open checkouts).",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public ResponseEntity<CheckoutDto> create(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody CreateCheckoutRequestDto request) {
        var created = checkouts.create(CheckoutDtoMapper.toCommand(user.id(), idempotencyKey, request));
        CheckoutDto body = CheckoutDtoMapper.toCheckout(created.checkout(), properties.getMaxProofAttempts());
        if (created.replayed()) {
            return ResponseEntity.ok().header(REPLAYED_HEADER, "true").body(body);
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @GetMapping("/{checkoutId}")
    @Operation(
            summary = "Checkout status (the confirmation page reads this)",
            description = "Owner only. An unknown, malformed or not-owned id is the same 404 NOT_FOUND. Status is"
                    + " AWAITING_PAYMENT_PROOF, PROOF_SUBMITTED, PAID (orderId set), PROOF_REJECTED (rejectionReason"
                    + " set), EXPIRED or CANCELLED.")
    @ApiResponse(
            responseCode = "404",
            description = "Unknown or not owned by the caller.",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public CheckoutDto get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String checkoutId) {
        return CheckoutDtoMapper.toCheckout(checkouts.findOwned(user.id(), checkoutId), properties.getMaxProofAttempts());
    }

    @PostMapping(path = "/{checkoutId}/proof", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(
            summary = "Upload the Yape/Plin payment proof (screenshot)",
            description = "multipart/form-data: file (JPEG, PNG or WebP, max 5 MB; the type is decided from the file"
                    + " content, not from its declared type or name), method (YAPE or PLIN), operationCode (optional,"
                    + " 6..20 letters or digits). Allowed while AWAITING_PAYMENT_PROOF or PROOF_REJECTED (max 5 proofs"
                    + " per checkout); the checkout becomes PROOF_SUBMITTED. Errors: 400 VALIDATION_FAILED /"
                    + " INVALID_PROOF_IMAGE, 413 PAYLOAD_TOO_LARGE, 415 UNSUPPORTED_IMAGE_TYPE, 409"
                    + " CHECKOUT_STATE_CONFLICT / PROOF_ATTEMPTS_EXCEEDED, 503 PROOF_STORAGE_UNAVAILABLE.")
    public CheckoutDto uploadProof(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String checkoutId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(name = "method", required = false) String method,
            @RequestParam(name = "operationCode", required = false) String operationCode)
            throws IOException {
        var updated = proofs.submit(new PaymentProofService.SubmitProofCommand(
                user.id(), checkoutId, method, operationCode, file.getBytes()));
        return CheckoutDtoMapper.toCheckout(updated, properties.getMaxProofAttempts());
    }

    @GetMapping("/{checkoutId}/proof/{attemptId}")
    @Operation(
            summary = "View one of your own payment proofs",
            description = "Owner only (404 otherwise). The image is served inline with the detected Content-Type,"
                    + " X-Content-Type-Options: nosniff, Cache-Control: private, no-store and a restrictive CSP.")
    public ResponseEntity<byte[]> viewProof(
            @AuthenticationPrincipal AuthenticatedUser user, @PathVariable String checkoutId, @PathVariable String attemptId) {
        return ProofResponses.inline(proofs.contentForOwner(user.id(), checkoutId, attemptId));
    }

    @PostMapping("/{checkoutId}/cancel")
    @Operation(
            summary = "Cancel a checkout before it is paid",
            description = "Owner only. Allowed while AWAITING_PAYMENT_PROOF, PROOF_SUBMITTED or PROOF_REJECTED;"
                    + " idempotent on an already CANCELLED checkout; PAID or EXPIRED is 409 CHECKOUT_STATE_CONFLICT.")
    public CheckoutDto cancel(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String checkoutId) {
        return CheckoutDtoMapper.toCheckout(checkouts.cancel(user.id(), checkoutId), properties.getMaxProofAttempts());
    }
}
