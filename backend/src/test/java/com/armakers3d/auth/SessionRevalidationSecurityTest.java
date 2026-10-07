package com.armakers3d.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.Rol;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;

/**
 * Principle XII (NON-NEGOTIABLE), review finding H2, against the JPA adapters on H2: the session
 * is re-validated against the LIVE account on every request, so deactivation and demotion take
 * effect immediately even while the session row is still valid and still carries its old role.
 */
class SessionRevalidationSecurityTest extends AbstractOtpIntegrationTest {

    @Test
    void deactivatedAccountWithALiveSessionIsUnauthorized() throws Exception {
        String email = uniqueEmail("h2-deactivated").toLowerCase();
        Cookie cookie = registerAndGetSessionCookie(email);
        getWithCookie("/api/customers/me", cookie).andExpect(status().isOk());

        Cliente account = clienteRepository.findByEmail(email).orElseThrow();
        clienteRepository.save(account.withActive(false)); // no session revocation on purpose
        assertThat(sessionRepository.findById(com.armakers3d.auth.service.SessionService.storageKey(cookie.getValue())).orElseThrow().isValidAt(clock.instant())).isTrue();

        getWithCookie("/api/customers/me", cookie)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void demotedAdministratorWithALiveSessionLosesAdminAccess() throws Exception {
        String email = uniqueEmail("h2-demoted").toLowerCase();
        clienteRepository.save(Cliente.provisioned(email, Rol.ADMINISTRADOR, clock.instant()));
        requestOtp(email);
        Cookie cookie = verifyOtp(email, emailSender.lastCodeFor(email)).andReturn().getResponse().getCookie("ARM3D_SESSION");
        getWithCookie("/api/admin/users", cookie).andExpect(status().isOk());

        clienteRepository.save(clienteRepository.findByEmail(email).orElseThrow().withRol(Rol.CLIENTE));

        getWithCookie("/api/admin/users", cookie).andExpect(status().isForbidden());
        getWithCookie("/api/auth/me", cookie).andExpect(jsonPath("$.role").value("CLIENTE"));
    }

    @Test
    void revokeAllForClienteKillsEveryLiveSessionOfTheAccountOnly() throws Exception {
        String emailA = uniqueEmail("h2-revoke-a").toLowerCase();
        String emailB = uniqueEmail("h2-revoke-b").toLowerCase();
        Cookie a1 = registerAndGetSessionCookie(emailA);
        requestOtp(emailA);
        Cookie a2 = verifyOtp(emailA, emailSender.lastCodeFor(emailA)).andReturn().getResponse().getCookie("ARM3D_SESSION");
        Cookie b = registerAndGetSessionCookie(emailB);

        int revoked = sessionRepository.revokeAllForCliente(clienteRepository.findByEmail(emailA).orElseThrow().getId(), clock.instant());

        assertThat(revoked).isEqualTo(2);
        getWithCookie("/api/auth/me", a1).andExpect(status().isUnauthorized());
        getWithCookie("/api/auth/me", a2).andExpect(status().isUnauthorized());
        getWithCookie("/api/auth/me", b).andExpect(status().isOk());
    }

    @Test
    void apiDocumentationIsNotPublicOutsideLocalProfiles() throws Exception {
        getWithCookie("/api-docs", null).andExpect(status().isUnauthorized());
        getWithCookie("/swagger-ui.html", null).andExpect(status().isUnauthorized());
        getWithCookie("/api-docs", registerAndGetSessionCookie(uniqueEmail("h2-docs"))).andExpect(status().isForbidden());
    }
}
