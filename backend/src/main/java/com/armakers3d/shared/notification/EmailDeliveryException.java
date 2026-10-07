package com.armakers3d.shared.notification;

/**
 * Thrown by an {@link EmailSender} when the provider rejected or could not take a message. The message
 * never carries provider text (it may echo recipient or body); callers log the class only. Each caller
 * decides what a failure means: the OTP flow keeps its generic acknowledgment, order notifications are
 * best effort and audited.
 */
public class EmailDeliveryException extends RuntimeException {

    public EmailDeliveryException(Throwable cause) {
        super("Email delivery failed", cause);
    }
}
