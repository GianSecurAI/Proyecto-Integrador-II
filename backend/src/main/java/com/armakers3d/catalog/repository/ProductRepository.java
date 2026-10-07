package com.armakers3d.catalog.repository;

import com.armakers3d.catalog.domain.Product;
import com.armakers3d.catalog.domain.ProductSearchCriteria;
import com.armakers3d.catalog.domain.ProductSort;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import java.util.Optional;

/**
 * Port for product persistence (backend-foundation.md section 10). Behavior shared by every
 * adapter and proven by {@code ProductRepositoryContractTest}: {@code save} assigns a unique id
 * when {@code product.id()} is null and returns the stored product, otherwise overwrites by id;
 * {@code findById} returns empty for unknown ids; {@code search} applies
 * {@link ProductSearchCriteria#matches} semantics, orders by {@link ProductSort#comparator()} and
 * pages the result.
 */
public interface ProductRepository {

    Product save(Product product);

    Optional<Product> findById(Long id);

    Page<Product> search(ProductSearchCriteria criteria, ProductSort sort, PageRequest pageRequest);
}
