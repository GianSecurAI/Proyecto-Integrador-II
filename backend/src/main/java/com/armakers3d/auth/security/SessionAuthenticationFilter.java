package com.armakers3d.auth.security;

import com.armakers3d.auth.service.SessionService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates the opaque session cookie into the Spring Security context. Deliberately does not
 * reject anything: requests without a valid session simply stay anonymous and the central
 * {@code authorizeHttpRequests} rules decide (public endpoints pass, protected ones get 401 from
 * the entry point). The account is re-loaded and must be active on every request, and the role
 * comes from that live record (see {@link SessionService#authenticate}).
 *
 * <p>Not a Spring bean on purpose: a {@code Filter} bean would also be auto-registered in the
 * servlet container, running it twice. {@code SecurityConfig} instantiates it inside the chain.
 */
public class SessionAuthenticationFilter extends OncePerRequestFilter {

    private final SessionService sessionService;

    public SessionAuthenticationFilter(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        sessionService
                .extractToken(request)
                .flatMap(sessionService::authenticate)
                .map(AuthenticatedUser::from)
                .ifPresent(user -> SecurityContextHolder.getContext()
                        .setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                                user, null, List.of(new SimpleGrantedAuthority(user.authority())))));
        filterChain.doFilter(request, response);
    }
}
