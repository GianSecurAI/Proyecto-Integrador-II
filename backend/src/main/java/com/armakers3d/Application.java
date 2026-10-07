package com.armakers3d;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Ar Makers 3D backend entry point. Spring Boot modular monolith organized by business domain
 * (auth, users, catalog, quotations, orders, incidents, notifications, reports, shared) per
 * project requirements and Constitution Principle IV.
 */
// UserDetailsServiceAutoConfiguration is excluded on purpose: there are no usernames/passwords
// (OTP-only login), and its default would create an in-memory user with a generated password.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@ConfigurationPropertiesScan
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
