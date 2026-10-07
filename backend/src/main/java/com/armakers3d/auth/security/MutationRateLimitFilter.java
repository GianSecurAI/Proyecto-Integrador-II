package com.armakers3d.auth.security;

import com.armakers3d.auth.config.MutationRateLimitProperties;
import com.armakers3d.shared.error.ApiError;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Per-account fixed-window limiter for authenticated mutating requests (BE-05, ADR-004 5.5). It runs AFTER
 * {@link SessionAuthenticationFilter}: the key is the account id of the authenticated principal, so one
 * compromised or buggy client cannot flood the write endpoints and one account never affects another.
 * Scope: POST, PUT, PATCH and DELETE under {@code /api/**}, except {@code /api/auth/**} (own limiters). This includes
 * the multipart payment-proof upload (ADR-005). Reads are never limited. Anonymous
 * requests have no account and are skipped (they are denied by the role matrix anyway).
 *
 * <p>In-memory, bounded to {@value #MAX_TRACKED_KEYS} keys and per instance (single-instance deployment,
 * same trade-off as {@link OtpIpRateLimitFilter}). Not a Spring bean on purpose, see that class. A throttled
 * request is audited with the account id only.
 */
public class MutationRateLimitFilter extends OncePerRequestFilter {

    public static final int MAX_TRACKED_KEYS = 10_000;
    private static final Set<String> MUTATING = Set.of("POST", "PUT", "PATCH", "DELETE");
    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.ratelimit");

    private record Window(Instant start, int count) {}

    private final MutationRateLimitProperties policy;
    private final Clock clock;
    private final ObjectMapper objectMapper;
    private final Map<Long, Window> windows = new ConcurrentHashMap<>();

    public MutationRateLimitFilter(MutationRateLimitProperties policy, Clock clock, ObjectMapper objectMapper) {
        this.policy = policy;
        this.clock = clock;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return !MUTATING.contains(request.getMethod())
                || !uri.startsWith("/api/")
                || uri.startsWith("/api/auth/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof AuthenticatedUser user)) {
            chain.doFilter(request, response);
            return;
        }
        Duration window = Duration.ofMinutes(policy.getWindowMinutes());
        Instant now = clock.instant();
        Long key = user.id();

        if (windows.size() >= MAX_TRACKED_KEYS && !windows.containsKey(key)) {
            evict(now, window);
        }
        Window current = windows.compute(key, (k, w) ->
                w == null || !w.start().plus(window).isAfter(now) ? new Window(now, 1) : new Window(w.start(), w.count() + 1));

        if (current.count() > policy.getMutationsPerWindow()) {
            long retryAfter = Math.max(1, Duration.between(now, current.start().plus(window)).toSeconds());
            if (current.count() == policy.getMutationsPerWindow() + 1) {
                audit.warn("ratelimit.mutations.exceeded account={}", user.id()); // once per window, ids only
            }
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", Long.toString(retryAfter));
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            objectMapper.writeValue(
                    response.getOutputStream(), ApiError.of("RATE_LIMITED", "Too many requests. Please try again later."));
            return;
        }
        chain.doFilter(request, response);
    }

    /** Drops expired windows; if the map is still full, drops the oldest one so memory stays bounded. */
    private void evict(Instant now, Duration window) {
        windows.entrySet().removeIf(e -> !e.getValue().start().plus(window).isAfter(now));
        if (windows.size() >= MAX_TRACKED_KEYS) {
            windows.entrySet().stream()
                    .min((a, b) -> a.getValue().start().compareTo(b.getValue().start()))
                    .ifPresent(e -> windows.remove(e.getKey()));
        }
    }
}
