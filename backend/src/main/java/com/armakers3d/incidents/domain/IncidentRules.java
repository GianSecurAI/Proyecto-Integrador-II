package com.armakers3d.incidents.domain;

import com.armakers3d.shared.error.ApiError;
import com.armakers3d.shared.error.ValidationFailedException;
import java.util.ArrayList;
import java.util.List;

/**
 * The single place that defines incident limits and validates text (contract review E23, E31, finding 56).
 * DTO annotations are a first structural line; this re-validates after trimming so the rules hold whatever
 * the client does (Prohibited Practice #6). Line breaks are allowed in free text; other control characters
 * are rejected so a value can never forge log lines.
 */
public final class IncidentRules {

    public static final int DESCRIPTION_MIN = 20;
    public static final int DESCRIPTION_MAX = 1000;
    public static final int RESOLUTION_MIN = 1;
    public static final int RESOLUTION_MAX = 1000;
    public static final int ORDER_ID_MAX = 30;
    /** Sane cap (the review sets none): non-terminal incidents one order may have at the same time. */
    public static final int MAX_OPEN_PER_ORDER = 5;

    private IncidentRules() {}

    /** Validated, trimmed creation input. */
    public record ValidatedNewIncident(String orderId, String description) {}

    /** All failures are thrown together as one 400 VALIDATION_FAILED. */
    public static ValidatedNewIncident validateNew(String orderId, String description) {
        List<ApiError.FieldError> errors = new ArrayList<>();
        String cleanOrderId = text("orderId", orderId, 1, ORDER_ID_MAX, true, errors);
        String cleanDescription = text("description", description, DESCRIPTION_MIN, DESCRIPTION_MAX, false, errors);
        if (!errors.isEmpty()) {
            throw new ValidationFailedException(errors);
        }
        return new ValidatedNewIncident(cleanOrderId, cleanDescription);
    }

    public static String validateResolution(String resolutionText) {
        List<ApiError.FieldError> errors = new ArrayList<>();
        String clean = text("resolutionText", resolutionText, RESOLUTION_MIN, RESOLUTION_MAX, false, errors);
        if (!errors.isEmpty()) {
            throw new ValidationFailedException(errors);
        }
        return clean;
    }

    private static String text(
            String field, String raw, int min, int max, boolean singleLine, List<ApiError.FieldError> errors) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) {
            errors.add(new ApiError.FieldError(field, "must not be blank"));
            return null;
        }
        if (value.length() < min || value.length() > max) {
            errors.add(new ApiError.FieldError(field, "must be between " + min + " and " + max + " characters"));
            return null;
        }
        boolean forbidden = value.codePoints().anyMatch(
                cp -> Character.isISOControl(cp) && (singleLine || (cp != '\n' && cp != '\r')));
        if (forbidden) {
            errors.add(new ApiError.FieldError(field, "must not contain control characters"));
            return null;
        }
        return value;
    }
}
