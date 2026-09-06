package com.armakers3d.auth.controller;

import com.armakers3d.auth.domain.AuthenticatedSession;
import com.armakers3d.auth.dto.OtpRequestDto;
import com.armakers3d.auth.dto.OtpRequestResponseDto;
import com.armakers3d.auth.dto.OtpVerifyDto;
import com.armakers3d.auth.dto.OtpVerifyResponseDto;
import com.armakers3d.auth.service.OtpService;
import com.armakers3d.auth.service.SessionService;
import com.armakers3d.shared.error.ApiError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Exposes the two OTP endpoints per contracts/otp-auth-api.md (FR-001 through FR-015). Stays
 * thin: request/response mapping and validation triggering only — every business rule lives in
 * {@link OtpService}/{@link SessionService} (Constitution Principle IV, Prohibited Practices #4).
 */
@RestController
@RequestMapping("/api/auth/otp")
@Tag(name = "Customer OTP Authentication", description = "Email one-time-code registration and login for the Cliente role (FR-001-FR-017).")
public class OtpAuthController {

    private final OtpService otpService;
    private final SessionService sessionService;

    public OtpAuthController(OtpService otpService, SessionService sessionService) {
        this.otpService = otpService;
        this.sessionService = sessionService;
    }

    @PostMapping("/request")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(
            summary = "Request a one-time code",
            description =
                    "Always responds identically (202) whether or not the email belongs to an existing "
                            + "account (FR-004 anti-enumeration guarantee).")
    @ApiResponse(
            responseCode = "202",
            description = "Generic acknowledgment; a code was sent if the email is valid.",
            content = @Content(schema = @Schema(implementation = OtpRequestResponseDto.class)))
    @ApiResponse(
            responseCode = "400",
            description = "Email missing or not a syntactically valid address.",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "429",
            description = "The email already reached its request limit for the current throttling window.",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public OtpRequestResponseDto requestOtp(@Valid @RequestBody OtpRequestDto request) {
        otpService.requestOtp(request.email());
        return OtpRequestResponseDto.generic();
    }

    @PostMapping("/verify")
    @Operation(
            summary = "Verify a one-time code",
            description =
                    "On success, establishes a server-side session via an httpOnly/Secure/SameSite=Strict "
                            + "cookie and reveals whether the account was just created (FR-004a).")
    @ApiResponse(
            responseCode = "200",
            description = "Code verified; session cookie set.",
            content = @Content(schema = @Schema(implementation = OtpVerifyResponseDto.class)))
    @ApiResponse(
            responseCode = "401",
            description = "Code does not match the newest issued code for the email.",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "410",
            description = "Code matched but has expired, or was already used.",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "429",
            description = "The targeted code already reached its maximum attempt count.",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public ResponseEntity<OtpVerifyResponseDto> verifyOtp(
            @Valid @RequestBody OtpVerifyDto request, HttpServletResponse response) {
        OtpService.VerificationResult result = otpService.verifyOtp(request.email(), request.code());
        AuthenticatedSession session = sessionService.create(result.cliente());
        sessionService.attachCookie(response, session);

        String accountStatus = result.accountJustCreated() ? OtpVerifyResponseDto.CREATED : OtpVerifyResponseDto.EXISTING;
        return ResponseEntity.ok(new OtpVerifyResponseDto(accountStatus));
    }
}
