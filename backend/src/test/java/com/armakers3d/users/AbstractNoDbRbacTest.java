package com.armakers3d.users;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.auth.repository.AuthenticatedSessionRepository;
import com.armakers3d.auth.repository.ClienteRepository;
import com.armakers3d.testsupport.CapturingEmailSender;
import com.armakers3d.testsupport.MutableClock;
import com.armakers3d.testsupport.NoDbTestConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Scaffolding for the RBAC / users tests: full application under the {@code nodb} profile (in-memory
 * adapters, Spring Security filter chain, MockMvc only, no sockets). Accounts use unique emails so
 * tests sharing the cached context never collide; each test provisions its own staff.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("nodb")
@TestPropertySource(properties = {"otp.ip-max-request-calls=1000000", "otp.ip-max-verify-calls=1000000",
        "ratelimit.mutations-per-window=1000000"})
@Import(NoDbTestConfig.class)
public abstract class AbstractNoDbRbacTest {

    @Autowired protected MockMvc mockMvc;
    @Autowired protected ObjectMapper objectMapper;
    @Autowired protected CapturingEmailSender emailSender;
    @Autowired protected Clock clock;
    @Autowired protected ClienteRepository clienteRepository;
    @Autowired protected AuthenticatedSessionRepository sessionRepository;

    @BeforeEach
    void resetClockAndMailbox() {
        ((MutableClock) clock).reset();
        emailSender.clear();
    }

    protected static String uniqueEmail(String prefix) {
        return prefix + "-" + UUID.randomUUID() + "@example.test";
    }

    /** Persists an account directly (bypassing the API) and returns it. */
    protected Cliente provision(String email, Rol rol) {
        return clienteRepository.save(Cliente.provisioned(email, rol, clock.instant()));
    }

    /** Full email-OTP login; returns the session cookie. Self-registers a CLIENTE for unknown emails. */
    protected Cookie signIn(String email) throws Exception {
        mockMvc.perform(post("/api/auth/otp/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email))))
                .andExpect(status().isAccepted());
        Map<String, String> body = new LinkedHashMap<>();
        body.put("email", email);
        body.put("code", emailSender.lastCodeFor(email));
        var result = mockMvc.perform(post("/api/auth/otp/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();
        return result.getResponse().getCookie("ARM3D_SESSION");
    }

    protected Cookie signInAs(Rol rol) throws Exception {
        String email = uniqueEmail(rol.name().toLowerCase());
        if (rol != Rol.CLIENTE) {
            provision(email, rol);
        }
        return signIn(email);
    }

    protected Long idOf(String email) {
        return clienteRepository.findByEmail(email).orElseThrow().getId();
    }

    protected String json(Object body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }
}
