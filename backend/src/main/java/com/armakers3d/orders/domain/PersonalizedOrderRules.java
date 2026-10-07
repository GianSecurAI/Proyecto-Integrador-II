package com.armakers3d.orders.domain;

import com.armakers3d.shared.error.ApiError;
import com.armakers3d.shared.error.ValidationFailedException;
import com.armakers3d.shared.util.EmailAddress;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.regex.Pattern;

/**
 * The single place that validates the registration of a personalized order (contract review E27, D-14).
 * The amount is the AGREED amount entered by staff after the external quotation; nothing is calculated.
 * No payment data is accepted or stored: only the attestation {@code paymentConfirmed == true}, and the
 * free-text description is rejected when it looks like a card/account number (13-19 digits).
 * Failures are collected and thrown once as 400 VALIDATION_FAILED.
 */
public final class PersonalizedOrderRules {

    public static final int EMAIL_MAX = 255;
    public static final int DESCRIPTION_MAX = 1000;
    public static final BigDecimal AMOUNT_MAX = new BigDecimal("999999.99");

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    /** 13-19 digits, optionally separated by single spaces or hyphens: the shape of a card (PAN) or long account number. */
    private static final Pattern DIGIT_HEAVY = Pattern.compile("(?:\\d[ -]?){12,18}\\d");

    /** A registration that passed validation. */
    public record Validated(String customerEmail, String description, BigDecimal agreedAmount) {

        /** Content identity for idempotency (length-prefixed fields, SHA-256). */
        public String fingerprint() {
            String canonical = "PERSONALIZADO|" + customerEmail.length() + ":" + customerEmail
                    + "|" + description.length() + ":" + description + "|" + agreedAmount.toPlainString();
            try {
                return HexFormat.of().formatHex(
                        MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8)));
            } catch (NoSuchAlgorithmException e) {
                throw new IllegalStateException("SHA-256 is always available", e);
            }
        }
    }

    private PersonalizedOrderRules() {}

    public static Validated validate(
            String customerEmail, String description, BigDecimal agreedAmount, Boolean paymentConfirmed) {
        List<ApiError.FieldError> errors = new ArrayList<>();
        String email = email(customerEmail, errors);
        String desc = description(description, errors);
        BigDecimal amount = amount(agreedAmount, errors);
        if (!Boolean.TRUE.equals(paymentConfirmed)) {
            errors.add(error("paymentConfirmed", "must be true: the external payment must be confirmed before registering"));
        }
        if (!errors.isEmpty()) {
            throw new ValidationFailedException(errors);
        }
        return new Validated(email, desc, amount);
    }

    private static String email(String raw, List<ApiError.FieldError> errors) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) {
            errors.add(error("customerEmail", "must not be blank"));
            return null;
        }
        if (value.length() > EMAIL_MAX) {
            errors.add(error("customerEmail", "must be at most " + EMAIL_MAX + " characters"));
            return null;
        }
        if (!EMAIL.matcher(value).matches() || value.codePoints().anyMatch(Character::isISOControl)) {
            errors.add(error("customerEmail", "must be a valid email address"));
            return null;
        }
        return EmailAddress.normalize(value);
    }

    private static String description(String raw, List<ApiError.FieldError> errors) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) {
            errors.add(error("description", "must not be blank"));
            return null;
        }
        if (value.length() > DESCRIPTION_MAX) {
            errors.add(error("description", "must be at most " + DESCRIPTION_MAX + " characters"));
            return null;
        }
        if (value.codePoints().anyMatch(cp -> Character.isISOControl(cp) && cp != '\n' && cp != '\r')) {
            errors.add(error("description", "must not contain control characters"));
            return null;
        }
        if (DIGIT_HEAVY.matcher(value).find()) {
            errors.add(error("description", "must not contain card or account numbers"));
            return null;
        }
        return value;
    }

    private static BigDecimal amount(BigDecimal raw, List<ApiError.FieldError> errors) {
        if (raw == null) {
            errors.add(error("agreedAmount", "must not be null"));
            return null;
        }
        if (raw.signum() <= 0) {
            errors.add(error("agreedAmount", "must be greater than 0"));
            return null;
        }
        if (raw.compareTo(AMOUNT_MAX) > 0) {
            errors.add(error("agreedAmount", "must be at most " + AMOUNT_MAX.toPlainString()));
            return null;
        }
        if (raw.stripTrailingZeros().scale() > 2) {
            errors.add(error("agreedAmount", "must have at most 2 decimal places"));
            return null;
        }
        return raw.setScale(2, RoundingMode.UNNECESSARY);
    }

    private static ApiError.FieldError error(String field, String message) {
        return new ApiError.FieldError(field, message);
    }
}
