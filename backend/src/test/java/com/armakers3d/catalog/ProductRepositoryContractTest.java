package com.armakers3d.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import com.armakers3d.catalog.domain.Product;
import com.armakers3d.catalog.domain.ProductCategory;
import com.armakers3d.catalog.domain.ProductData;
import com.armakers3d.catalog.domain.ProductSearchCriteria;
import com.armakers3d.catalog.domain.ProductSort;
import com.armakers3d.catalog.repository.ProductRepository;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Behavior every {@link ProductRepository} adapter must have. A JPA adapter test will subclass this
 * with its own {@link #createRepository()} and run the same assertions.
 */
public abstract class ProductRepositoryContractTest {

    private static final Instant T0 = Instant.parse("2026-10-06T10:00:00Z");
    private static final PageRequest FIRST_100 = new PageRequest(0, 100);
    private static final ProductSearchCriteria ALL = new ProductSearchCriteria(null, null, null, null, null, null);

    protected abstract ProductRepository createRepository();

    private ProductRepository repository;

    @BeforeEach
    void setUp() {
        repository = createRepository();
    }

    private Product product(String title, ProductCategory category, String price, int createdOffsetSeconds, boolean available) {
        ProductData data = new ProductData(title, category, "sub", "desc", new BigDecimal(price), List.of("c"));
        Instant created = T0.plusSeconds(createdOffsetSeconds);
        return Product.create(data, created).withAvailability(available, created);
    }

    @Test
    void saveAssignsDistinctIdsAndFindByIdReturnsTheStoredProduct() {
        Product a = repository.save(product("A", ProductCategory.LLAVERO, "1.00", 0, true));
        Product b = repository.save(product("B", ProductCategory.LLAVERO, "2.00", 1, true));

        assertThat(a.id()).isNotNull();
        assertThat(b.id()).isNotNull().isNotEqualTo(a.id());
        assertThat(repository.findById(a.id())).contains(a);
    }

    @Test
    void findByIdOfUnknownIdIsEmpty() {
        assertThat(repository.findById(424242L)).isEmpty();
    }

    @Test
    void saveWithAnExistingIdOverwritesInsteadOfInserting() {
        Product a = repository.save(product("A", ProductCategory.LLAVERO, "1.00", 0, true));
        repository.save(a.withAvailability(false, T0.plusSeconds(5)));

        assertThat(repository.findById(a.id()).orElseThrow().available()).isFalse();
        assertThat(repository.search(ALL, ProductSort.DEFAULT, FIRST_100).totalElements()).isEqualTo(1);
    }

    @Test
    void searchFiltersByTitleCategoryPriceAvailabilityAndIds() {
        Product a = repository.save(product("Llavero rojo", ProductCategory.LLAVERO, "10.00", 0, true));
        Product b = repository.save(product("Llavero azul", ProductCategory.LLAVERO, "20.00", 1, false));
        Product c = repository.save(product("Pegatina roja", ProductCategory.PEGATINAS, "30.00", 2, true));

        assertThat(ids(new ProductSearchCriteria("LLAVERO", null, null, null, null, null))).containsExactlyInAnyOrder(a.id(), b.id());
        assertThat(ids(new ProductSearchCriteria(null, ProductCategory.PEGATINAS, null, null, null, null))).containsExactly(c.id());
        assertThat(ids(new ProductSearchCriteria(null, null, new BigDecimal("15"), new BigDecimal("30.00"), null, null)))
                .containsExactlyInAnyOrder(b.id(), c.id());
        assertThat(ids(new ProductSearchCriteria(null, null, null, null, null, true))).containsExactlyInAnyOrder(a.id(), c.id());
        assertThat(ids(new ProductSearchCriteria(null, null, null, null, Set.of(a.id(), 999L), null))).containsExactly(a.id());
    }

    @Test
    void searchOrdersByTheRequestedSortWithAStableTieBreak() {
        Product a = repository.save(product("b", ProductCategory.LLAVERO, "5.00", 0, true));
        Product b = repository.save(product("a", ProductCategory.LLAVERO, "5.00", 1, true));
        Product c = repository.save(product("c", ProductCategory.LLAVERO, "1.00", 2, true));

        assertThat(order(ProductSort.parse("price,asc"))).containsExactly(c.id(), a.id(), b.id());
        assertThat(order(ProductSort.parse("price,desc"))).containsExactly(b.id(), a.id(), c.id());
        assertThat(order(ProductSort.parse("title,asc"))).containsExactly(b.id(), a.id(), c.id());
        assertThat(order(ProductSort.DEFAULT)).containsExactly(c.id(), b.id(), a.id());
    }

    @Test
    void searchPaginatesAndReportsTotals() {
        for (int i = 0; i < 5; i++) {
            repository.save(product("P" + i, ProductCategory.LLAVERO, "1.00", i, true));
        }
        Page<Product> second = repository.search(ALL, ProductSort.parse("createdAt,asc"), new PageRequest(1, 2));

        assertThat(second.totalElements()).isEqualTo(5);
        assertThat(second.totalPages()).isEqualTo(3);
        assertThat(second.page()).isEqualTo(1);
        assertThat(second.content()).extracting(Product::title).containsExactly("P2", "P3");
        assertThat(repository.search(ALL, ProductSort.DEFAULT, new PageRequest(9, 2)).content()).isEmpty();
    }

    @Test
    void concurrentSavesNeverReuseAnId() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(8);
        try {
            List<Future<Long>> futures = new java.util.ArrayList<>();
            for (int i = 0; i < 200; i++) {
                int n = i;
                futures.add(pool.submit(() -> repository.save(product("T" + n, ProductCategory.LLAVERO, "1.00", n, true)).id()));
            }
            Set<Long> distinct = ConcurrentHashMap.newKeySet();
            for (Future<Long> f : futures) {
                distinct.add(f.get());
            }
            assertThat(distinct).hasSize(200);
            assertThat(repository.search(ALL, ProductSort.DEFAULT, FIRST_100).totalElements()).isEqualTo(200);
        } finally {
            pool.shutdownNow();
        }
    }

    private List<Long> ids(ProductSearchCriteria criteria) {
        return repository.search(criteria, ProductSort.DEFAULT, FIRST_100).content().stream().map(Product::id).toList();
    }

    private List<Long> order(ProductSort sort) {
        return repository.search(ALL, sort, FIRST_100).content().stream().map(Product::id).toList();
    }
}
