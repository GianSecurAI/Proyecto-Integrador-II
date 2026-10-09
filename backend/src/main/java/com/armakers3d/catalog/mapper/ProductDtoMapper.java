package com.armakers3d.catalog.mapper;

import com.armakers3d.catalog.domain.Product;
import com.armakers3d.catalog.dto.AdminProductDto;
import com.armakers3d.catalog.dto.ProductDetailDto;
import com.armakers3d.catalog.dto.ProductImageDto;
import com.armakers3d.catalog.dto.ProductSummaryDto;
import java.util.List;

/** Domain to DTO mapping. Only contract fields are copied; images are always empty (D-12). */
public final class ProductDtoMapper {

    private ProductDtoMapper() {}

    private static List<ProductImageDto> images(Product p) {
        return p.imageUrl() == null ? List.of() : List.of(new ProductImageDto(p.imageUrl(), p.title()));
    }

    public static ProductSummaryDto toSummary(Product p) {
        return new ProductSummaryDto(p.id(), p.title(), p.category(), p.subcategory(), p.price(), p.imageUrl());
    }

    public static ProductDetailDto toDetail(Product p) {
        return new ProductDetailDto(p.id(), p.title(), p.category(), p.subcategory(), p.price(),
                p.description(), p.characteristics(), images(p));
    }

    public static AdminProductDto toAdmin(Product p) {
        return new AdminProductDto(p.id(), p.title(), p.category(), p.subcategory(), p.price(),
                p.description(), p.characteristics(), images(p), p.available(), p.createdAt(), p.updatedAt());
    }
}
