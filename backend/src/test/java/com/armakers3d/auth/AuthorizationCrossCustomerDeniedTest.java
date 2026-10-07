package com.armakers3d.auth;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;

/**
 * T046 (Constitution Principle XII, NON-NEGOTIABLE): an authenticated customer is denied (403)
 * access to another customer's data (FR-016, spec.md User Story 4 Scenario 2) — the retired
 * {@code GET /api/customers/{id}} path (BE-06) is no longer mapped and falls to default-deny; {@code /me} is the only
 * customer profile route.
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
