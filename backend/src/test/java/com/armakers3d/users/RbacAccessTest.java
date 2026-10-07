package com.armakers3d.users;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.testsupport.MutableClock;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Constitution Principle VII / XII (NON-NEGOTIABLE): role-based access enforced server-side by the
 * Spring Security chain, object-level ownership, and session re-validation against the live
 * account on every request (H2 of the security review).
 */
class RbacAccessTest extends AbstractNoDbRbacTest {

    private static final String UNAUTHENTICATED = "UNAUTHENTICATED";

    // ---------- roles ----------

    @Test
    void clienteCannotReachStaffOrAdminResources() throws Exception {
        Cookie cliente = signInAs(Rol.CLIENTE);

        for (MockHttpServletRequestBuilder request : adminRequests()) {
            mockMvc.perform(request.cookie(cliente))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        }
    }

    @Test
    void asesorCannotReachAdminEndpointsAndCustomerOnlyEndpoints() throws Exception {
        Cookie asesor = signInAs(Rol.ASESOR);

        for (MockHttpServletRequestBuilder request : adminRequests()) {
            mockMvc.perform(request.cookie(asesor)).andExpect(status().isForbidden());
        }
        // Customer-only (own profile / checkout side): staff are denied, not silently served.
        mockMvc.perform(get("/api/customers/me").cookie(asesor)).andExpect(status().isForbidden());
        mockMvc.perform(put("/api/customers/me")
                        .cookie(asesor)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
        // The only operational resource that exists today for staff: introspection of the session.
        mockMvc.perform(get("/api/auth/me").cookie(asesor))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ASESOR"));
    }

    @Test
    void administradorReachesAdminEndpointsButNotCustomerOnlyOnes() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);

        mockMvc.perform(get("/api/admin/users").cookie(admin)).andExpect(status().isOk());
        mockMvc.perform(get("/api/auth/me").cookie(admin)).andExpect(jsonPath("$.role").value("ADMINISTRADOR"));
        mockMvc.perform(get("/api/customers/me").cookie(admin)).andExpect(status().isForbidden());
    }

    @Test
    void checkoutIsCustomerOnlyAndTheInterimOrderPostIsGone() throws Exception {
        Cookie cliente = signInAs(Rol.CLIENTE);
        String validBody = "{\"items\":[{\"productId\":1,\"quantity\":1}],\"delivery\":{\"address\":\"A\",\"district\":\"B\"},"
                + "\"contact\":{\"fullName\":\"N\",\"phone\":\"123456\"}}";
        for (Rol rol : new Rol[] {Rol.ASESOR, Rol.ADMINISTRADOR}) {
            Cookie staff = signInAs(rol);
            mockMvc.perform(post("/api/checkout").cookie(staff).contentType(MediaType.APPLICATION_JSON).content(validBody))
                    .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
            mockMvc.perform(get("/api/checkout/3f2b8c1e-0000-4000-8000-000000000000").cookie(staff))
                    .andExpect(status().isForbidden());
        }
        mockMvc.perform(post("/api/checkout").contentType(MediaType.APPLICATION_JSON).content(validBody))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(UNAUTHENTICATED));
        mockMvc.perform(get("/api/checkout/3f2b8c1e-0000-4000-8000-000000000000"))
                .andExpect(status().isUnauthorized());
        // BE-10: nobody can create an order directly any more (the route is now only readable: POST is not allowed)
        mockMvc.perform(post("/api/orders").cookie(cliente).contentType(MediaType.APPLICATION_JSON).content(validBody))
                .andExpect(status().isMethodNotAllowed());
        mockMvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON).content(validBody))
                .andExpect(status().isUnauthorized());
    }


    @Test
    void paymentVerificationIsAdministratorOnlyAndTheGatewayWebhookNoLongerExists() throws Exception {
        String id = "3f2b8c1e-0000-4000-8000-000000000000";
        Cookie asesor = signInAs(Rol.ASESOR);
        Cookie cliente = signInAs(Rol.CLIENTE);
        for (Cookie cookie : new Cookie[] {asesor, cliente}) {
            mockMvc.perform(get("/api/admin/payments").cookie(cookie)).andExpect(status().isForbidden());
            mockMvc.perform(get("/api/admin/payments/" + id).cookie(cookie)).andExpect(status().isForbidden());
            mockMvc.perform(get("/api/admin/payments/" + id + "/proof/" + id).cookie(cookie)).andExpect(status().isForbidden());
            mockMvc.perform(post("/api/admin/payments/" + id + "/approve").cookie(cookie)).andExpect(status().isForbidden());
            mockMvc.perform(post("/api/admin/payments/" + id + "/reject").cookie(cookie)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"x\"}")).andExpect(status().isForbidden());
        }
        mockMvc.perform(get("/api/admin/payments")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/admin/payments/" + id + "/approve")).andExpect(status().isUnauthorized());
        // the customer-only proof endpoints are closed to staff
        for (Rol rol : new Rol[] {Rol.ASESOR, Rol.ADMINISTRADOR}) {
            Cookie staff = signInAs(rol);
            mockMvc.perform(get("/api/checkout/" + id + "/proof/" + id).cookie(staff)).andExpect(status().isForbidden());
            mockMvc.perform(post("/api/checkout/" + id + "/cancel").cookie(staff)).andExpect(status().isForbidden());
        }
        // ADR-005: no provider webhook route exists: denied by default like any unknown path
        mockMvc.perform(post("/api/payments/webhooks/fake").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/payments/webhooks/fake").cookie(signInAs(Rol.ADMINISTRADOR))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void everyProtectedRouteAnswers401WithTheEnvelopeWhenAnonymous() throws Exception {
        for (MockHttpServletRequestBuilder request : adminRequests()) {
            mockMvc.perform(request).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(UNAUTHENTICATED));
        }
        mockMvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(UNAUTHENTICATED));
        mockMvc.perform(get("/api/customers/me")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(UNAUTHENTICATED));
        mockMvc.perform(put("/api/customers/me").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/customers/1")).andExpect(status().isUnauthorized()); // retired (BE-06)
    }

    @Test
    void unmappedApiRoutesAreDeniedByDefault() throws Exception {
        mockMvc.perform(get("/api/anything-else")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/anything-else").cookie(signInAs(Rol.ADMINISTRADOR))).andExpect(status().isForbidden());
    }

    @Test
    void apiDocsAreOpenInTheNodbProfileOnly() throws Exception {
        mockMvc.perform(get("/api-docs")).andExpect(status().isOk());
    }

    // ---------- sessions ----------

    @Test
    void expiredSessionIsUnauthorized() throws Exception {
        Cookie cookie = signInAs(Rol.CLIENTE);
        mockMvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isOk());

        ((MutableClock) clock).advance(Duration.ofHours(25));

        mockMvc.perform(get("/api/auth/me").cookie(cookie))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(UNAUTHENTICATED));
    }

    @Test
    void revokedSessionIsUnauthorized() throws Exception {
        Cookie cookie = signInAs(Rol.ASESOR);

        mockMvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized());
    }

    @Test
    void deactivatedAccountWithALiveSessionIsUnauthorizedOnTheNextRequest() throws Exception {
        String email = uniqueEmail("deactivated");
        Cookie cookie = signIn(email);
        mockMvc.perform(get("/api/customers/me").cookie(cookie)).andExpect(status().isOk());

        // Deactivate straight in the store WITHOUT revoking: the session row stays valid.
        Cliente account = clienteRepository.findByEmail(email).orElseThrow();
        clienteRepository.save(account.withActive(false));
        assertThat(sessionRepository.findById(com.armakers3d.auth.service.SessionService.storageKey(cookie.getValue())).orElseThrow().isValidAt(clock.instant())).isTrue();

        mockMvc.perform(get("/api/customers/me").cookie(cookie)).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized());
    }

    @Test
    void demotedAdministratorWithALiveSessionLosesPrivilegesImmediately() throws Exception {
        String email = uniqueEmail("demoted");
        provision(email, Rol.ADMINISTRADOR);
        Cookie cookie = signIn(email);
        mockMvc.perform(get("/api/admin/users").cookie(cookie)).andExpect(status().isOk());

        // Role changed in the store only; the session snapshot still says ADMINISTRADOR.
        clienteRepository.save(clienteRepository.findByEmail(email).orElseThrow().withRol(Rol.CLIENTE));
        assertThat(sessionRepository.findById(com.armakers3d.auth.service.SessionService.storageKey(cookie.getValue())).orElseThrow().getRol()).isEqualTo(Rol.ADMINISTRADOR);

        mockMvc.perform(get("/api/admin/users").cookie(cookie)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(jsonPath("$.role").value("CLIENTE"));
    }

    @Test
    void promotedCustomerIsNotElevatedBySessionSnapshotButByTheLiveRecordOnly() throws Exception {
        String email = uniqueEmail("promoted");
        Cookie cookie = signIn(email); // CLIENTE
        clienteRepository.save(clienteRepository.findByEmail(email).orElseThrow().withRol(Rol.ASESOR));

        mockMvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(jsonPath("$.role").value("ASESOR"));
        mockMvc.perform(get("/api/customers/me").cookie(cookie)).andExpect(status().isForbidden());
    }

    // ---------- ownership ----------

    @Test
    void customerCannotReadAnotherCustomerAndMeIsAlwaysTheCallersOwnData() throws Exception {
        String emailA = uniqueEmail("owner-a");
        String emailB = uniqueEmail("owner-b");
        Cookie a = signIn(emailA);
        signIn(emailB);
        Long idA = idOf(emailA);
        Long idB = idOf(emailB);

        // GET /api/customers/{id} was retired (BE-06): default-deny, the same 403 for any id (own, other, unknown).
        mockMvc.perform(get("/api/customers/" + idB).cookie(a))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mockMvc.perform(get("/api/customers/999999").cookie(a)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/customers/" + idA).cookie(a)).andExpect(status().isForbidden());
        // A forged id in query/header cannot redirect /me to someone else.
        mockMvc.perform(get("/api/customers/me").param("id", String.valueOf(idB)).header("X-Customer-Id", idB).cookie(a))
                .andExpect(jsonPath("$.id").value(idA))
                .andExpect(jsonPath("$.email").value(emailA));
    }

    @Test
    void profileUpdateOnlyAffectsTheCaller() throws Exception {
        String emailA = uniqueEmail("profile-a");
        String emailB = uniqueEmail("profile-b");
        Cookie a = signIn(emailA);
        Cookie b = signIn(emailB);

        mockMvc.perform(put("/api/customers/me")
                        .cookie(a)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "firstName", " Ana ",
                                "lastName", "Quispe",
                                "phone", "+51 999-123-456",
                                "email", "hijack@example.test",
                                "role", "ADMINISTRADOR"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value("Ana"))
                .andExpect(jsonPath("$.lastName").value("Quispe"))
                .andExpect(jsonPath("$.phone").value("+51 999-123-456"))
                .andExpect(jsonPath("$.email").value(emailA))
                .andExpect(jsonPath("$.role").value("CLIENTE"));

        mockMvc.perform(get("/api/customers/me").cookie(a)).andExpect(jsonPath("$.firstName").value("Ana"));
        mockMvc.perform(get("/api/customers/me").cookie(b))
                .andExpect(jsonPath("$.firstName").doesNotExist())
                .andExpect(jsonPath("$.email").value(emailB));
    }

    // ---------- transport hardening ----------

    @Test
    void stateChangingRequestFromAForeignOriginIsRejectedAndTheAllowedOriginPasses() throws Exception {
        // Rejected by the CORS filter (first in the chain), before any authentication runs.
        mockMvc.perform(post("/api/auth/logout").header("Origin", "https://evil.example"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/auth/logout").header("Origin", "http://localhost:4200"))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/auth/otp/request")
                        .header("Origin", "https://evil.example")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "csrf@example.test"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void securityHeadersAreSetAndAuthResponsesAreNotCacheable() throws Exception {
        mockMvc.perform(get("/api/auth/me").cookie(signInAs(Rol.CLIENTE)))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")));
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"));
    }

    @Test
    void corsHeadersAreAlsoPresentOnSecurityErrors() throws Exception {
        mockMvc.perform(get("/api/auth/me").header("Origin", "http://localhost:4200"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4200"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    // ---------- helpers ----------

    /** One request per admin operation (ids are arbitrary: authorization is decided before any lookup). */
    private java.util.List<MockHttpServletRequestBuilder> adminRequests() throws Exception {
        return java.util.List.of(
                get("/api/admin/users"),
                get("/api/admin/users/1"),
                post("/api/admin/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "x@example.test", "role", "ASESOR"))),
                patch("/api/admin/users/1/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("role", "ASESOR"))),
                patch("/api/admin/users/1/active")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("active", false))));
    }
}
