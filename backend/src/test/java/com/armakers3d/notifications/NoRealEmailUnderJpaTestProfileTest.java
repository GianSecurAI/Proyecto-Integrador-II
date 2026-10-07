package com.armakers3d.notifications;

import static org.assertj.core.api.Assertions.assertThat;

import com.armakers3d.auth.AbstractOtpIntegrationTest;
import com.armakers3d.shared.notification.EmailSender;
import com.armakers3d.shared.notification.SmtpEmailSender;
import com.armakers3d.testsupport.CapturingEmailSender;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;

/** The default JPA test profile must never be able to send real email. */
class NoRealEmailUnderJpaTestProfileTest extends AbstractOtpIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testProfileUsesTheCapturingSenderAndNoSmtpAdapter() {
        assertThat(context.getBeansOfType(SmtpEmailSender.class)).isEmpty();
        assertThat(context.getBeansOfType(EmailSender.class).values())
                .allSatisfy(s -> assertThat(s).isInstanceOf(CapturingEmailSender.class));
    }
}
