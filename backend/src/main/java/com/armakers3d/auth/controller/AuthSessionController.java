package com.armakers3d.auth.controller;

import com.armakers3d.auth.dto.MeResponseDto;
import com.armakers3d.auth.security.AuthenticatedUser;
import com.armakers3d.auth.service.SessionService;
import com.armakers3d.shared.error.ApiError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Session introspection and termination (contract review E3/E4). Thin: all rules live in
 * {@link SessionService}; the role matrix lives in {@code AccessMatrix}.
 */
@RestController
@RequestMapping("/api/auth")
@Tag(name = "Session", description = "Current-session introspection and logout.")
public class AuthSessionController {

    private final SessionService sessionService;

    public AuthSessionController(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @GetMapping("/me")
    @Operation(summary = "Current authenticated account", description = "Identity and role taken from the session.")
    @ApiResponse(
            responseCode = "200",
            description = "The authenticated account.",
            content = @Content(schema = @Schema(implementation = MeResponseDto.class)))
    @ApiResponse(
            responseCode = "401",
            description = "No valid session (missing, expired, revoked) or the account is no longer active.",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public MeResponseDto me(@AuthenticationPrincipal AuthenticatedUser user) {
        // The principal was built from the live, active account record by the authentication filter.
        return new MeResponseDto(user.id(), user.email(), user.rol());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            summary = "Log out",
            description =
                    "Revokes the server-side session (if any) and expires the cookie. Idempotent: always 204, "
                            + "with or without a valid session.")
    @ApiResponse(responseCode = "204", description = "Session revoked (or none existed); cookie cleared.")
    public void logout(HttpServletRequest request, HttpServletResponse response) {
        sessionService.extractToken(request).ifPresent(sessionService::revoke);
        sessionService.clearCookie(response);
    }
}
