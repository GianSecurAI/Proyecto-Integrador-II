package com.armakers3d.auth;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;

/**
 * T045 (Constitution Principle XII, NON-NEGOTIABLE): an authenticated customer can access their
 * own data via a protected sample endpoint (FR-016, spec.md User Story 4 Scenario 1).
 */
class AuthorizationOwnDataTest extends AbstractOtpIntegrationTest {

    @Test
    void authenticatedCustomerCanReadOwnDataViaMe() throws Exception {
        String email = uniqueEmail("own-data-me");
        Cookie sessionCookie = registerAndGetSessionCookie(email);

        getWithCookie("/api/customers/me", sessionCookie)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email));
    }

    @Test
    void authenticatedCustomerCanReadOwnDataByOwnId() throws Exception {
        String email = uniqueEmail("own-data-id");
        Cookie sessionCookie = registerAndGetSessionCookie(email);
        Long ownId = clienteRepository.findByEmail(email).orElseThrow().getId();

        getWithCookie("/api/customers/" + ownId, sessionCookie)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email));
    }
}
