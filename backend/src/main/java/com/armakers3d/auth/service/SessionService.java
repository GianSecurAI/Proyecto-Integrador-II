package com.armakers3d.auth.service;

import com.armakers3d.auth.config.SessionProperties;
import com.armakers3d.auth.domain.AuthenticatedSession;
import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.repository.AuthenticatedSessionRepository;
import com.armakers3d.auth.repository.ClienteRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Issues and resolves server-side sessions (research.md #3: opaque id in an httpOnly, Secure,
 * SameSite=Strict cookie — not a JWT, not browser-storage-based). Immediate invalidation (logout,
 * or an account later deactivated) is a single row update, not a token-blacklist mechanism.
 *
 * <p>Security review M5: the raw token exists only in the cookie. The store keeps {@link #storageKey}
 * (SHA-256 hex of the token) as the row id, so a leaked database or backup cannot be replayed as live
 * sessions. A 256-bit random token needs no salt or slow hash.
 */
@Service
public class SessionService {

    private static final int TOKEN_BYTES = 32;

    private final AuthenticatedSessionRepository sessionRepository;
    private final ClienteRepository clienteRepository;
    private final Clock clock;
    private final SessionProperties properties;
    private final SecureRandom secureRandom = new SecureRandom();

    public SessionService(
            AuthenticatedSessionRepository sessionRepository,
            ClienteRepository clienteRepository,
            Clock clock,
            SessionProperties properties) {
        this.sessionRepository = sessionRepository;
        this.clienteRepository = clienteRepository;
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
        sessionRepository.save(
                new AuthenticatedSession(
                        storageKey(token), session.getClienteId(), session.getRol(), now, session.getExpiresAt()));
        return session; // carries the RAW token (id) for the cookie; only the hash was stored
    }

    /** SHA-256 hex of a session token: the value the store uses as the row id (never the token itself). */
    public static String storageKey(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is always available", e);
        }
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
        return sessionRepository.findById(storageKey(token)).filter(session -> session.isValidAt(clock.instant()));
    }

    /**
     * Authenticates a request (H2 from the security review): resolves the session token, then
     * re-loads the account on EVERY request and requires it to still exist and be active. The role
     * is taken from the live account record, never from the session snapshot, so a demoted or
     * deactivated user loses privileges immediately even if their session row is still valid.
     */
    @Transactional(readOnly = true)
    public Optional<Cliente> authenticate(String token) {
        return resolve(token)
                .flatMap(session -> clienteRepository.findById(session.getClienteId()))
                .filter(Cliente::isActive);
    }

    /** Revokes every session of the account (deactivation, role change). Returns the count. */
    @Transactional
    public int revokeAllForCliente(Long clienteId) {
        return sessionRepository.revokeAllForCliente(clienteId, clock.instant());
    }

    /**
     * Revokes the session behind the token. Idempotent: an unknown, already-revoked or blank token
     * is a no-op, so logout never reveals whether a session existed.
     */
    @Transactional
    public void revoke(String token) {
        if (token == null || token.isBlank()) {
            return;
        }
        sessionRepository
                .findById(storageKey(token))
                .ifPresent(
                        session -> {
                            session.revoke(clock.instant());
                            sessionRepository.save(session);
                        });
    }

    /** Expires the session cookie in the browser (same attributes as when it was set, Max-Age=0). */
    public void clearCookie(HttpServletResponse response) {
        ResponseCookie cookie =
                ResponseCookie.from(properties.getCookieName(), "")
                        .httpOnly(true)
                        .secure(properties.isCookieSecure())
                        .sameSite("Strict")
                        .path("/")
                        .maxAge(Duration.ZERO)
                        .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    /** Reads the session token from the request cookies, if present. Single place for this rule. */
    public Optional<String> extractToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        for (Cookie cookie : cookies) {
            if (properties.getCookieName().equals(cookie.getName())) {
                return Optional.ofNullable(cookie.getValue());
            }
        }
        return Optional.empty();
    }

    private String generateOpaqueToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
