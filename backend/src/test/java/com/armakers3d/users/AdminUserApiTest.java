package com.armakers3d.users;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.auth.domain.Rol;
import jakarta.servlet.http.Cookie;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/** Admin user management and customer profile endpoints: behavior, validation and safety rules over HTTP. */
class AdminUserApiTest extends AbstractNoDbRbacTest {

    private ResultActions patchRole(Cookie actor, Long id, Object role) throws Exception {
        return mockMvc.perform(patch("/api/admin/users/" + id + "/role")
                .cookie(actor)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("role", role))));
    }

    private ResultActions patchActive(Cookie actor, Long id, Object active) throws Exception {
        return mockMvc.perform(patch("/api/admin/users/" + id + "/active")
                .cookie(actor)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("active", active))));
    }

    private ResultActions createStaff(Cookie actor, Object email, Object role) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("email", email);
        body.put("role", role);
        return mockMvc.perform(post("/api/admin/users")
                .cookie(actor)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body)));
    }

    // ---------- list / get ----------

    @Test
    void listSupportsFilteringSortingAndPaginationWithTheContractEnvelope() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        String tag = "zzlist" + System.nanoTime();
        for (int i = 0; i < 3; i++) {
            provision(tag + "-" + i + "@example.test", Rol.ASESOR);
        }
        provision(tag + "-customer@example.test", Rol.CLIENTE);

        mockMvc.perform(get("/api/admin/users")
                        .cookie(admin)
                        .param("q", tag.toUpperCase())
                        .param("role", "ASESOR")
                        .param("active", "true")
                        .param("sort", "email,desc")
                        .param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].email").value(tag + "-2@example.test"))
                .andExpect(jsonPath("$.content[0].role").value("ASESOR"))
                .andExpect(jsonPath("$.content[0].active").value(true))
                .andExpect(jsonPath("$.content[0].createdAt").exists())
                .andExpect(jsonPath("$.content[0].firstName").doesNotExist());

        mockMvc.perform(get("/api/admin/users").cookie(admin).param("q", tag).param("size", "2").param("page", "1"))
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.page").value(1));
    }

    @Test
    void listRejectsBadPagingAndUnknownSortWithTheEnvelope() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);

        mockMvc.perform(get("/api/admin/users").cookie(admin).param("size", "1000"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("size"));
        mockMvc.perform(get("/api/admin/users").cookie(admin).param("page", "-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mockMvc.perform(get("/api/admin/users").cookie(admin).param("sort", "passwordHash,asc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        mockMvc.perform(get("/api/admin/users").cookie(admin).param("role", "SUPERUSER"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
    }

    @Test
    void getReturnsTheContractShapeAndUnknownOrNonNumericIdsAreRejected() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        String email = uniqueEmail("get-user");
        Long id = provision(email, Rol.ASESOR).getId();

        mockMvc.perform(get("/api/admin/users/" + id).cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.role").value("ASESOR"))
                .andExpect(jsonPath("$.active").value(true));
        mockMvc.perform(get("/api/admin/users/987654321").cookie(admin))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(get("/api/admin/users/abc").cookie(admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
    }

    // ---------- create ----------

    @Test
    void createProvisionsAStaffAccountWhoSignsInWithOtpAndHasThatRole() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        String email = uniqueEmail("new-advisor").toUpperCase(); // normalized to lower-case

        var result = createStaff(admin, email, "ASESOR")
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", org.hamcrest.Matchers.startsWith("/api/admin/users/")))
                .andExpect(jsonPath("$.email").value(email.toLowerCase()))
                .andExpect(jsonPath("$.role").value("ASESOR"))
                .andExpect(jsonPath("$.active").value(true))
                .andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("password");

        Cookie newStaff = signIn(email.toLowerCase());
        mockMvc.perform(get("/api/auth/me").cookie(newStaff)).andExpect(jsonPath("$.role").value("ASESOR"));
        mockMvc.perform(get("/api/admin/users").cookie(newStaff)).andExpect(status().isForbidden());
    }

    @Test
    void createValidatesInputAndRefusesDuplicatesAndCustomerRole() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);

        createStaff(admin, "not-an-email", "ASESOR")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("email"));
        createStaff(admin, null, "ASESOR").andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors[0].field").value("email"));
        createStaff(admin, uniqueEmail("no-role"), null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("role"));
        createStaff(admin, uniqueEmail("customer-role"), "CLIENTE")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("role"));
        createStaff(admin, uniqueEmail("bad-role"), "ROOT")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        createStaff(admin, "a".repeat(250) + "@example.test", "ASESOR")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        String email = uniqueEmail("dup");
        createStaff(admin, email, "ASESOR").andExpect(status().isCreated());
        createStaff(admin, email, "ADMINISTRADOR").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONFLICT"));
    }

    // ---------- role / active ----------

    @Test
    void roleChangeAppliesAndRevokesTheTargetSessions() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        String email = uniqueEmail("promote-me");
        Cookie target = signIn(email);
        Long id = idOf(email);

        patchRole(admin, id, "ASESOR")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ASESOR"))
                .andExpect(jsonPath("$.id").value(id));

        assertThat(sessionRepository.findById(com.armakers3d.auth.service.SessionService.storageKey(target.getValue())).orElseThrow().getRevokedAt()).isNotNull();
        mockMvc.perform(get("/api/auth/me").cookie(target)).andExpect(status().isUnauthorized());
        Cookie relogin = signIn(email);
        mockMvc.perform(get("/api/auth/me").cookie(relogin)).andExpect(jsonPath("$.role").value("ASESOR"));
    }

    @Test
    void deactivationRevokesSessionsBlocksLoginAndReactivationRestoresIt() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        String email = uniqueEmail("deactivate-me");
        Cookie target = signIn(email);
        Long id = idOf(email);

        patchActive(admin, id, false).andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));

        assertThat(sessionRepository.findById(com.armakers3d.auth.service.SessionService.storageKey(target.getValue())).orElseThrow().getRevokedAt()).isNotNull();
        mockMvc.perform(get("/api/auth/me").cookie(target)).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/auth/otp/request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", email))));
        mockMvc.perform(post("/api/auth/otp/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", email, "code", emailSender.lastCodeFor(email)))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_DEACTIVATED"));

        patchActive(admin, id, true).andExpect(jsonPath("$.active").value(true));
        mockMvc.perform(get("/api/auth/me").cookie(signIn(email))).andExpect(status().isOk());
    }

    @Test
    void unknownTargetAndMalformedBodiesAreRejectedWithTheEnvelope() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);

        patchRole(admin, 987654321L, "ASESOR").andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        patchActive(admin, 987654321L, false).andExpect(status().isNotFound());

        Long id = provision(uniqueEmail("body-checks"), Rol.CLIENTE).getId();
        mockMvc.perform(patch("/api/admin/users/" + id + "/role").cookie(admin).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("role"));
        patchRole(admin, id, "ROOT").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        mockMvc.perform(patch("/api/admin/users/" + id + "/active").cookie(admin).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("active"));
        mockMvc.perform(patch("/api/admin/users/" + id + "/active").cookie(admin).contentType(MediaType.TEXT_PLAIN).content("true"))
                .andExpect(status().isUnsupportedMediaType());
    }

    // ---------- safety rules ----------

    @Test
    void anAdministratorCannotChangeOwnRoleOrDeactivateThemselves() throws Exception {
        String email = uniqueEmail("self-admin");
        provision(email, Rol.ADMINISTRADOR);
        Cookie admin = signIn(email);
        Long id = idOf(email);

        patchRole(admin, id, "CLIENTE").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SELF_MODIFICATION_NOT_ALLOWED"));
        patchActive(admin, id, false).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SELF_MODIFICATION_NOT_ALLOWED"));

        // Still an active administrator afterwards.
        mockMvc.perform(get("/api/admin/users/" + id).cookie(admin))
                .andExpect(jsonPath("$.role").value("ADMINISTRADOR"))
                .andExpect(jsonPath("$.active").value(true));
        // A no-op on yourself is harmless.
        patchRole(admin, id, "ADMINISTRADOR").andExpect(status().isOk());
    }

    @Test
    void oneAdministratorCanDemoteAnotherWhileAnActiveAdministratorRemains() throws Exception {
        Cookie actor = signInAs(Rol.ADMINISTRADOR);
        String otherEmail = uniqueEmail("other-admin");
        provision(otherEmail, Rol.ADMINISTRADOR);
        Cookie other = signIn(otherEmail);

        patchRole(actor, idOf(otherEmail), "ASESOR").andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/users").cookie(other)).andExpect(status().isUnauthorized()); // sessions revoked
        mockMvc.perform(get("/api/admin/users").cookie(actor)).andExpect(status().isOk());
    }

    // ---------- customer profile validation ----------

    @Test
    void profileUpdateValidatesNamesAndPhoneServerSide() throws Exception {
        Cookie customer = signInAs(Rol.CLIENTE);

        mockMvc.perform(put("/api/customers/me").cookie(customer).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("phone", "call me maybe"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("phone"));
        mockMvc.perform(put("/api/customers/me").cookie(customer).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("firstName", "a".repeat(81)))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("firstName"));
        mockMvc.perform(put("/api/customers/me").cookie(customer).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("lastName", "b".repeat(81)))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("lastName"));
        // Passes the lenient DTO pattern but is invalid once trimmed: caught by the service re-check.
        mockMvc.perform(put("/api/customers/me").cookie(customer).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("phone", "  12  "))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("phone"));
        mockMvc.perform(put("/api/customers/me").cookie(customer).contentType(MediaType.APPLICATION_JSON).content("not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
    }

    @Test
    void profileUpdateIsAFullReplacementAndBlankClearsAField() throws Exception {
        Cookie customer = signInAs(Rol.CLIENTE);
        mockMvc.perform(put("/api/customers/me").cookie(customer).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("firstName", "Ana", "lastName", "Quispe", "phone", "999 123 456"))))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/customers/me").cookie(customer).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("firstName", "Luz", "phone", "   "))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value("Luz"))
                .andExpect(jsonPath("$.lastName").doesNotExist())
                .andExpect(jsonPath("$.phone").doesNotExist());
    }
}
