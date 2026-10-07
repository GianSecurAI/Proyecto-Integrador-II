package com.armakers3d.incidents.controller;

import com.armakers3d.auth.security.AuthenticatedUser;
import com.armakers3d.incidents.domain.IncidentStatus;
import com.armakers3d.incidents.dto.CreateIncidentRequestDto;
import com.armakers3d.incidents.dto.IncidentDto;
import com.armakers3d.incidents.mapper.IncidentDtoMapper;
import com.armakers3d.incidents.service.IncidentService;
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
import java.net.URI;
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
 * Incidents of the authenticated customer (contract E22, E23 plus an own-detail read). Role access (CLIENTE
 * only) comes from the central role matrix; the owner is always the authenticated principal. Thin: map,
 * delegate, choose the status code. A customer can never set status, priority or resolution.
 */
@RestController
@RequestMapping("/api/incidents")
@Tag(name = "Incidents", description = "Incidents of the authenticated customer.")
public class IncidentController {

    private final IncidentService service;

    public IncidentController(IncidentService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(
            summary = "Report an incident about an order the customer owns",
            description = "Body: orderId, description (20..1000 after trimming). Starts ABIERTA; status, priority and"
                    + " resolution in the body are ignored. An unknown order and an order owned by someone else are both"
                    + " 404. Max 5 open incidents per order; an identical open description for the same order is 409.")
    @ApiResponse(responseCode = "201", description = "Incident registered (Location points to its detail).")
    @ApiResponse(
            responseCode = "404",
            description = "Unknown order or not owned by the caller.",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public ResponseEntity<IncidentDto> register(
            @AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody CreateIncidentRequestDto request) {
        IncidentDto body = IncidentDtoMapper.toDto(service.register(user.id(), request.orderId(), request.description()));
        return ResponseEntity.created(URI.create("/api/incidents/" + body.id())).body(body);
    }

    @GetMapping
    @Operation(
            summary = "List the authenticated customer's own incidents",
            description = "Filter status; sort = reportedAt[,asc|desc] (default reportedAt,desc); page (0-based), size"
                    + " (1..100, default 20). Only the caller's own incidents, whatever the query says.")
    public Page<IncidentDto> list(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(required = false) IncidentStatus status,
            @RequestParam(defaultValue = "0") @Min(value = 0, message = "page must be >= 0") int page,
            @RequestParam(defaultValue = "20")
                    @Min(value = 1, message = "size must be between 1 and 100")
                    @Max(value = 100, message = "size must be between 1 and 100")
                    int size,
            @RequestParam(required = false) String sort) {
        return service.listForCustomer(user.id(), status, sort, new PageRequest(page, size))
                .map(IncidentDtoMapper::toDto);
    }

    @GetMapping("/{incidentId}")
    @Operation(
            summary = "Own incident detail with status and resolution",
            description = "Owner only. An unknown id and an id owned by someone else are both 404 NOT_FOUND.")
    @ApiResponse(
            responseCode = "404",
            description = "Unknown or not owned by the caller.",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public IncidentDto get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String incidentId) {
        return IncidentDtoMapper.toDto(service.getForCustomer(user.id(), incidentId));
    }
}
