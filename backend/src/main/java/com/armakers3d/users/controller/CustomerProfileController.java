package com.armakers3d.users.controller;

import com.armakers3d.auth.security.AuthenticatedUser;
import com.armakers3d.shared.error.ApiError;
import com.armakers3d.users.dto.CustomerProfileResponseDto;
import com.armakers3d.users.dto.CustomerProfileUpdateRequestDto;
import com.armakers3d.users.service.CustomerProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Customer self-service profile (contract review E5/E6). Role access (CLIENTE only) comes from the
 * central role matrix; the data returned is always the principal's own, so there is no id to forge.
 */
@RestController
@RequestMapping("/api/customers")
@Tag(name = "Customer profile", description = "The authenticated customer own account and profile.")
public class CustomerProfileController {

    private final CustomerProfileService profileService;

    public CustomerProfileController(CustomerProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping("/me")
    @Operation(summary = "Own account and profile")
    @ApiResponse(
            responseCode = "200",
            content = @Content(schema = @Schema(implementation = CustomerProfileResponseDto.class)))
    public CustomerProfileResponseDto me(@AuthenticationPrincipal AuthenticatedUser user) {
        return CustomerProfileResponseDto.from(profileService.getOwn(user.id()));
    }

    @PutMapping("/me")
    @Operation(summary = "Replace own editable profile fields (first name, last name, phone)")
    @ApiResponse(
            responseCode = "400",
            description = "Validation failed.",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public CustomerProfileResponseDto updateMe(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CustomerProfileUpdateRequestDto request) {
        return CustomerProfileResponseDto.from(
                profileService.updateOwn(user.id(), request.firstName(), request.lastName(), request.phone()));
    }
}
