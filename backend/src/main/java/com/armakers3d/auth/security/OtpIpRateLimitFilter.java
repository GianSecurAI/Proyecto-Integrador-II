package com.armakers3d.auth.security;

import com.armakers3d.auth.config.OtpPolicyProperties;
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
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Per-client-IP throttle for the two public OTP endpoints (security review M3). The per-email limits in
 * {@code OtpService} cannot stop one client rotating through many emails (mail bombing third parties,
 * filling the code table) or guessing across many accounts, so this adds a cheap fixed-window counter keyed
 * by {@code remoteAddr} and endpoint. In-memory, bounded and per instance: no new infrastructure (Principle II).
 *
 * <p>The key is {@code request.getRemoteAddr()}, not {@code X-Forwarded-For}: trusting that header would
 * let a client choose its own bucket. Behind a reverse proxy set {@code server.forward-headers-strategy=native}
 * so the container resolves the real client address; otherwise every client shares the proxy's bucket.
 *
 * <p>Not a Spring bean on purpose (it would be auto-registered in the servlet container as well); the
 * security configuration instantiates it inside the chain, after CORS and before session resolution.
 */
public class OtpIpRateLimitFilter extends OncePerRequestFilter {

    static final int MAX_TRACKED_KEYS = 10_000;
    private static final String OTP_PREFIX = "/api/auth/otp";

    private record Window(Instant start, int count) {}

    private final OtpPolicyProperties policy;
    private final Clock clock;
    private final ObjectMapper objectMapper;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public OtpIpRateLimitFilter(OtpPolicyProperties policy, Clock clock, ObjectMapper objectMapper) {
        this.policy = policy;
        this.clock = clock;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith(OTP_PREFIX) || "OPTIONS".equals(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        boolean verify = request.getRequestURI().contains("verify");
        int limit = verify ? policy.getIpMaxVerifyCalls() : policy.getIpMaxRequestCalls();
        Duration window = Duration.ofMinutes(policy.getRequestWindowMinutes());
        Instant now = clock.instant();
        String key = request.getRemoteAddr() + (verify ? "|verify" : "|request");

        if (windows.size() >= MAX_TRACKED_KEYS && !windows.containsKey(key)) {
            evict(now, window);
        }
        Window current = windows.compute(key, (k, w) ->
                w == null || !w.start().plus(window).isAfter(now) ? new Window(now, 1) : new Window(w.start(), w.count() + 1));

        if (current.count() > limit) {
            long retryAfter = Math.max(1, Duration.between(now, current.start().plus(window)).toSeconds());
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
