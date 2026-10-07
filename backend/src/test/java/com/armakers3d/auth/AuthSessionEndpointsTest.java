package com.armakers3d.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.Rol;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

/**
 * Contract review E3/E4 ({@code GET /api/auth/me}, {@code POST /api/auth/logout}) plus role
 * propagation for provisioned (non-self-registered) staff, against the JPA adapters on H2.
 * ASESOR is covered in {@code NoDbOtpFlowTest}: the V1 role check constraint does not permit
 * persisting it until a migration widens it.
 */
class AuthSessionEndpointsTest extends AbstractOtpIntegrationTest {

    @Test
    void meReturnsIdEmailAndRoleOfTheSessionAccount() throws Exception {
        String email = uniqueEmail("me");
        Cookie cookie = registerAndGetSessionCookie(email);

        getWithCookie("/api/auth/me", cookie)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.email").value(email.toLowerCase()))
                .andExpect(jsonPath("$.role").value("CLIENTE"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void meWithoutSessionIsUnauthorizedWithTheErrorEnvelope() throws Exception {
        getWithCookie("/api/auth/me", null)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        getWithCookie("/api/auth/me", new Cookie("ARM3D_SESSION", "garbage"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void meIsUnauthorizedOnceTheAccountIsDeactivated() throws Exception {
        String email = uniqueEmail("me-deactivated");
        Cookie cookie = registerAndGetSessionCookie(email);
        Cliente account = clienteRepository.findByEmail(email.toLowerCase()).orElseThrow();
        clienteRepository.save(new Cliente(account.getId(), account.getEmail(), account.getRol(), account.getCreatedAt(), false));

        getWithCookie("/api/auth/me", cookie).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesTheSessionClearsTheCookieAndTheSessionIsInvalidAfterwards() throws Exception {
        String email = uniqueEmail("logout");
        Cookie cookie = registerAndGetSessionCookie(email);
        getWithCookie("/api/auth/me", cookie).andExpect(status().isOk());

        var result = mockMvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isNoContent()).andReturn();

        String setCookie = result.getResponse().getHeader(HttpHeaders.SET_COOKIE);
        assertThat(setCookie).contains("ARM3D_SESSION=").contains("Max-Age=0").contains("HttpOnly").contains("SameSite=Strict");
        assertThat(sessionRepository.findById(com.armakers3d.auth.service.SessionService.storageKey(cookie.getValue())).orElseThrow().getRevokedAt()).isNotNull();
        // The old token is dead even if a client keeps replaying it.
        getWithCookie("/api/auth/me", cookie).andExpect(status().isUnauthorized());
        getWithCookie("/api/customers/me", cookie).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutIsIdempotentAndNeverLeaksWhetherASessionExisted() throws Exception {
        mockMvc.perform(post("/api/auth/logout")).andExpect(status().isNoContent());
        mockMvc.perform(post("/api/auth/logout").cookie(new Cookie("ARM3D_SESSION", "unknown-token")))
                .andExpect(status().isNoContent());

        Cookie cookie = registerAndGetSessionCookie(uniqueEmail("logout-twice"));
        mockMvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isNoContent());
        mockMvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isNoContent());
    }

    @Test
    void verifyResponseExposesTheRoleForSelfRegisteredCustomers() throws Exception {
        String email = uniqueEmail("verify-role");
        requestOtp(email);

        verifyOtp(email, emailSender.lastCodeFor(email))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountStatus").value("created"))
                .andExpect(jsonPath("$.role").value("CLIENTE"))
                .andExpect(jsonPath("$.email").value(email.toLowerCase()))
                .andExpect(jsonPath("$.id").isNumber());
    }

    @Test
    void verifyResponseIdentityMatchesWhatMeReturns() throws Exception {
        String email = uniqueEmail("verify-identity");
        requestOtp(email);

        var result = verifyOtp(email, emailSender.lastCodeFor(email)).andExpect(status().isOk())
                .andExpect(jsonPath("$.code").doesNotExist())
                .andReturn();
        String verifyBody = result.getResponse().getContentAsString();
        Cookie cookie = result.getResponse().getCookie("ARM3D_SESSION");
        String meBody = getWithCookie("/api/auth/me", cookie).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
        var v = om.readTree(verifyBody);
        var m = om.readTree(meBody);
        org.assertj.core.api.Assertions.assertThat(v.get("id")).isEqualTo(m.get("id"));
        org.assertj.core.api.Assertions.assertThat(v.get("email")).isEqualTo(m.get("email"));
        org.assertj.core.api.Assertions.assertThat(v.get("role")).isEqualTo(m.get("role"));
        org.assertj.core.api.Assertions.assertThat(v.has("accountStatus")).isTrue();
    }

    @Test
    void provisionedAdministratorSignsInWithTheSameOtpFlowAndKeepsTheirRole() throws Exception {
        String email = uniqueEmail("staff-admin").toLowerCase();
        clienteRepository.save(Cliente.provisioned(email, Rol.ADMINISTRADOR, clock.instant()));

        requestOtp(email).andExpect(status().isAccepted());
        var result = verifyOtp(email, emailSender.lastCodeFor(email))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountStatus").value("existing"))
                .andExpect(jsonPath("$.role").value("ADMINISTRADOR"))
                .andReturn();
        Cookie cookie = result.getResponse().getCookie("ARM3D_SESSION");

        getWithCookie("/api/auth/me", cookie).andExpect(jsonPath("$.role").value("ADMINISTRADOR"));
        getWithCookie("/api/admin/users", cookie).andExpect(status().isOk());
    }

    @Test
    void selfRegistrationAlwaysCreatesACustomerEvenForStaffLookingAddresses() throws Exception {
        String email = uniqueEmail("admin-lookalike");

        Cookie cookie = registerAndGetSessionCookie(email);

        getWithCookie("/api/auth/me", cookie).andExpect(jsonPath("$.role").value("CLIENTE"));
        getWithCookie("/api/admin/users", cookie).andExpect(status().isForbidden());
    }

    @Test
    void otpRequestIsIndistinguishableForStaffCustomerAndUnknownEmails() throws Exception {
        String staff = uniqueEmail("enum-staff").toLowerCase();
        String customer = uniqueEmail("enum-customer").toLowerCase();
        String unknown = uniqueEmail("enum-unknown").toLowerCase();
        clienteRepository.save(Cliente.provisioned(staff, Rol.ADMINISTRADOR, clock.instant()));
        clienteRepository.save(new Cliente(customer, clock.instant()));

        String staffBody = requestOtp(staff).andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();
        String customerBody = requestOtp(customer).andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();
        String unknownBody = requestOtp(unknown).andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();

        assertThat(staffBody).isEqualTo(customerBody).isEqualTo(unknownBody);
    }

    @Test
    void optionalProfileFieldsAreAcceptedWhenValidAndRejectedServerSideWhenNot() throws Exception {
        String email = uniqueEmail("profile");
        String ok = "{\"email\":\"" + email + "\",\"firstName\":\"Ana\",\"lastName\":\"Quispe\",\"phone\":\"+51 999-123-456\"}";
        mockMvc.perform(post("/api/auth/otp/request").contentType("application/json").content(ok))
                .andExpect(status().isAccepted());

        String badPhone = "{\"email\":\"" + email + "\",\"phone\":\"call me maybe\"}";
        mockMvc.perform(post("/api/auth/otp/request").contentType("application/json").content(badPhone))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("phone"));

        String longName = "{\"email\":\"" + email + "\",\"firstName\":\"" + "a".repeat(81) + "\"}";
        mockMvc.perform(post("/api/auth/otp/request").contentType("application/json").content(longName))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("firstName"));

        // Omitted profile fields stay valid (they are optional).
        requestOtp(uniqueEmail("profile-none")).andExpect(status().isAccepted());
    }

    @Test
    void logoutOnlyAcceptsPost() throws Exception {
        mockMvc.perform(get("/api/auth/logout")).andExpect(status().isMethodNotAllowed());
    }
}
