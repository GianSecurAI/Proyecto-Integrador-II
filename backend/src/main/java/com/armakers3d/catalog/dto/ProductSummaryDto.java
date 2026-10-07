package com.armakers3d.catalog.dto;

import com.armakers3d.catalog.domain.ProductCategory;
import java.math.BigDecimal;

/** Contract review E7 {@code ProductSummary}. Price is a JSON number with 2 decimals, PEN implied. */
public record ProductSummaryDto(Long id, String title, ProductCategory category, String subcategory, BigDecimal price) {}
