package com.armakers3d.catalog.controller;

import com.armakers3d.auth.security.AuthenticatedUser;
import com.armakers3d.catalog.domain.ProductCategory;
import com.armakers3d.catalog.dto.AdminProductDto;
import com.armakers3d.catalog.dto.AvailabilityChangeRequestDto;
import com.armakers3d.catalog.dto.ProductWriteRequestDto;
import com.armakers3d.catalog.mapper.ProductDtoMapper;
import com.armakers3d.catalog.service.ProductAdminService;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Administrator product management (contract review E9-E13). ADMINISTRADOR only (central role matrix). */
@RestController
@RequestMapping("/api/admin/products")
@Tag(name = "Admin products", description = "Product administration (ADMINISTRADOR only).")
public class AdminProductController {

    private final ProductAdminService service;

    public AdminProductController(ProductAdminService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(
            summary = "List products including unavailable ones",
            description = "Filters q (title substring), category, available; sort = price|title|createdAt[,asc|desc].")
    public Page<AdminProductDto> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) ProductCategory category,
            @RequestParam(required = false) Boolean available,
            @RequestParam(defaultValue = "0") @Min(value = 0, message = "page must be >= 0") int page,
            @RequestParam(defaultValue = "20")
                    @Min(value = 1, message = "size must be between 1 and 100")
                    @Max(value = 100, message = "size must be between 1 and 100")
                    int size,
            @RequestParam(required = false) String sort) {
        return service.list(new ProductAdminService.AdminFilter(q, category, available), new PageRequest(page, size), sort)
                .map(ProductDtoMapper::toAdmin);
    }

    @GetMapping("/{id:\\d+}")
    @Operation(summary = "Get a product (any availability)")
    public AdminProductDto get(@PathVariable Long id) {
        return ProductDtoMapper.toAdmin(service.get(id));
    }

    @PostMapping
    @Operation(summary = "Create a product (created available)")
    public ResponseEntity<AdminProductDto> create(
            @AuthenticationPrincipal AuthenticatedUser actor, @Valid @RequestBody ProductWriteRequestDto request) {
        AdminProductDto created = ProductDtoMapper.toAdmin(service.create(actor.id(), toCommand(request)));
        return ResponseEntity.created(URI.create("/api/admin/products/" + created.id())).body(created);
    }

    @PutMapping("/{id:\\d+}")
    @Operation(summary = "Replace the editable fields of a product (availability untouched)")
    public AdminProductDto update(
            @AuthenticationPrincipal AuthenticatedUser actor,
            @PathVariable Long id,
            @Valid @RequestBody ProductWriteRequestDto request) {
        return ProductDtoMapper.toAdmin(service.update(actor.id(), id, toCommand(request)));
    }

    @PatchMapping("/{id:\\d+}/availability")
    @Operation(summary = "Make a product available or unavailable")
    public AdminProductDto setAvailability(
            @AuthenticationPrincipal AuthenticatedUser actor,
            @PathVariable Long id,
            @Valid @RequestBody AvailabilityChangeRequestDto request) {
        return ProductDtoMapper.toAdmin(service.setAvailability(actor.id(), id, request.available()));
    }

    private static ProductAdminService.WriteCommand toCommand(ProductWriteRequestDto r) {
        return new ProductAdminService.WriteCommand(
                r.title(), r.category(), r.subcategory(), r.description(), r.price(), r.characteristics());
    }
}
