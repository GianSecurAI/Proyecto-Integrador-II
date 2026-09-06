package com.armakers3d.auth.service;

import com.armakers3d.auth.config.SessionProperties;
import com.armakers3d.auth.domain.AuthenticatedSession;
import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.repository.AuthenticatedSessionRepository;
import jakarta.servlet.http.HttpServletResponse;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Issues and resolves server-side sessions (research.md #3: opaque id in an httpOnly, Secure,
 * SameSite=Strict cookie — not a JWT, not browser-storage-based). Immediate invalidation (logout,
 * or an account later deactivated) is a single row update, not a token-blacklist mechanism.
 */
@Service
public class SessionService {

    private static final int TOKEN_BYTES = 32;

    private final AuthenticatedSessionRepository sessionRepository;
    private final Clock clock;
    private final SessionProperties properties;
    private final SecureRandom secureRandom = new SecureRandom();

    public SessionService(
            AuthenticatedSessionRepository sessionRepository, Clock clock, SessionProperties properties) {
        this.sessionRepository = sessionRepository;
        this.clock = clock;
        this.properties = properties;
    }

    @Transactional
    public AuthenticatedSession create(Cliente cliente) {
        Instant now = clock.instant();
        String token = generateOpaqueToken();
        AuthenticatedSession session =
                new AuthenticatedSession(
                        token,
                        cliente.getId(),
                        cliente.getRol(),
                        now,
                        now.plus(Duration.ofHours(properties.getTtlHours())));
        return sessionRepository.save(session);
    }

    /** Attaches the session as an httpOnly/Secure/SameSite=Strict cookie on the HTTP response. */
    public void attachCookie(HttpServletResponse response, AuthenticatedSession session) {
        ResponseCookie cookie =
                ResponseCookie.from(properties.getCookieName(), session.getId())
                        .httpOnly(true)
                        .secure(properties.isCookieSecure())
                        .sameSite("Strict")
                        .path("/")
                        .maxAge(Duration.ofHours(properties.getTtlHours()))
                        .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    /** Resolves a session token to a still-valid (non-expired, non-revoked) session, if any. */
    @Transactional(readOnly = true)
    public Optional<AuthenticatedSession> resolve(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        return sessionRepository.findById(token).filter(session -> session.isValidAt(clock.instant()));
    }

    @Transactional
    public void revoke(String token) {
        sessionRepository.findById(token).ifPresent(session -> session.revoke(clock.instant()));
    }

    private String generateOpaqueToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
