package com.armakers3d.catalog.domain;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.Set;

/**
 * Persistence-neutral filter. Every field is optional (null = no filter). {@code q} is a
 * case-insensitive substring over the title; {@code ids}, when present, restricts to those ids
 * (unknown ids are simply absent from the result). {@link #matches} is the reference semantics every
 * adapter must reproduce (the repository contract test checks it).
 */
public record ProductSearchCriteria(
        String q,
        ProductCategory category,
        BigDecimal minPrice,
        BigDecimal maxPrice,
        Set<Long> ids,
        Boolean available) {

    public boolean matches(Product p) {
        if (q != null && !q.isBlank()
                && !p.title().toLowerCase(Locale.ROOT).contains(q.trim().toLowerCase(Locale.ROOT))) {
            return false;
        }
        if (category != null && p.category() != category) {
            return false;
        }
        if (minPrice != null && p.price().compareTo(minPrice) < 0) {
            return false;
        }
        if (maxPrice != null && p.price().compareTo(maxPrice) > 0) {
            return false;
        }
        if (ids != null && !ids.contains(p.id())) {
            return false;
        }
        return available == null || p.available() == available;
    }
}
