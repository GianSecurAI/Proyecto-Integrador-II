package com.armakers3d.auth.config;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.auth.security.AccessMatrix;
import com.armakers3d.auth.security.ApiSecurityErrorHandlers;
import com.armakers3d.auth.security.MutationRateLimitFilter;
import com.armakers3d.auth.security.OtpIpRateLimitFilter;
import com.armakers3d.auth.security.SessionAuthenticationFilter;
import com.armakers3d.auth.service.SessionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

/**
 * Server-side authorization with Spring Security (Constitution Principle VII, NON-NEGOTIABLE).
 *
 * <ul>
 *   <li><b>Authentication</b> stays our own mechanism: the opaque, httpOnly, SameSite=Strict
 *       session cookie issued after email-OTP login, resolved by {@link SessionAuthenticationFilter}
 *       into an {@code Authentication} with authority {@code ROLE_<rol>}. No Spring HTTP sessions,
 *       no form login, no HTTP basic, no passwords.
 *   <li><b>Authorization</b> is the central {@link AccessMatrix} applied through
 *       {@code authorizeHttpRequests}, with {@code anyRequest().denyAll()} as the default. Method
 *       security ({@code @PreAuthorize}) is reserved for object-level (ownership) checks.
 *   <li><b>CSRF tokens are disabled</b>, deliberately: the API is JSON-only (no form posts, so a
 *       cross-site form cannot produce a valid request), the cookie is SameSite=Strict, CORS is a
 *       single credentialed allow-listed origin, and the SPA is deployed same-site with the API
 *       (contract review finding 14). The CORS filter, first in the chain, doubles as the Origin
 *       check: any request (simple POSTs included) whose {@code Origin} is neither this server nor
 *       the configured SPA origin is rejected with 403 before authentication runs. Revisit if the
 *       SPA and API ever become cross-site.
 * </ul>
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain apiSecurityFilterChain(
            HttpSecurity http,
            SessionService sessionService,
            ObjectMapper objectMapper,
            OtpPolicyProperties otpPolicy,
            MutationRateLimitProperties mutationLimit,
            Clock clock,
            @Value("${security.api-docs-public:false}") boolean apiDocsPublic)
            throws Exception {
        ApiSecurityErrorHandlers errorHandlers = new ApiSecurityErrorHandlers(objectMapper);
        PathPatternRequestMatcher.Builder paths = PathPatternRequestMatcher.withDefaults();

        http.csrf(csrf -> csrf.disable()) // justified in the class Javadoc
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .requestCache(cache -> cache.disable())
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .logout(logout -> logout.disable())
                .exceptionHandling(e -> e.authenticationEntryPoint(errorHandlers).accessDeniedHandler(errorHandlers))
                .headers(h -> h.contentTypeOptions(Customizer.withDefaults())
                        .frameOptions(f -> f.deny())
                        .cacheControl(Customizer.withDefaults()) // no-store on every API response, incl. /api/auth/**
                        .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER)))
                .addFilterBefore(new SessionAuthenticationFilter(sessionService), AnonymousAuthenticationFilter.class)
                // M3: per-IP throttle on the public OTP endpoints, before any session/DB work.
                .addFilterBefore(new OtpIpRateLimitFilter(otpPolicy, clock, objectMapper), SessionAuthenticationFilter.class)
                // BE-05: per-account mutation limit, after authentication (key = account id).
                .addFilterAfter(new MutationRateLimitFilter(mutationLimit, clock, objectMapper), SessionAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> {
                    // Operational: liveness probe only (no other actuator endpoint is exposed anyway).
                    auth.requestMatchers(paths.matcher("/actuator/health"), paths.matcher("/actuator/health/**"))
                            .permitAll();
                    // API documentation: open only where configured (local/nodb/test); otherwise ADMIN only.
                    var docs = auth.requestMatchers(
                            paths.matcher("/api-docs"),
                            paths.matcher("/api-docs/**"),
                            paths.matcher("/swagger-ui.html"),
                            paths.matcher("/swagger-ui/**"));
                    if (apiDocsPublic) {
                        docs.permitAll();
                    } else {
                        docs.hasRole(Rol.ADMINISTRADOR.name());
                    }
                    // The role matrix.
                    for (AccessMatrix.Rule rule : AccessMatrix.RULES) {
                        var spec = auth.requestMatchers(paths.matcher(rule.pattern()));
                        if (rule.access().isPublic()) {
                            spec.permitAll();
                        } else {
                            spec.hasAnyRole(rule.access().roles().stream().map(Rol::name).toArray(String[]::new));
                        }
                    }
                    // Default deny: anything not listed above is unreachable until a rule is added.
                    auth.anyRequest().denyAll();
                });
        return http.build();
    }
}
