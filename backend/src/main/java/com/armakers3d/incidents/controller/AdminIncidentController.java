package com.armakers3d.incidents.controller;

import com.armakers3d.auth.security.AuthenticatedUser;
import com.armakers3d.incidents.domain.IncidentPriority;
import com.armakers3d.incidents.domain.IncidentStatus;
import com.armakers3d.incidents.dto.AdminIncidentDto;
import com.armakers3d.incidents.dto.ResolveIncidentRequestDto;
import com.armakers3d.incidents.dto.UpdateIncidentRequestDto;
import com.armakers3d.incidents.mapper.IncidentDtoMapper;
import com.armakers3d.incidents.service.IncidentAdminService;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Staff incident management (contract E28-E31). ASESOR and ADMINISTRADOR only (central role matrix). Thin:
 * the actor of a change is always the principal; the transition and resolution rules live in the domain.
 */
@RestController
@RequestMapping("/api/admin/incidents")
@Tag(name = "Admin incidents", description = "Incident list, detail, triage and resolution (ASESOR, ADMINISTRADOR).")
public class AdminIncidentController {

    private final IncidentAdminService service;

    public AdminIncidentController(IncidentAdminService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(
            summary = "List and filter all incidents",
            description = "Filters: q (description substring, max 100), status, priority; sort = reportedAt[,asc|desc]"
                    + " (default desc); page, size (1..100).")
    public Page<AdminIncidentDto> list(
            @RequestParam(required = false) @Size(max = 100, message = "must be at most 100 characters") String q,
            @RequestParam(required = false) IncidentStatus status,
            @RequestParam(required = false) IncidentPriority priority,
            @RequestParam(defaultValue = "0") @Min(value = 0, message = "page must be >= 0") int page,
            @RequestParam(defaultValue = "20")
                    @Min(value = 1, message = "size must be between 1 and 100")
                    @Max(value = 100, message = "size must be between 1 and 100")
                    int size,
            @RequestParam(required = false) String sort) {
        return service.list(new IncidentAdminService.StaffFilter(q, status, priority), sort, new PageRequest(page, size))
                .map(IncidentDtoMapper::toAdminDto);
    }

    @GetMapping("/{incidentId}")
    @Operation(summary = "Incident detail with owner contact, priority and resolution")
    public AdminIncidentDto get(@PathVariable String incidentId) {
        return IncidentDtoMapper.toAdminDto(service.get(incidentId));
    }

    @PatchMapping("/{incidentId}")
    @Operation(
            summary = "Triage: change the status and/or assign the priority",
            description = "Body: status (EN_REVISION or RECHAZADA; RESUELTA is 400, use the resolution action) and/or"
                    + " priority (BAJA, MEDIA, ALTA); at least one. Allowed status moves: ABIERTA to EN_REVISION,"
                    + " EN_REVISION to RECHAZADA; anything else, including re-sending the current status and a"
                    + " concurrent change that lost the race, is 409 INVALID_STATUS_TRANSITION. The actor is the"
                    + " authenticated staff member.")
    public AdminIncidentDto update(
            @AuthenticationPrincipal AuthenticatedUser staff,
            @PathVariable String incidentId,
            @Valid @RequestBody UpdateIncidentRequestDto request) {
        return IncidentDtoMapper.toAdminDto(service.triage(new IncidentAdminService.TriageCommand(
                incidentId, request.status(), request.priority(), staff.id(), staff.rol())));
    }

    @PostMapping("/{incidentId}/resolution")
    @Operation(
            summary = "Register the resolution; the incident becomes RESUELTA",
            description = "Body: resolutionText (1..1000 after trimming). Only from EN_REVISION; otherwise (including"
                    + " an already resolved incident) 409 INVALID_STATUS_TRANSITION.")
    public AdminIncidentDto resolve(
            @AuthenticationPrincipal AuthenticatedUser staff,
            @PathVariable String incidentId,
            @Valid @RequestBody ResolveIncidentRequestDto request) {
        return IncidentDtoMapper.toAdminDto(service.resolve(new IncidentAdminService.ResolveCommand(
                incidentId, request.resolutionText(), staff.id(), staff.rol())));
    }
}
