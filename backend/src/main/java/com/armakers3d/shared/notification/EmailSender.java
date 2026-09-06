package com.armakers3d.shared.notification;

/**
 * Minimal internal port for dispatching a transactional email, conceptually aligned with the
 * future {@code notifications} domain (research.md #5) without building it out in full for this
 * feature. Keeps the {@code auth} domain from talking to a specific mail provider/API directly,
 * so provider/credentials stay swappable purely through environment configuration (Constitution
 * Principle XIV/XVIII) and no business domain duplicates email-sending logic (Principle IV).
 */
public interface EmailSender {

    void send(String toEmail, String subject, String body);
}
