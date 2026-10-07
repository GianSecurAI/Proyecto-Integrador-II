package com.armakers3d.catalog.mapper;

import com.armakers3d.catalog.domain.Product;
import com.armakers3d.catalog.dto.AdminProductDto;
import com.armakers3d.catalog.dto.ProductDetailDto;
import com.armakers3d.catalog.dto.ProductSummaryDto;
import java.util.List;

/** Domain to DTO mapping. Only contract fields are copied; images are always empty (D-12). */
public final class ProductDtoMapper {

    private ProductDtoMapper() {}

    public static ProductSummaryDto toSummary(Product p) {
        return new ProductSummaryDto(p.id(), p.title(), p.category(), p.subcategory(), p.price());
    }

    public static ProductDetailDto toDetail(Product p) {
        return new ProductDetailDto(p.id(), p.title(), p.category(), p.subcategory(), p.price(),
                p.description(), p.characteristics(), List.of());
    }

    public static AdminProductDto toAdmin(Product p) {
        return new AdminProductDto(p.id(), p.title(), p.category(), p.subcategory(), p.price(),
                p.description(), p.characteristics(), List.of(), p.available(), p.createdAt(), p.updatedAt());
    }
}
