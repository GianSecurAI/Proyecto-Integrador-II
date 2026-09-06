package com.armakers3d.auth.security;

import com.armakers3d.auth.config.SessionProperties;
import com.armakers3d.auth.domain.AuthenticatedSession;
import com.armakers3d.auth.service.SessionService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Resolves the session cookie on every request into request attributes ({@link #ATTR_CLIENTE_ID},
 * {@link #ATTR_ROL}) that downstream authorization logic (RoleAuthorizationInterceptor,
 * controllers doing object-level checks) reads. Deliberately does not reject unauthenticated
 * requests itself — a request to a public endpoint (e.g. the OTP endpoints themselves) must not
 * be blocked here; only {@link RequireRole}-annotated endpoints enforce authentication/role,
 * via the interceptor, per Constitution Principle VII.
 */
@Component
public class SessionAuthenticationFilter extends OncePerRequestFilter {

    public static final String ATTR_CLIENTE_ID = "auth.clienteId";
    public static final String ATTR_ROL = "auth.rol";

    private final SessionService sessionService;
    private final SessionProperties sessionProperties;

    public SessionAuthenticationFilter(SessionService sessionService, SessionProperties sessionProperties) {
        this.sessionService = sessionService;
        this.sessionProperties = sessionProperties;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        extractCookie(request, sessionProperties.getCookieName())
                .flatMap(sessionService::resolve)
                .ifPresent(session -> applyAuthenticatedAttributes(request, session));
        filterChain.doFilter(request, response);
    }

    private void applyAuthenticatedAttributes(HttpServletRequest request, AuthenticatedSession session) {
        request.setAttribute(ATTR_CLIENTE_ID, session.getClienteId());
        request.setAttribute(ATTR_ROL, session.getRol());
    }

    private Optional<String> extractCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName())) {
                return Optional.ofNullable(cookie.getValue());
            }
        }
        return Optional.empty();
    }
}
