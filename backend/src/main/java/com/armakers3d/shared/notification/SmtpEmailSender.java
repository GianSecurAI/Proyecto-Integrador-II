package com.armakers3d.shared.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
@Profile("!test")
public class SmtpEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(SmtpEmailSender.class);

    private final JavaMailSender mailSender;
    private final String fromAddress;

    public SmtpEmailSender(JavaMailSender mailSender, @Value("${mail.from}") String fromAddress) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
    }

    @Override
    public void send(String toEmail, String subject, String body) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(toEmail);
        message.setSubject(subject);
        message.setText(body);
        try {
            mailSender.send(message);
        } catch (RuntimeException ex) {
            // Delivery failure must never surface to the caller in a way that reveals delivery
            // diagnostics (spec.md Edge Cases: "the failure response must not reveal delivery
            // diagnostics that could confirm or deny account existence"). The request endpoint
            // always returns its generic acknowledgment regardless of this outcome.
            log.warn("OTP email dispatch failed for a request; caller response remains generic.", ex);
        }
    }
}
