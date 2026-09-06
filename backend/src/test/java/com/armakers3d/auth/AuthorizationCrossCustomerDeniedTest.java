package com.armakers3d.auth;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;

/**
 * T046 (Constitution Principle XII, NON-NEGOTIABLE): an authenticated customer is denied (403)
 * access to another customer's data (FR-016, spec.md User Story 4 Scenario 2) — the object-level
 * check in {@code CustomerSelfController} must compare the path id against the session's own
 * clienteId, never trust the path id alone.
 */
class AuthorizationCrossCustomerDeniedTest extends AbstractOtpIntegrationTest {

    @Test
    void customerCannotReadAnotherCustomersDataById() throws Exception {
        String emailA = uniqueEmail("customer-a");
        String emailB = uniqueEmail("customer-b");
        Cookie sessionA = registerAndGetSessionCookie(emailA);
        registerAndGetSessionCookie(emailB);
        Long customerBId = clienteRepository.findByEmail(emailB).orElseThrow().getId();

        getWithCookie("/api/customers/" + customerBId, sessionA).andExpect(status().isForbidden());
    }
}
