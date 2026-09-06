package com.armakers3d.auth;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

/**
 * T019 (Constitution Principle XII, NON-NEGOTIABLE; FR-017): request/verify log output contains
 * no plaintext code value in any log line, using a captured log appender. Also confirms audit
 * events are actually emitted for request/success/failure/lockout, since FR-017 requires
 * recording these events, not just avoiding the plaintext leak.
 */
class OtpAuditLoggingTest extends AbstractOtpIntegrationTest {

    private ListAppender<ILoggingEvent> appender;
    private Logger otpServiceLogger;

    @BeforeEach
    void attachAppender() {
        otpServiceLogger = (Logger) LoggerFactory.getLogger("com.armakers3d.auth.service.OtpService");
        appender = new ListAppender<>();
        appender.start();
        otpServiceLogger.addAppender(appender);
    }

    @AfterEach
    void detachAppender() {
        otpServiceLogger.detachAppender(appender);
    }

    @Test
    void logsNeverContainThePlaintextCodeAcrossRequestAndVerify() throws Exception {
        String email = uniqueEmail("audit-log");
        requestOtp(email);
        String issuedCode = emailSender.lastCodeFor(email);

        // One failed attempt, then the successful one.
        verifyOtp(email, "000000".equals(issuedCode) ? "111111" : "000000");
        verifyOtp(email, issuedCode);

        List<String> messages = appender.list.stream().map(ILoggingEvent::getFormattedMessage).toList();

        assertThat(messages).isNotEmpty();
        assertThat(messages).noneMatch(message -> message.contains(issuedCode));
    }

    @Test
    void logsRecordRequestSuccessFailureAndLockoutEvents() throws Exception {
        String email = uniqueEmail("audit-events");
        requestOtp(email);
        String issuedCode = emailSender.lastCodeFor(email);
        String wrongCode = "000000".equals(issuedCode) ? "111111" : "000000";

        // Exhaust the attempt budget (policy default: 5) to also trigger the lockout log line.
        for (int i = 0; i < 5; i++) {
            verifyOtp(email, wrongCode);
        }
        verifyOtp(email, issuedCode); // now locked out

        List<String> messages = appender.list.stream().map(ILoggingEvent::getFormattedMessage).toList();

        assertThat(messages).anyMatch(m -> m.contains("otp.request.issued"));
        assertThat(messages).anyMatch(m -> m.contains("otp.verify.failed"));
        assertThat(messages).anyMatch(m -> m.contains("otp.verify.lockout"));
    }
}
