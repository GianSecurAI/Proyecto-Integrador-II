package com.armakers3d.shared.notification;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * SMTP-backed {@link EmailSender}. Host/port/credentials are supplied entirely through
 * {@code spring.mail.*} environment configuration (see application.yml) — never hardcoded
 * (Constitution Principle XIV/XVIII).
 *
 * <p>Disabled under the {@code test} profile so automated tests never attempt a real network
 * call; {@code CapturingEmailSender} (test-only) takes its place there.
 */
@Component
@Profile("!test & !nodb")
public class SmtpEmailSender implements EmailSender {

    private final JavaMailSender mailSender;
    private final String fromAddress;

    public SmtpEmailSender(JavaMailSender mailSender, @Value("${mail.from}") String fromAddress) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
    }

    @Override
    public void send(String toEmail, String subject, String body) {
        // Header injection guard: recipient and subject are header values and must be a single line.
        if (containsLineBreak(toEmail) || containsLineBreak(subject)) {
            throw new IllegalArgumentException("Header values must not contain line breaks");
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(toEmail);
        message.setSubject(subject);
        message.setText(body);
        try {
            mailSender.send(message);
        } catch (RuntimeException ex) {
            // Provider messages may echo the recipient or the body (which can carry a one-time code), so
            // only the cause travels (as the wrapped cause, never logged with its message by callers).
            throw new EmailDeliveryException(ex);
        }
    }

    private static boolean containsLineBreak(String value) {
        return value == null || value.indexOf('\r') >= 0 || value.indexOf('\n') >= 0;
    }
}
