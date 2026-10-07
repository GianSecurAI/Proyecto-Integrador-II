package com.armakers3d.catalog.dto;

import com.armakers3d.catalog.domain.ProductCategory;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Contract review 4.4 {@code AdminProduct}: detail fields plus availability and timestamps. */
public record AdminProductDto(
        Long id,
        String title,
        ProductCategory category,
        String subcategory,
        BigDecimal price,
        String description,
        List<String> characteristics,
        List<ProductImageDto> images,
        boolean available,
        Instant createdAt,
        Instant updatedAt) {}
