package com.armakers3d.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.armakers3d.testsupport.CapturingEmailSender;
import com.armakers3d.testsupport.MutableClock;
import jakarta.servlet.http.Cookie;
import java.time.Clock;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * End-to-end OTP flow with NO database (profile {@code nodb}): in-memory adapters, dev-seeded
 * staff from {@code application-nodb.yml}, and a capturing email sender standing in for the
 * production no-op sender (which, by design, never exposes the code). Covers the same security
 * outcomes as the H2 suite: valid/invalid/expired/reused codes, attempt limit, resend, session,
 * {@code /me}, logout, 401, and role authorization including ASESOR and ADMINISTRADOR.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("nodb")
@TestPropertySource(properties = {"otp.ip-max-request-calls=1000000", "otp.ip-max-verify-calls=1000000"})
@Import(NoDbOtpFlowTest.NoDbTestConfig.class)
class NoDbOtpFlowTest {

    static final String ADVISOR = "advisor@example.test";
    static final String ADMIN = "admin@example.test";

    @TestConfiguration
    static class NoDbTestConfig {
        @Bean
        @Primary
        CapturingEmailSender capturingEmailSender() {
            return new CapturingEmailSender();
        }

        @Bean
        @Primary
        Clock nodbTestClock() {
            return MutableClock.startingNow();
        }
    }

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired CapturingEmailSender emailSender;
    @Autowired Clock clock;

    private ListAppender<ILoggingEvent> logs;
    private Logger rootLogger;

    @BeforeEach
    void setUp() {
        ((MutableClock) clock).reset();
        emailSender.clear();
        rootLogger = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
        logs = new ListAppender<>();
        logs.start();
        rootLogger.addAppender(logs);
    }

    @AfterEach
    void tearDown() {
        rootLogger.detachAppender(logs);
    }

    private String email(String prefix) {
        return prefix + "-" + UUID.randomUUID() + "@example.test";
    }

    private ResultActions request(String email) throws Exception {
        return mockMvc.perform(post("/api/auth/otp/request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", email))));
    }

    private ResultActions verify(String email, String code) throws Exception {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("email", email);
        body.put("code", code);
        return mockMvc.perform(post("/api/auth/otp/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }

    private Cookie signIn(String email) throws Exception {
        request(email).andExpect(status().isAccepted());
        var result = verify(email, emailSender.lastCodeFor(email)).andExpect(status().isOk()).andReturn();
        Cookie cookie = result.getResponse().getCookie("ARM3D_SESSION");
        assertThat(cookie).isNotNull();
        return cookie;
    }

    private static String wrong(String code) {
        return "000000".equals(code) ? "999999" : "000000";
    }

    @Test
    void validCodeRegistersACustomerAndEstablishesAnHttpOnlySession() throws Exception {
        String email = email("customer");
        request(email).andExpect(status().isAccepted());

        var result = verify(email, emailSender.lastCodeFor(email))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountStatus").value("created"))
                .andExpect(jsonPath("$.role").value("CLIENTE"))
                .andReturn();

        String setCookie = result.getResponse().getHeader("Set-Cookie");
        assertThat(setCookie).contains("ARM3D_SESSION=").contains("HttpOnly").contains("SameSite=Strict");
        Cookie cookie = result.getResponse().getCookie("ARM3D_SESSION");
        mockMvc.perform(get("/api/auth/me").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.role").value("CLIENTE"));
    }

    @Test
    void invalidCodeIsRejectedAndNoSessionIsIssued() throws Exception {
        String email = email("invalid");
        request(email);

        var result = verify(email, wrong(emailSender.lastCodeFor(email)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("OTP_INVALID"))
                .andReturn();
        assertThat(result.getResponse().getCookie("ARM3D_SESSION")).isNull();
    }

    @Test
    void verifyForAnEmailThatNeverRequestedACodeLooksLikeAnyWrongCode() throws Exception {
        verify(email("never-requested"), "123456")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("OTP_INVALID"));
    }

    @Test
    void expiredCodeIsRejected() throws Exception {
        String email = email("expired");
        request(email);
        String code = emailSender.lastCodeFor(email);

        ((MutableClock) clock).advance(Duration.ofMinutes(11));

        verify(email, code).andExpect(status().isGone()).andExpect(jsonPath("$.code").value("OTP_EXPIRED"));
    }

    @Test
    void usedCodeCannotBeReplayed() throws Exception {
        String email = email("reused");
        request(email);
        String code = emailSender.lastCodeFor(email);
        verify(email, code).andExpect(status().isOk());

        verify(email, code).andExpect(status().isGone()).andExpect(jsonPath("$.code").value("OTP_ALREADY_USED"));
    }

    @Test
    void sixthAttemptIsLockedOutEvenWithTheCorrectCode() throws Exception {
        String email = email("attempts");
        request(email);
        String code = emailSender.lastCodeFor(email);

        for (int i = 0; i < 5; i++) {
            verify(email, wrong(code)).andExpect(status().isUnauthorized());
        }

        verify(email, code).andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("OTP_ATTEMPTS_EXCEEDED"));
    }

    @Test
    void resendSupersedesTheOldCodeAndIsLimitedPerWindow() throws Exception {
        String email = email("resend");
        request(email);
        String first = emailSender.lastCodeFor(email);
        request(email);
        String second = emailSender.lastCodeFor(email);
        assertThat(emailSender.getSent()).hasSize(2);

        if (!first.equals(second)) {
            verify(email, first).andExpect(status().isUnauthorized());
        }
        request(email).andExpect(status().isAccepted()); // third request in the window
        request(email).andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("OTP_REQUEST_THROTTLED"));

        ((MutableClock) clock).advance(Duration.ofMinutes(16));
        request(email).andExpect(status().isAccepted());
    }

    @Test
    void logoutInvalidatesTheSessionServerSide() throws Exception {
        Cookie cookie = signIn(email("logout"));
        mockMvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isOk());

        var result = mockMvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isNoContent()).andReturn();

        assertThat(result.getResponse().getHeader("Set-Cookie")).contains("Max-Age=0");
        mockMvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isNoContent());
    }

    @Test
    void protectedEndpointsReturn401WithoutASession() throws Exception {
        mockMvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mockMvc.perform(get("/api/customers/me")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/admin/users")).andExpect(status().isUnauthorized());
    }

    @Test
    void seededAdvisorSignsInWithOtpAndHasTheAsesorRole() throws Exception {
        request(ADVISOR).andExpect(status().isAccepted());
        var result = verify(ADVISOR, emailSender.lastCodeFor(ADVISOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountStatus").value("existing"))
                .andExpect(jsonPath("$.role").value("ASESOR"))
                .andReturn();
        Cookie cookie = result.getResponse().getCookie("ARM3D_SESSION");

        mockMvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(jsonPath("$.role").value("ASESOR"));
    }

    @Test
    void roleAuthorizationDistinguishesCustomerAdvisorAndAdministrator() throws Exception {
        Cookie customer = signIn(email("rbac-customer"));
        Cookie advisor = signIn(ADVISOR);
        Cookie admin = signIn(ADMIN);

        // /api/admin/users is administrator-only.
        mockMvc.perform(get("/api/admin/users").cookie(customer)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/users").cookie(advisor)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/users").cookie(admin)).andExpect(status().isOk());

        // /api/customers/me is customer-only: staff are denied, not silently served.
        mockMvc.perform(get("/api/customers/me").cookie(customer)).andExpect(status().isOk());
        mockMvc.perform(get("/api/customers/me").cookie(advisor)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/customers/me").cookie(admin)).andExpect(status().isForbidden());

        // /api/auth/me is open to every authenticated role.
        mockMvc.perform(get("/api/auth/me").cookie(admin)).andExpect(jsonPath("$.role").value("ADMINISTRADOR"));
    }

    @Test
    void otpRequestResponsesDoNotRevealWhetherTheEmailBelongsToStaff() throws Exception {
        String staffBody = request(ADVISOR).andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();
        String unknownBody = request(email("unknown")).andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();

        assertThat(staffBody).isEqualTo(unknownBody);
    }

    @Test
    void theOtpNeverAppearsInAnyLogLineAcrossTheWholeFlow() throws Exception {
        // Fixed, digit-free address: a random UUID could by chance contain the 6-digit code.
        String email = "log-check-flow@example.test";
        request(email);
        String code = emailSender.lastCodeFor(email);
        verify(email, wrong(code));
        verify(email, code).andExpect(status().isOk());

        assertThat(logs.list).isNotEmpty();
        assertThat(logs.list.stream().map(ILoggingEvent::getFormattedMessage)).noneMatch(m -> m.contains(code));
    }
}
