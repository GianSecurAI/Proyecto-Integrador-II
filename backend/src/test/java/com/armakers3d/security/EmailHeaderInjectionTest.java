package com.armakers3d.security;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.shared.notification.SmtpEmailSender;
import com.armakers3d.users.AbstractNoDbRbacTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mail.javamail.JavaMailSender;

/** CRLF / header injection through email addresses and subjects (security review, injection checklist). */
class EmailHeaderInjectionTest extends AbstractNoDbRbacTest {

    @Test
    void theSmtpSenderRefusesLineBreaksInRecipientAndSubjectBeforeTouchingTheMailServer() {
        JavaMailSender mail = mock(JavaMailSender.class);
        SmtpEmailSender sender = new SmtpEmailSender(mail, "no-reply@example.test");
        assertThatThrownBy(() -> sender.send("a@example.test\r\nBcc: victim@example.test", "s", "b"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> sender.send("a@example.test", "subject\nBcc: victim@example.test", "b"))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(mail);
    }

    @Test
    void anOtpRequestWhoseEmailCarriesALineBreakIsRejectedAs400AndSendsNothing() throws Exception {
        for (String evil : new String[] {"a@example.test\r\nBcc: x@evil.test", "a@example.test\nBcc: x@evil.test"}) {
            mockMvc.perform(post("/api/auth/otp/request")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + evil + "\"}"))
                    .andExpect(status().isBadRequest());
        }
        org.assertj.core.api.Assertions.assertThat(emailSender.getSent()).isEmpty();
    }
}
