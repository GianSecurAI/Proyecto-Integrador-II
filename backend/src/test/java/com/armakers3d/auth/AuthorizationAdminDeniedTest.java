package com.armakers3d.auth;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;

/**
 * T047 (Constitution Principle XII, NON-NEGOTIABLE): an authenticated customer is denied (403)
 * access to an administrator-only endpoint (FR-016, spec.md User Story 4 Scenario 3). Per
 * spec.md's Assumptions, this same ADMINISTRADOR check also stands in for "advisor-only" until
 * Open Question #2 (whether Asesor is a distinct role) is resolved — there is deliberately no
 * separate ASESOR check to test here.
 */
class AuthorizationAdminDeniedTest extends AbstractOtpIntegrationTest {

    @Test
    void clienteSessionIsDeniedAdministradorOnlyEndpoint() throws Exception {
        String email = uniqueEmail("customer-not-admin");
        Cookie sessionCookie = registerAndGetSessionCookie(email);

        getWithCookie("/api/customers", sessionCookie).andExpect(status().isForbidden());
    }
}
