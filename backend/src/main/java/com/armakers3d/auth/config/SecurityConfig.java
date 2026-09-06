package com.armakers3d.auth.config;

import com.armakers3d.auth.security.RoleAuthorizationInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Registers role-based endpoint authorization (Constitution Principle VII). Deliberately built
 * on a small custom filter/interceptor pair (see {@code auth.security}) instead of the full
 * Spring Security starter: this feature's authorization model is a single opaque server-side
 * session with two roles, and Spring Security's filter chain, form-login defaults, and CSRF
 * machinery would add configuration surface with no corresponding requirement here (Constitution
 * Principle II — no dependency/mechanism added without justification). If a future feature needs
 * OAuth2/method-security/ACLs, that is the point to reconsider this decision.
 */
@Configuration
public class SecurityConfig implements WebMvcConfigurer {

    private final RoleAuthorizationInterceptor roleAuthorizationInterceptor;
    private final String allowedOrigin;

    public SecurityConfig(
            RoleAuthorizationInterceptor roleAuthorizationInterceptor,
            @Value("${web.cors.allowed-origin}") String allowedOrigin) {
        this.roleAuthorizationInterceptor = roleAuthorizationInterceptor;
        this.allowedOrigin = allowedOrigin;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(roleAuthorizationInterceptor).addPathPatterns("/api/**");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // Credentialed (cookie-based) cross-origin requests require an explicit origin — "*" is
        // rejected by browsers when credentials are involved. The origin itself is externalized
        // configuration (Principle XIV/XVIII), never hardcoded.
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigin)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowCredentials(true);
    }
}
