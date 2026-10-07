package com.armakers3d.shared.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * {@link EmailSender} for the {@code nodb} profile: sends nothing and logs only that a message
 * was dispatched (subject, no body, no recipient). The body is deliberately never logged because
 * it carries the one-time code (FR-002/FR-017); there is intentionally no "print the code" dev
 * option. Tests that need the code supply their own capturing sender.
 */
@Component
@Profile("nodb")
public class LoggingEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(LoggingEmailSender.class);

    @Override
    public void send(String toEmail, String subject, String body) {
        log.info("email.noop subject=\"{}\" (nodb profile: nothing delivered, body not logged)", subject);
    }
}
