package com.armakers3d.catalog.service;

import com.armakers3d.catalog.domain.Product;
import com.armakers3d.catalog.domain.ProductCategory;
import com.armakers3d.catalog.domain.ProductData;
import com.armakers3d.catalog.domain.ProductRules;
import com.armakers3d.catalog.domain.ProductSort;
import com.armakers3d.catalog.repository.ProductRepository;
import com.armakers3d.shared.error.NotFoundException;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import java.math.BigDecimal;
import java.time.Clock;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Administrator product management (contract review E9-E13). Who may call it (ADMINISTRADOR only)
 * is decided centrally by the role matrix. Every mutation re-validates and normalizes the input
 * through {@link ProductRules} (independent of the DTO) and is audit-logged with ids only.
 * Read-modify-write operations are serialized with a lock, enough for a single instance; a database
 * adapter must use optimistic locking instead.
 */
@Service
public class ProductAdminService {

    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.catalog");

    /** Admin listing filters; {@code available} null means both. */
    public record AdminFilter(String q, ProductCategory category, Boolean available) {}

    private final ProductRepository repository;
    private final Clock clock;
    private final Object mutationLock = new Object();

    public ProductAdminService(ProductRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    public Page<Product> list(AdminFilter filter, PageRequest pageRequest, String sort) {
        var criteria = CatalogService.toCriteria(
                new CatalogService.Filter(filter.q(), filter.category(), null, null, null), filter.available());
        return repository.search(criteria, ProductSort.parse(sort), pageRequest);
    }

    public Product get(Long id) {
        return load(id);
    }

    /** Created with {@code available = true}. */
    public Product create(Long actorId, WriteCommand command) {
        ProductData data = command.normalized();
        Product saved = repository.save(Product.create(data, clock.instant()));
        audit.info("admin.product.created actor={} product={}", actorId, saved.id());
        return saved;
    }

    /** Full replace of the editable fields; availability is not touched. */
    public Product update(Long actorId, Long id, WriteCommand command) {
        ProductData data = command.normalized();
        synchronized (mutationLock) {
            Product saved = repository.save(load(id).updatedWith(data, clock.instant()));
            audit.info("admin.product.updated actor={} product={}", actorId, id);
            return saved;
        }
    }

    public Product setAvailability(Long actorId, Long id, boolean available) {
        synchronized (mutationLock) {
            Product current = load(id);
            if (current.available() == available) {
                return current;
            }
            Product saved = repository.save(current.withAvailability(available, clock.instant()));
            audit.info("admin.product.availability_changed actor={} product={} from={} to={}",
                    actorId, id, current.available(), available);
            return saved;
        }
    }

    private Product load(Long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException("Product not found."));
    }

    /** Raw write input; validation happens in {@link #normalized()}. */
    public record WriteCommand(
            String title,
            ProductCategory category,
            String subcategory,
            String description,
            BigDecimal price,
            List<String> characteristics) {

        ProductData normalized() {
            return ProductRules.normalize(title, category, subcategory, description, price, characteristics);
        }
    }
}
