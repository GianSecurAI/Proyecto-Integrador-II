package com.armakers3d.catalog.controller;

import com.armakers3d.catalog.domain.ProductCategory;
import com.armakers3d.catalog.dto.ProductDetailDto;
import com.armakers3d.catalog.dto.ProductSummaryDto;
import com.armakers3d.catalog.mapper.ProductDtoMapper;
import com.armakers3d.catalog.service.CatalogService;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Public catalog read (contract review E7, E8). Only available products; no authentication needed. */
@RestController
@RequestMapping("/api/catalog/products")
@Tag(name = "Catalog", description = "Public product catalog (available products only).")
public class CatalogController {

    private final CatalogService catalogService;

    public CatalogController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping
    @Operation(
            summary = "List available products",
            description = "Filters q (title substring), category, minPrice, maxPrice, ids (comma separated, max 50);"
                    + " sort = price|title|createdAt[,asc|desc] (default createdAt,desc).")
    public Page<ProductSummaryDto> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) ProductCategory category,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) List<Long> ids,
            @RequestParam(defaultValue = "0") @Min(value = 0, message = "page must be >= 0") int page,
            @RequestParam(defaultValue = "20")
                    @Min(value = 1, message = "size must be between 1 and 100")
                    @Max(value = 100, message = "size must be between 1 and 100")
                    int size,
            @RequestParam(required = false) String sort) {
        return catalogService
                .listAvailable(new CatalogService.Filter(q, category, minPrice, maxPrice, ids), new PageRequest(page, size), sort)
                .map(ProductDtoMapper::toSummary);
    }

    @GetMapping("/{id:\\d+}")
    @Operation(summary = "Get an available product")
    public ProductDetailDto get(@PathVariable Long id) {
        return ProductDtoMapper.toDetail(catalogService.getAvailable(id));
    }
}
