package com.armakers3d.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.armakers3d.auth.repository.AuthenticatedSessionRepository;
import com.armakers3d.auth.repository.ClienteRepository;
import com.armakers3d.auth.repository.CodigoOtpRepository;
import com.armakers3d.auth.security.SessionAuthenticationFilter;
import com.armakers3d.testsupport.CapturingEmailSender;
import com.armakers3d.testsupport.MutableClock;
import com.armakers3d.testsupport.TestClockConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.time.Clock;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Shared scaffolding for the controller-level integration tests required by tasks.md: every test
 * here exercises the real {@code OtpService}/{@code SessionService} through Spring's test context
 * (not a mock), per tasks.md's stated testing intent, against an H2 (PostgreSQL-mode) database
 * migrated by the same Flyway scripts used in production (Constitution Principle X).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
@Import(TestClockConfig.class)
public abstract class AbstractOtpIntegrationTest {

    @Autowired protected WebApplicationContext webApplicationContext;
    @Autowired protected ObjectMapper objectMapper;
    @Autowired protected CapturingEmailSender emailSender;
    @Autowired protected Clock clock;
    @Autowired protected ClienteRepository clienteRepository;
    @Autowired protected CodigoOtpRepository codigoOtpRepository;
    @Autowired protected AuthenticatedSessionRepository sessionRepository;
    @Autowired protected SessionAuthenticationFilter sessionAuthenticationFilter;

    protected MockMvc mockMvc;

    @BeforeEach
    void baseSetUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
            .addFilters(sessionAuthenticationFilter)
            .build();
        sessionRepository.deleteAll();
        codigoOtpRepository.deleteAll();
        clienteRepository.deleteAll();
        emailSender.clear();
        mutableClock().reset();
    }

    protected MutableClock mutableClock() {
        return (MutableClock) clock;
    }

    protected String uniqueEmail(String prefix) {
        return prefix + "+" + UUID.randomUUID() + "@example.com";
    }

    protected ResultActions requestOtp(String email) throws Exception {
        String body = objectMapper.writeValueAsString(new java.util.HashMap<>(java.util.Map.of("email", email)));
        return mockMvc.perform(
                post("/api/auth/otp/request").contentType(MediaType.APPLICATION_JSON).content(body));
    }

    protected ResultActions verifyOtp(String email, String code) throws Exception {
        var payload = new java.util.LinkedHashMap<String, String>();
        payload.put("email", email);
        payload.put("code", code);
        String body = objectMapper.writeValueAsString(payload);
        return mockMvc.perform(
                post("/api/auth/otp/verify").contentType(MediaType.APPLICATION_JSON).content(body));
    }

    protected ResultActions getWithCookie(String url, Cookie cookie) throws Exception {
        var builder = get(url);
        if (cookie != null) {
            builder.cookie(cookie);
        }
        return mockMvc.perform(builder);
    }

    /** Full request+verify happy-path flow, returning the resulting session cookie. */
    protected Cookie registerAndGetSessionCookie(String email) throws Exception {
        requestOtp(email);
        String code = emailSender.lastCodeFor(email);
        var result = verifyOtp(email, code).andReturn();
        Cookie cookie = result.getResponse().getCookie("ARM3D_SESSION");
        if (cookie == null) {
            throw new IllegalStateException("Verification did not produce a session cookie: "
                    + result.getResponse().getContentAsString());
        }
        return cookie;
    }
}
