package com.armakers3d.catalog.infrastructure.jpa;

import com.armakers3d.catalog.domain.Product;
import com.armakers3d.catalog.domain.ProductSearchCriteria;
import com.armakers3d.catalog.domain.ProductSort;
import com.armakers3d.catalog.repository.ProductRepository;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * PostgreSQL-backed {@link ProductRepository} (tables {@code producto} and {@code producto_caracteristica}), selected
 * by {@code app.persistence.catalog=jpa}. Filtering, ordering and paging run in the database with the same semantics as
 * the in-memory adapter: case-insensitive title search, inclusive price range, ties broken by id.
 */
@Repository
@ConditionalOnProperty(name = "app.persistence.catalog", havingValue = "jpa")
public class JpaProductRepositoryAdapter implements ProductRepository {

    private final ProductJpaRepository jpa;

    @PersistenceContext
    private EntityManager em;

    public JpaProductRepositoryAdapter(ProductJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    @Transactional
    public Product save(Product product) {
        return toDomain(jpa.save(new ProductEntity(
                product.id(),
                product.title(),
                product.category(),
                product.subcategory(),
                product.description(),
                product.price(),
                product.characteristics(),
                product.available(),
                product.createdAt(),
                product.updatedAt(),
                product.imageUrl())));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Product> findById(Long id) {
        return jpa.findById(id).map(JpaProductRepositoryAdapter::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Product> search(ProductSearchCriteria criteria, ProductSort sort, PageRequest pageRequest) {
        CriteriaBuilder cb = em.getCriteriaBuilder();

        CriteriaQuery<Long> count = cb.createQuery(Long.class);
        Root<ProductEntity> countRoot = count.from(ProductEntity.class);
        count.select(cb.count(countRoot)).where(predicates(cb, countRoot, criteria));
        long total = em.createQuery(count).getSingleResult();

        CriteriaQuery<ProductEntity> query = cb.createQuery(ProductEntity.class);
        Root<ProductEntity> root = query.from(ProductEntity.class);
        query.select(root).where(predicates(cb, root, criteria)).orderBy(order(cb, root, sort));
        List<Product> content = em.createQuery(query)
                .setFirstResult((int) pageRequest.offset())
                .setMaxResults(pageRequest.size())
                .getResultList()
                .stream()
                .map(JpaProductRepositoryAdapter::toDomain)
                .toList();

        int totalPages = (int) ((total + pageRequest.size() - 1L) / pageRequest.size());
        return new Page<>(content, pageRequest.page(), pageRequest.size(), total, totalPages);
    }

    private static Predicate[] predicates(CriteriaBuilder cb, Root<ProductEntity> root, ProductSearchCriteria c) {
        List<Predicate> list = new ArrayList<>();
        if (c.q() != null && !c.q().isBlank()) {
            String needle = "%" + escapeLike(c.q().trim().toLowerCase(Locale.ROOT)) + "%";
            list.add(cb.like(cb.lower(root.get("title")), needle, '\\'));
        }
        if (c.category() != null) {
            list.add(cb.equal(root.get("category"), c.category()));
        }
        if (c.minPrice() != null) {
            list.add(cb.greaterThanOrEqualTo(root.<java.math.BigDecimal>get("price"), c.minPrice()));
        }
        if (c.maxPrice() != null) {
            list.add(cb.lessThanOrEqualTo(root.<java.math.BigDecimal>get("price"), c.maxPrice()));
        }
        if (c.ids() != null) {
            list.add(c.ids().isEmpty() ? cb.disjunction() : root.get("id").in(c.ids()));
        }
        if (c.available() != null) {
            list.add(cb.equal(root.get("available"), c.available()));
        }
        return list.toArray(Predicate[]::new);
    }

    private static List<Order> order(CriteriaBuilder cb, Root<ProductEntity> root, ProductSort sort) {
        Expression<?> key =
                switch (sort.field()) {
                    case PRICE -> root.get("price");
                    case TITLE -> cb.lower(root.<String>get("title"));
                    case CREATED_AT -> root.get("createdAt");
                };
        return sort.descending()
                ? List.of(cb.desc(key), cb.desc(root.get("id")))
                : List.of(cb.asc(key), cb.asc(root.get("id")));
    }

    private static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static Product toDomain(ProductEntity e) {
        return new Product(
                e.getId(),
                e.getTitle(),
                e.getCategory(),
                e.getSubcategory(),
                e.getDescription(),
                e.getPrice(),
                List.copyOf(e.getCharacteristics()),
                e.isAvailable(),
                e.getCreatedAt(),
                e.getUpdatedAt(),
                e.getImageUrl());
    }
}
