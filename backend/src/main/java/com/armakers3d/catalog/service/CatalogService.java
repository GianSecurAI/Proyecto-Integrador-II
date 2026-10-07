package com.armakers3d.catalog.service;

import com.armakers3d.catalog.domain.Product;
import com.armakers3d.catalog.domain.ProductCategory;
import com.armakers3d.catalog.domain.ProductRules;
import com.armakers3d.catalog.domain.ProductSearchCriteria;
import com.armakers3d.catalog.domain.ProductSort;
import com.armakers3d.catalog.repository.ProductRepository;
import com.armakers3d.shared.error.NotFoundException;
import com.armakers3d.shared.error.ValidationFailedException;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Public catalog read (contract review E7/E8). The single place that decides what a non-staff
 * caller may see: only {@code available} products, always, whoever is calling. It also owns the
 * filter validation shared with the admin listing, and is the read API other modules (orders,
 * checkout) will use to revalidate availability and price (business rule 9).
 */
@Service
public class CatalogService {

    /** Optional filters of the public listing. */
    public record Filter(String q, ProductCategory category, BigDecimal minPrice, BigDecimal maxPrice, List<Long> ids) {}

    /**
     * Small read model for other modules (orders): what an order line snapshots. Deliberately not the
     * catalog domain type, so {@code orders} never depends on catalog internals.
     */
    public record OrderableProduct(Long id, String title, BigDecimal unitPrice) {}

    private final ProductRepository repository;

    public CatalogService(ProductRepository repository) {
        this.repository = repository;
    }

    public Page<Product> listAvailable(Filter filter, PageRequest pageRequest, String sort) {
        ProductSort parsedSort = ProductSort.parse(sort);
        return repository.search(toCriteria(filter, true), parsedSort, pageRequest);
    }

    /** An unavailable product is indistinguishable from an unknown one (404). */
    public Product getAvailable(Long id) {
        return repository
                .findById(id)
                .filter(Product::available)
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    /**
     * Authoritative title and price of a product that can be ordered right now (business rule 9:
     * availability and price are revalidated by the server at order time). Empty when the product is
     * unknown or unavailable; callers cannot tell the two apart (same rule as {@link #getAvailable}).
     */
    public java.util.Optional<OrderableProduct> findOrderable(Long id) {
        return repository
                .findById(id)
                .filter(Product::available)
                .map(p -> new OrderableProduct(p.id(), p.title(), p.price()));
    }

    /** Builds validated criteria; {@code available} is null for "any" (admin listing only). */
    static ProductSearchCriteria toCriteria(Filter filter, Boolean available) {
        if (filter.q() != null && filter.q().length() > ProductRules.SEARCH_MAX) {
            throw new ValidationFailedException("q", "must be at most " + ProductRules.SEARCH_MAX + " characters");
        }
        if (filter.minPrice() != null && filter.minPrice().signum() < 0) {
            throw new ValidationFailedException("minPrice", "must be >= 0");
        }
        if (filter.maxPrice() != null && filter.maxPrice().signum() < 0) {
            throw new ValidationFailedException("maxPrice", "must be >= 0");
        }
        if (filter.minPrice() != null && filter.maxPrice() != null && filter.minPrice().compareTo(filter.maxPrice()) > 0) {
            throw new ValidationFailedException("minPrice", "must be less than or equal to maxPrice");
        }
        var ids = filter.ids() == null ? null : new HashSet<>(filter.ids());
        if (ids != null && (ids.isEmpty() || filter.ids().size() > ProductRules.IDS_MAX)) {
            throw new ValidationFailedException("ids", "must contain between 1 and " + ProductRules.IDS_MAX + " ids");
        }
        return new ProductSearchCriteria(filter.q(), filter.category(), filter.minPrice(), filter.maxPrice(), ids, available);
    }
}
