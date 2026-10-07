package com.armakers3d.catalog.dto;

import com.armakers3d.catalog.domain.ProductCategory;
import java.math.BigDecimal;
import java.util.List;

/** Contract review E8 {@code ProductDetail}: summary fields plus description, characteristics, images. */
public record ProductDetailDto(
        Long id,
        String title,
        ProductCategory category,
        String subcategory,
        BigDecimal price,
        String description,
        List<String> characteristics,
        List<ProductImageDto> images) {}
