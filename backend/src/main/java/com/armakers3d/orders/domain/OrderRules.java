package com.armakers3d.orders.domain;

import com.armakers3d.shared.error.ApiError;
import com.armakers3d.shared.error.ValidationFailedException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The single place that defines checkout limits and validates a submission (contract review E18,
 * ADR-cart-state). The DTO annotations are a first, structural line; this class re-validates
 * everything so the rules hold whatever the client or the DTO does (Prohibited Practice #6).
 * All failures are collected and thrown once as 400 VALIDATION_FAILED with one field error each.
 */
public final class OrderRules {

    public static final int ITEMS_MAX = 50;
    public static final int QUANTITY_MIN = 1;
    public static final int QUANTITY_MAX = 99;
    public static final int ADDRESS_MAX = 200;
    public static final int DISTRICT_MAX = 80;
    public static final int NOTES_MAX = 300;
    public static final int FULL_NAME_MAX = 160;
    public static final int PHONE_MAX = 20;
    /** Same loose pattern the checkout form and the customer profile already use. */
    public static final String PHONE_REGEX = "^[0-9+\\-\\s()]{6,20}$";
    /** How long an Idempotency-Key is remembered per customer. */
    public static final Duration IDEMPOTENCY_TTL = Duration.ofHours(24);

    private static final Pattern PHONE = Pattern.compile(PHONE_REGEX);

    private OrderRules() {}

    public static ValidatedOrder validate(List<RequestedItem> items, DeliveryInfo delivery, ContactInfo contact) {
        List<ApiError.FieldError> errors = new ArrayList<>();
        validateItems(items, errors);
        DeliveryInfo cleanDelivery = cleanDelivery(delivery, errors);
        ContactInfo cleanContact = cleanContact(contact, errors);
        if (!errors.isEmpty()) {
            throw new ValidationFailedException(errors);
        }
        return new ValidatedOrder(items, cleanDelivery, cleanContact);
    }

    private static void validateItems(List<RequestedItem> items, List<ApiError.FieldError> errors) {
        if (items == null || items.isEmpty()) {
            errors.add(error("items", "must contain at least one item"));
            return;
        }
        if (items.size() > ITEMS_MAX) {
            errors.add(error("items", "must contain at most " + ITEMS_MAX + " items"));
            return;
        }
        Set<Long> seen = new HashSet<>();
        for (int i = 0; i < items.size(); i++) {
            RequestedItem item = items.get(i);
            String at = "items[" + i + "]";
            if (item == null) {
                errors.add(error(at, "must not be null"));
                continue;
            }
            if (item.productId() == null || item.productId() <= 0) {
                errors.add(error(at + ".productId", "must be a positive integer"));
            } else if (!seen.add(item.productId())) {
                // Decision: duplicate lines are rejected, not merged (contract review E18).
                errors.add(error(at + ".productId", "duplicate product; send one line per product"));
            }
            if (item.quantity() == null || item.quantity() < QUANTITY_MIN || item.quantity() > QUANTITY_MAX) {
                errors.add(error(at + ".quantity", "must be an integer between " + QUANTITY_MIN + " and " + QUANTITY_MAX));
            }
        }
    }

    private static DeliveryInfo cleanDelivery(DeliveryInfo d, List<ApiError.FieldError> errors) {
        if (d == null) {
            errors.add(error("delivery", "must not be null"));
            return null;
        }
        String address = text("delivery.address", d.address(), ADDRESS_MAX, false, true, errors);
        String district = text("delivery.district", d.district(), DISTRICT_MAX, false, true, errors);
        String notes = text("delivery.notes", d.notes(), NOTES_MAX, true, false, errors);
        return new DeliveryInfo(address, district, notes);
    }

    private static ContactInfo cleanContact(ContactInfo c, List<ApiError.FieldError> errors) {
        if (c == null) {
            errors.add(error("contact", "must not be null"));
            return null;
        }
        String name = text("contact.fullName", c.fullName(), FULL_NAME_MAX, false, true, errors);
        String phone = text("contact.phone", c.phone(), PHONE_MAX, false, true, errors);
        if (phone != null && !PHONE.matcher(phone).matches()) {
            errors.add(error("contact.phone", "must be 6-20 characters: digits, +, -, spaces or parentheses"));
        }
        return new ContactInfo(name, phone);
    }

    /**
     * Trims; blank is an error unless optional (then null). Control characters are rejected (line
     * breaks only where multi-line text is allowed) so a value can never forge log lines or break
     * a downstream consumer. HTML is not escaped here: responses are JSON and the SPA escapes on render.
     */
    private static String text(
            String field, String raw, int max, boolean optional, boolean singleLine, List<ApiError.FieldError> errors) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) {
            if (!optional) {
                errors.add(error(field, "must not be blank"));
            }
            return null;
        }
        if (value.length() > max) {
            errors.add(error(field, "must be at most " + max + " characters"));
            return null;
        }
        if (hasForbiddenControl(value, singleLine)) {
            errors.add(error(field, "must not contain control characters"));
            return null;
        }
        return value;
    }

    private static boolean hasForbiddenControl(String value, boolean singleLine) {
        return value.codePoints().anyMatch(cp -> Character.isISOControl(cp)
                && (singleLine || (cp != '\n' && cp != '\r')));
    }

    private static ApiError.FieldError error(String field, String message) {
        return new ApiError.FieldError(field, message);
    }
}
