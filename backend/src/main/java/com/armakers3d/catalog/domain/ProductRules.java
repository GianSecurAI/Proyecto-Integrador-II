package com.armakers3d.catalog.domain;

import com.armakers3d.shared.error.ValidationFailedException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * The single place that defines product field limits (contract review 4.4 {@code ProductWrite}).
 * The DTO annotations reference these constants and the service calls {@link #normalize} again, so
 * the rule is enforced server-side whatever the client or DTO does (Prohibited Practice #6).
 */
public final class ProductRules {

    public static final int TITLE_MAX = 120;
    public static final int SUBCATEGORY_MAX = 80;
    public static final int DESCRIPTION_MAX = 2000;
    public static final int CHARACTERISTICS_MAX_ITEMS = 20;
    public static final int CHARACTERISTIC_MAX = 200;
    public static final String PRICE_MAX_TEXT = "99999.99";
    public static final BigDecimal PRICE_MAX = new BigDecimal(PRICE_MAX_TEXT);
    public static final int SEARCH_MAX = 100;
    public static final int IDS_MAX = 50;

    private ProductRules() {}

    public static ProductData normalize(
            String title,
            ProductCategory category,
            String subcategory,
            String description,
            BigDecimal price,
            List<String> characteristics) {
        String cleanTitle = required("title", title, TITLE_MAX);
        if (category == null) {
            throw new ValidationFailedException("category", "must not be null");
        }
        String cleanSubcategory = required("subcategory", subcategory, SUBCATEGORY_MAX);
        String cleanDescription = required("description", description, DESCRIPTION_MAX);
        return new ProductData(
                cleanTitle, category, cleanSubcategory, cleanDescription, normalizePrice(price),
                normalizeCharacteristics(characteristics));
    }

    /** Positive, at most 99999.99, at most 2 decimals; returned with scale exactly 2. */
    public static BigDecimal normalizePrice(BigDecimal price) {
        if (price == null) {
            throw new ValidationFailedException("price", "must not be null");
        }
        if (price.signum() <= 0) {
            throw new ValidationFailedException("price", "must be greater than 0");
        }
        if (price.stripTrailingZeros().scale() > 2) {
            throw new ValidationFailedException("price", "must have at most 2 decimal places");
        }
        BigDecimal scaled = price.setScale(2, RoundingMode.UNNECESSARY);
        if (scaled.compareTo(PRICE_MAX) > 0) {
            throw new ValidationFailedException("price", "must be at most " + PRICE_MAX_TEXT);
        }
        return scaled;
    }

    private static List<String> normalizeCharacteristics(List<String> raw) {
        if (raw == null) {
            throw new ValidationFailedException("characteristics", "must not be null");
        }
        if (raw.size() > CHARACTERISTICS_MAX_ITEMS) {
            throw new ValidationFailedException(
                    "characteristics", "must have at most " + CHARACTERISTICS_MAX_ITEMS + " items");
        }
        List<String> clean = new ArrayList<>(raw.size());
        for (String item : raw) {
            clean.add(required("characteristics", item, CHARACTERISTIC_MAX));
        }
        return clean;
    }

    private static String required(String field, String value, int max) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty()) {
            throw new ValidationFailedException(field, "must not be blank");
        }
        if (trimmed.length() > max) {
            throw new ValidationFailedException(field, "must be at most " + max + " characters");
        }
        return trimmed;
    }
}
