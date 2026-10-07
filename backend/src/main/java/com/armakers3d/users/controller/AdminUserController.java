package com.armakers3d.users.controller;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.auth.security.AuthenticatedUser;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import com.armakers3d.users.dto.ActiveChangeRequestDto;
import com.armakers3d.users.dto.AdminUserCreateRequestDto;
import com.armakers3d.users.dto.AdminUserDto;
import com.armakers3d.users.dto.RoleChangeRequestDto;
import com.armakers3d.users.service.UserAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.net.URI;
import org.springframework.http.ResponseEntity;
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
 * Administrator user management (contract review 4.5, E14-E17, plus staff provisioning).
 * ADMINISTRADOR only, enforced by the central role matrix. Thin: parameters in, one service call,
 * DTO out.
 */
@RestController
@RequestMapping("/api/admin/users")
@Tag(name = "Admin users", description = "User administration (ADMINISTRADOR only).")
public class AdminUserController {

    private final UserAdminService userAdminService;

    public AdminUserController(UserAdminService userAdminService) {
        this.userAdminService = userAdminService;
    }

    @GetMapping
    @Operation(
            summary = "List users",
            description = "Filters q (email substring), role, active; sort = createdAt|email[,asc|desc].")
    public Page<AdminUserDto> list(
            @RequestParam(required = false) @Size(max = 100, message = "q must be at most 100 characters") String q,
            @RequestParam(required = false) Rol role,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") @Min(value = 0, message = "page must be >= 0") int page,
            @RequestParam(defaultValue = "20")
                    @Min(value = 1, message = "size must be between 1 and 100")
                    @Max(value = 100, message = "size must be between 1 and 100")
                    int size,
            @RequestParam(required = false) String sort) {
        return userAdminService
                .list(new UserAdminService.UserFilter(q, role, active), new PageRequest(page, size), sort)
                .map(AdminUserDto::from);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a user")
    public AdminUserDto get(@PathVariable Long id) {
        return AdminUserDto.from(userAdminService.get(id));
    }

    @PostMapping
    @Operation(summary = "Provision a staff account (ASESOR or ADMINISTRADOR)")
    public ResponseEntity<AdminUserDto> create(
            @AuthenticationPrincipal AuthenticatedUser actor, @Valid @RequestBody AdminUserCreateRequestDto request) {
        AdminUserDto created =
                AdminUserDto.from(userAdminService.createStaff(actor.id(), request.email(), request.role()));
        return ResponseEntity.created(URI.create("/api/admin/users/" + created.id())).body(created);
    }

    @PatchMapping("/{id}/role")
    @Operation(summary = "Change the role of a user (revokes their sessions)")
    public AdminUserDto changeRole(
            @AuthenticationPrincipal AuthenticatedUser actor,
            @PathVariable Long id,
            @Valid @RequestBody RoleChangeRequestDto request) {
        return AdminUserDto.from(userAdminService.changeRole(actor.id(), id, request.role()));
    }

    @PatchMapping("/{id}/active")
    @Operation(summary = "Activate or deactivate a user (deactivation revokes their sessions)")
    public AdminUserDto setActive(
            @AuthenticationPrincipal AuthenticatedUser actor,
            @PathVariable Long id,
            @Valid @RequestBody ActiveChangeRequestDto request) {
        return AdminUserDto.from(userAdminService.setActive(actor.id(), id, request.active()));
    }
}
