package com.armakers3d.catalog.domain;

import java.math.BigDecimal;
import java.util.List;

/** Validated, normalized editable fields of a product. Built only through {@link ProductRules#normalize}. */
public record ProductData(
        String title,
        ProductCategory category,
        String subcategory,
        String description,
        BigDecimal price,
        List<String> characteristics) {}
