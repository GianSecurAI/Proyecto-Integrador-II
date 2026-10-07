package com.armakers3d.shared.config;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * CORS for the Angular SPA, expressed as a {@link CorsConfigurationSource} so that the Spring
 * Security CORS filter (first in the chain) applies it to every {@code /api/**} response,
 * including the 401/403 produced by the security filters themselves; without that, a browser would
 * hide those errors from the SPA. The origin is externalized configuration (Principle XIV/XVIII).
 */
@Configuration
public class CorsConfig {

    private final String allowedOrigin;

    public CorsConfig(@Value("${web.cors.allowed-origin}") String allowedOrigin) {
        this.allowedOrigin = allowedOrigin;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        // Credentialed (cookie-based) cross-origin requests require an explicit origin; "*" is
        // rejected by browsers when credentials are involved.
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(allowedOrigin));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(List.of("Idempotent-Replayed")); // lets the SPA tell a replayed order
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(1800L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }
}
