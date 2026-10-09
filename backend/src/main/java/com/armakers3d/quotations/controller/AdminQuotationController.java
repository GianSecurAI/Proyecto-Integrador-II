package com.armakers3d.quotations.controller;

import com.armakers3d.auth.security.AuthenticatedUser;
import com.armakers3d.quotations.domain.QuotationStatus;
import com.armakers3d.quotations.dto.CreateQuotationRequestDto;
import com.armakers3d.quotations.dto.GenerateQuotationOrderRequestDto;
import com.armakers3d.quotations.dto.QuotationDto;
import com.armakers3d.quotations.dto.QuotationStatusRequestDto;
import com.armakers3d.quotations.service.QuotationService;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/admin/quotations")
@Tag(name = "Quotations (staff)", description = "Quotations agreed over WhatsApp (ASESOR, ADMINISTRADOR).")
public class AdminQuotationController {

    private final QuotationService service;

    public AdminQuotationController(QuotationService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(
            summary = "Register a quotation agreed with a customer",
            description = "Body: customerEmail, description (1..1000), agreedAmount (> 0, entered by staff, never"
                    + " calculated), notes (optional). Initial status REGISTRADA. An unknown email creates the customer"
                    + " account.")
    public ResponseEntity<QuotationDto> register(
            @AuthenticationPrincipal AuthenticatedUser staff, @Valid @RequestBody CreateQuotationRequestDto request) {
        var view = service.register(new QuotationService.RegisterCommand(
                staff.id(), staff.rol(), request.customerEmail(), request.description(), request.agreedAmount(),
                request.notes()));
        return ResponseEntity.created(URI.create("/api/admin/quotations/" + view.quotation().id()))
                .body(QuotationDto.from(view));
    }

    @GetMapping
    @Operation(
            summary = "List and filter quotations, newest first",
            description = "Filters: status, q (description or customer email substring, max 100), from/to (YYYY-MM-DD"
                    + " inclusive, America/Lima); page, size (1..100).")
    public Page<QuotationDto> list(
            @RequestParam(required = false) QuotationStatus status,
            @RequestParam(required = false) @Size(max = 100, message = "must be at most 100 characters") String q,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") @Min(value = 0, message = "page must be >= 0") int page,
            @RequestParam(defaultValue = "20")
                    @Min(value = 1, message = "size must be between 1 and 100")
                    @Max(value = 100, message = "size must be between 1 and 100")
                    int size) {
        return service.search(new QuotationService.Filter(status, from, to, q), new PageRequest(page, size))
                .map(QuotationDto::from);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Quotation detail with the allowed next statuses and the generated order, if any")
    public QuotationDto get(@PathVariable Long id) {
        return QuotationDto.from(service.get(id));
    }

    @PatchMapping("/{id}/status")
    @Operation(
            summary = "Update the status of a quotation",
            description = "REGISTRADA can become ACEPTADA, RECHAZADA or VENCIDA; those outcomes are final. Any other"
                    + " change is 409 INVALID_QUOTATION_TRANSITION.")
    public QuotationDto changeStatus(
            @AuthenticationPrincipal AuthenticatedUser staff,
            @PathVariable Long id,
            @Valid @RequestBody QuotationStatusRequestDto request) {
        return QuotationDto.from(service.changeStatus(new QuotationService.ChangeStatusCommand(
                id, request.status(), request.notes(), staff.id(), staff.rol())));
    }

    @PostMapping("/{id}/order")
    @Operation(
            summary = "Generate the personalized order of an accepted quotation",
            description = "Body: paymentConfirmed (must be true: the payment is made outside the system). Only an"
                    + " ACEPTADA quotation can generate an order (409 QUOTATION_NOT_ACCEPTED) and only once (409"
                    + " QUOTATION_ALREADY_ORDERED). The order starts in CONFIRMADO and the customer is notified.")
    public ResponseEntity<QuotationDto> generateOrder(
            @AuthenticationPrincipal AuthenticatedUser staff,
            @PathVariable Long id,
            @Valid @RequestBody GenerateQuotationOrderRequestDto request) {
        var view = service.generateOrder(new QuotationService.GenerateOrderCommand(
                id, request.paymentConfirmed(), staff.id(), staff.email(), staff.rol()));
        return ResponseEntity.status(201).body(QuotationDto.from(view));
    }
}
