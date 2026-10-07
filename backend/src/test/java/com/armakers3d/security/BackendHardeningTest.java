package com.armakers3d.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.users.AbstractNoDbRbacTest;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Stage 15 backend security review: regression tests for input hardening, path matching, error handling and
 * information exposure, on the full application (nodb profile) through the real Spring Security chain.
 */
class BackendHardeningTest extends AbstractNoDbRbacTest {

    // ---------- pagination int overflow ----------

    @Test
    void aHugePageNumberIsAnEmptyPageNotAServerErrorOnEveryListEndpoint() throws Exception {
        Cookie cliente = signInAs(Rol.CLIENTE);
        Cookie asesor = signInAs(Rol.ASESOR);
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        String hugePage = "?page=2147483647&size=100";

        mockMvc.perform(get("/api/catalog/products" + hugePage))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty());
        mockMvc.perform(get("/api/orders" + hugePage).cookie(cliente)).andExpect(status().isOk());
        mockMvc.perform(get("/api/incidents" + hugePage).cookie(cliente)).andExpect(status().isOk());
        mockMvc.perform(get("/api/admin/orders" + hugePage).cookie(asesor)).andExpect(status().isOk());
        mockMvc.perform(get("/api/admin/incidents" + hugePage).cookie(asesor)).andExpect(status().isOk());
        mockMvc.perform(get("/api/admin/users" + hugePage).cookie(admin)).andExpect(status().isOk());
        mockMvc.perform(get("/api/admin/products" + hugePage).cookie(admin)).andExpect(status().isOk());
    }

    @Test
    void pageSizeAboveTheCapIsRejected() throws Exception {
        mockMvc.perform(get("/api/catalog/products?size=101")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/catalog/products?size=2147483647")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/catalog/products?page=-1")).andExpect(status().isBadRequest());
    }

    // ---------- date range overflow (was a 500) ----------

    @Test
    void absurdDateYearsAreAValidationErrorNotAServerError() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        Cookie asesor = signInAs(Rol.ASESOR);
        for (String to : List.of("+999999999-12-31", "3000-01-01")) {
            mockMvc.perform(get("/api/admin/reports/orders?from=2999-01-01&to=" + to).cookie(admin))
                    .andExpect(status().isBadRequest());
            mockMvc.perform(get("/api/admin/reports/incidents?to=" + to).cookie(admin))
                    .andExpect(status().isBadRequest());
            mockMvc.perform(get("/api/admin/orders?to=" + to).cookie(asesor)).andExpect(status().isBadRequest());
        }
        mockMvc.perform(get("/api/admin/orders?from=1999-12-31").cookie(asesor)).andExpect(status().isBadRequest());
    }

    // ---------- path matching ----------

    @Test
    void pathVariantsNeverReachProtectedDataForAnonymousOrCustomerCallers() throws Exception {
        Cookie cliente = signInAs(Rol.CLIENTE);
        List<String> paths = List.of(
                "/api/admin/users/",
                "/api/admin/users//",
                "/API/admin/users",
                "/api/Admin/users",
                "/api/admin/users.json",
                "/api/admin/users;x=1",
                "/api/admin/users/%2e%2e/users",
                "/api/orders/..%2fadmin/users",
                "/api/orders/%2e%2e/admin/users",
                "/api/customers/../admin/users",
                "/api/admin/reports/orders/",
                "/api/admin/orders/personalized/",
                "/api//admin/users");
        for (String path : paths) {
            for (Cookie cookie : new Cookie[] {null, cliente}) {
                var request = get(path);
                if (cookie != null) {
                    request.cookie(cookie);
                }
                MvcResult result = mockMvc.perform(request).andReturn();
                assertThat(result.getResponse().getStatus())
                        .as("%s as %s", path, cookie == null ? "anonymous" : "CLIENTE")
                        .isBetween(400, 499);
                assertThat(result.getResponse().getContentAsString()).doesNotContain("content");
            }
        }
    }

    @Test
    void methodOverrideHeadersDoNotTurnAReadIntoAWrite() throws Exception {
        Cookie cliente = signInAs(Rol.CLIENTE);
        mockMvc.perform(get("/api/admin/users/1").cookie(cliente).header("X-HTTP-Method-Override", "DELETE"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/admin/users/1/role?_method=PATCH").cookie(cliente))
                .andExpect(status().isForbidden());
    }

    // ---------- malformed / hostile bodies and headers ----------

    @Test
    void anUnsupportedContentTypeIsA415WithTheEnvelope() throws Exception {
        mockMvc.perform(post("/api/auth/otp/request").contentType(MediaType.TEXT_PLAIN).content("email=a@example.test"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_MEDIA_TYPE"));
        mockMvc.perform(post("/api/auth/otp/request")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .content("email=a@example.test"))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void anAcceptHeaderTheApiCannotSatisfyIsA406NotA500() throws Exception {
        mockMvc.perform(get("/api/catalog/products").accept(MediaType.APPLICATION_XML))
                .andExpect(status().isNotAcceptable())
                .andExpect(jsonPath("$.code").value("NOT_ACCEPTABLE"));
    }

    @Test
    void aGiantStringInAPublicBodyIsRejectedByTheParserLimitBeforeValidation() throws Exception {
        String body = """
                {"email":"%s@example.test"}""".formatted("a".repeat(25_000));
        mockMvc.perform(post("/api/auth/otp/request").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
    }

    @Test
    void aVeryDeeplyNestedBodyIsRejectedAs400() throws Exception {
        String deep = "[".repeat(200) + "]".repeat(200);
        mockMvc.perform(post("/api/auth/otp/request").contentType(MediaType.APPLICATION_JSON).content(deep))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        String deepObject = """
                {"a":""".repeat(200) + "1" + "}".repeat(200);
        mockMvc.perform(post("/api/auth/otp/verify").contentType(MediaType.APPLICATION_JSON).content(deepObject))
                .andExpect(status().isBadRequest());
    }

    @Test
    void malformedJsonDoesNotEchoTheInputOrLeakInternals() throws Exception {
        String broken = """
                {"email": "secret-marker@example.test", """;
        String body = mockMvc.perform(post("/api/auth/otp/request").contentType(MediaType.APPLICATION_JSON).content(broken))
                .andExpect(status().isBadRequest())
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertThat(body).doesNotContain("secret-marker").doesNotContain("Exception").doesNotContain("com.fasterxml");
    }

    // ---------- forged fields / mass assignment on privileged operations ----------

    @Test
    void forgedPrivilegedFieldsInAProfileUpdateAreIgnored() throws Exception {
        String email = uniqueEmail("mass");
        Cookie cookie = signIn(email);
        mockMvc.perform(put("/api/customers/me")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "firstName", "Ana",
                                "rol", "ADMINISTRADOR",
                                "role", "ADMINISTRADOR",
                                "active", false,
                                "email", "other@example.test",
                                "id", 1))))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/auth/me").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.role").value("CLIENTE"));
        mockMvc.perform(get("/api/admin/users").cookie(cookie)).andExpect(status().isForbidden());
    }

    @Test
    void anAdvisorCannotElevateItselfOrAnyoneElse() throws Exception {
        Cookie asesor = signInAs(Rol.ASESOR);
        mockMvc.perform(patch("/api/admin/users/1/role")
                        .cookie(asesor)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("role", "ADMINISTRADOR"))))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/admin/users")
                        .cookie(asesor)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", uniqueEmail("promote"), "role", "ADMINISTRADOR"))))
                .andExpect(status().isForbidden());
    }

    // ---------- information exposure ----------

    @Test
    void onlyTheHealthActuatorEndpointIsReachableAndItShowsNoDetails() throws Exception {
        for (String path : List.of("/actuator", "/actuator/env", "/actuator/beans", "/actuator/heapdump",
                "/actuator/loggers", "/actuator/mappings")) {
            int code = mockMvc.perform(get(path)).andReturn().getResponse().getStatus();
            assertThat(code).as(path).isBetween(400, 499);
        }
        String health = mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertThat(health).doesNotContain("diskSpace").doesNotContain("details").doesNotContain("components");
    }

    @Test
    void apiResponsesCarryTheDefensiveHeaders() throws Exception {
        mockMvc.perform(get("/api/catalog/products"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")));
    }

    @Test
    void aForeignOriginPreflightIsRejectedAndTheAllowedOriginIsNotWildcarded() throws Exception {
        mockMvc.perform(options("/api/orders")
                        .header("Origin", "https://evil.example")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
        mockMvc.perform(options("/api/orders")
                        .header("Origin", "http://localhost:4200")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4200"));
    }
}
