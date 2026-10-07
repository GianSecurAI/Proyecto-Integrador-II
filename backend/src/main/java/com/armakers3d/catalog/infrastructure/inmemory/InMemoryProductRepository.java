package com.armakers3d.catalog.infrastructure.inmemory;

import com.armakers3d.catalog.domain.Product;
import com.armakers3d.catalog.domain.ProductSearchCriteria;
import com.armakers3d.catalog.domain.ProductSort;
import com.armakers3d.catalog.repository.ProductRepository;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

/**
 * In-memory {@link ProductRepository}. NOT durable, in EVERY profile (there is no catalog table or
 * migration yet). Selected by {@code app.persistence.catalog=memory} (default until the JPA adapter
 * exists); {@code InMemoryStorageGuard} refuses to boot it under {@code prod}. Products are
 * immutable records, so no defensive copies are needed.
 */
@Repository
@ConditionalOnProperty(name = "app.persistence.catalog", havingValue = "memory", matchIfMissing = true)
public class InMemoryProductRepository implements ProductRepository {

    private final Map<Long, Product> byId = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();

    @Override
    public Product save(Product product) {
        Product toStore = product.id() == null ? product.withId(sequence.incrementAndGet()) : product;
        byId.put(toStore.id(), toStore);
        return toStore;
    }

    @Override
    public Optional<Product> findById(Long id) {
        return Optional.ofNullable(byId.get(id));
    }

    @Override
    public Page<Product> search(ProductSearchCriteria criteria, ProductSort sort, PageRequest pageRequest) {
        var matching = byId.values().stream()
                .filter(criteria::matches)
                .sorted(sort.comparator())
                .toList();
        return Page.of(matching, pageRequest);
    }
}
