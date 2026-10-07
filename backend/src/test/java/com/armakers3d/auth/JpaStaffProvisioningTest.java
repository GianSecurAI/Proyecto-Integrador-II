package com.armakers3d.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.auth.service.FirstAdministratorBootstrap;
import com.armakers3d.auth.service.FirstAdministratorBootstrap.Outcome;
import jakarta.servlet.http.Cookie;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Database-backed (H2 in PostgreSQL mode, Flyway V1-V5) proof of DB-02 (V4 lets an advisor exist), DB-03's V5 columns
 * and DB-04 (first administrator bootstrap, then sign-in by the normal email OTP).
 */
class JpaStaffProvisioningTest extends AbstractOtpIntegrationTest {

    @Autowired JdbcTemplate jdbc;

    private Cookie signInExisting(String email) throws Exception {
        requestOtp(email);
        var result = verifyOtp(email, emailSender.lastCodeFor(email)).andExpect(status().isOk()).andReturn();
        return result.getResponse().getCookie("ARM3D_SESSION");
    }

    @Test
    void anAdministratorProvisionsAnAdvisorThroughTheApiAndTheAdvisorSignsIn() throws Exception {
        String adminEmail = uniqueEmail("admin").toLowerCase();
        clienteRepository.save(Cliente.provisioned(adminEmail, Rol.ADMINISTRADOR, clock.instant()));
        Cookie admin = signInExisting(adminEmail);
        String advisorEmail = uniqueEmail("advisor").toLowerCase();

        mockMvc.perform(post("/api/admin/users").cookie(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + advisorEmail + "\",\"role\":\"ASESOR\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("ASESOR"));

        assertThat(clienteRepository.findByEmail(advisorEmail).orElseThrow().getRol()).isEqualTo(Rol.ASESOR);
        Cookie advisor = signInExisting(advisorEmail);
        getWithCookie("/api/auth/me", advisor).andExpect(status().isOk()).andExpect(jsonPath("$.role").value("ASESOR"));
        getWithCookie("/api/admin/orders", advisor).andExpect(status().isOk());
        getWithCookie("/api/admin/users", advisor).andExpect(status().isForbidden());
    }

    @Test
    void theDatabaseStillRejectsAnUnknownRole() {
        long id = clienteRepository.save(new Cliente(uniqueEmail("plain").toLowerCase(), clock.instant())).getId();

        org.assertj.core.api.Assertions.assertThatThrownBy(
                        () -> jdbc.update("update cliente set rol = 'SUPERUSER' where id = ?", id))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test
    void v5AddedTheNullableProfileColumns() {
        List<String> columns = jdbc.queryForList(
                "select lower(column_name) from information_schema.columns where lower(table_name) = 'cliente'",
                String.class);

        assertThat(columns).contains("first_name", "last_name", "phone");
        // existing accounts are unaffected: the columns are nullable
        clienteRepository.save(new Cliente(uniqueEmail("nullable").toLowerCase(), clock.instant()));
    }

    @Test
    void bootstrapCreatesTheFirstAdministratorWhoThenSignsInByOtpAndUsesAdminUsers() throws Exception {
        String email = uniqueEmail("first-admin").toLowerCase();
        FirstAdministratorBootstrap bootstrap = new FirstAdministratorBootstrap(clienteRepository, clock, email);

        assertThat(bootstrap.bootstrap()).isEqualTo(Outcome.CREATED);
        assertThat(bootstrap.bootstrap()).isEqualTo(Outcome.ALREADY_PRESENT);

        Cookie cookie = signInExisting(email);
        getWithCookie("/api/auth/me", cookie).andExpect(jsonPath("$.role").value("ADMINISTRADOR"));
        getWithCookie("/api/admin/users", cookie).andExpect(status().isOk());
    }

    @Test
    void bootstrapPromotesAnExistingCustomerOnTheDatabase() throws Exception {
        String email = uniqueEmail("promoted").toLowerCase();
        registerAndGetSessionCookie(email); // self-registered CLIENTE

        assertThat(new FirstAdministratorBootstrap(clienteRepository, clock, email).bootstrap()).isEqualTo(Outcome.PROMOTED);

        assertThat(clienteRepository.findByEmail(email).orElseThrow().getRol()).isEqualTo(Rol.ADMINISTRADOR);
    }
}
