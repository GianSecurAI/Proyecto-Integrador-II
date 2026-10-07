package com.armakers3d.catalog.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Catalog product (contract review 4.3/4.4). Immutable, persistence-neutral; no cost, stock or
 * discount fields exist on purpose (D-08, D-11). {@code id} is null until the repository assigns it.
 * Money is {@link BigDecimal} with scale 2, currency PEN implied.
 */
public record Product(
        Long id,
        String title,
        ProductCategory category,
        String subcategory,
        String description,
        BigDecimal price,
        List<String> characteristics,
        boolean available,
        Instant createdAt,
        Instant updatedAt) {

    public Product {
        characteristics = List.copyOf(characteristics);
    }

    /** New, available product; the repository assigns the id on save. */
    public static Product create(ProductData data, Instant now) {
        return new Product(null, data.title(), data.category(), data.subcategory(), data.description(),
                data.price(), data.characteristics(), true, now, now);
    }

    public Product withId(Long newId) {
        return new Product(newId, title, category, subcategory, description, price, characteristics,
                available, createdAt, updatedAt);
    }

    /** Full replacement of the editable fields; availability and creation time are untouched. */
    public Product updatedWith(ProductData data, Instant now) {
        return new Product(id, data.title(), data.category(), data.subcategory(), data.description(),
                data.price(), data.characteristics(), available, createdAt, now);
    }

    public Product withAvailability(boolean newAvailable, Instant now) {
        return new Product(id, title, category, subcategory, description, price, characteristics,
                newAvailable, createdAt, now);
    }
}
