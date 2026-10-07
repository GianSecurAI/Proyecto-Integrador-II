package com.armakers3d.orders;

import static org.assertj.core.api.Assertions.assertThat;

import com.armakers3d.orders.domain.ContactInfo;
import com.armakers3d.orders.domain.DeliveryInfo;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderSearchCriteria;
import com.armakers3d.orders.domain.OrderSort;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.shared.pagination.PageRequest;
import java.util.concurrent.atomic.AtomicInteger;
import com.armakers3d.orders.domain.OrderLine;
import com.armakers3d.orders.repository.OrderRepository;
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

/** Behavior every {@link OrderRepository} adapter must have; a JPA adapter test subclasses it later. */
public abstract class OrderRepositoryContractTest {

    protected abstract OrderRepository createRepository();

    private OrderRepository repository;

    @BeforeEach
    void setUp() {
        repository = createRepository();
    }

    private Order order(String id, Long customer, Instant at) {
        return Order.placeStandard(
                id, customer, List.of(new OrderLine(1L, "A", new BigDecimal("1.00"), 1)),
                new DeliveryInfo("Calle 1", "Surco", null), new ContactInfo("Ana", "999888777"), at);
    }

    @Test
    void orderNumbersAreUniqueWellFormedAndNeverReusedEvenConcurrently() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(8);
        Set<String> numbers = ConcurrentHashMap.newKeySet();
        List<Future<?>> futures = new java.util.ArrayList<>();
        for (int i = 0; i < 200; i++) {
            futures.add(pool.submit(() -> numbers.add(repository.nextOrderNumber())));
        }
        for (Future<?> f : futures) {
            f.get();
        }
        pool.shutdown();
        assertThat(numbers).hasSize(200).allMatch(n -> n.matches("PED-\\d{6}"));
    }

    @Test
    void savedOrdersAreFoundByIdAndUnknownIdIsEmpty() {
        Order saved = repository.save(order(repository.nextOrderNumber(), 1L, Instant.EPOCH));
        assertThat(repository.findById(saved.id())).contains(saved);
        assertThat(repository.findById("PED-999999")).isEmpty();
    }

    @Test
    void findByCustomerReturnsOnlyThatCustomersOrdersNewestFirst() {
        Order older = repository.save(order(repository.nextOrderNumber(), 1L, Instant.parse("2026-01-01T00:00:00Z")));
        Order newer = repository.save(order(repository.nextOrderNumber(), 1L, Instant.parse("2026-02-01T00:00:00Z")));
        repository.save(order(repository.nextOrderNumber(), 2L, Instant.parse("2026-03-01T00:00:00Z")));

        assertThat(repository.findByCustomerId(1L)).containsExactly(newer, older);
        assertThat(repository.findByCustomerId(3L)).isEmpty();
    }

    // ---------- search ----------

    private static OrderSearchCriteria all() {
        return new OrderSearchCriteria(null, null, null, null, null, null, null);
    }

    private Order personalized(Long customer, Instant at) {
        return Order.registerPersonalized(
                repository.nextOrderNumber(), customer, 99L, Rol.ASESOR, "Figura", new BigDecimal("10.00"), at);
    }

    @Test
    void searchFiltersByCustomerStatusKindAndDateRange() {
        Instant jan = Instant.parse("2026-01-10T12:00:00Z");
        Instant feb = Instant.parse("2026-02-10T12:00:00Z");
        Order a = repository.save(order(repository.nextOrderNumber(), 1L, jan)
                .transitionTo(OrderStatus.EN_PRODUCCION, 5L, Rol.ASESOR, null, jan));
        Order b = repository.save(personalized(1L, feb));
        Order c = repository.save(order(repository.nextOrderNumber(), 2L, feb));

        var sort = OrderSort.DEFAULT;
        var page = new PageRequest(0, 50);
        assertThat(repository.search(all(), sort, page).content()).containsExactly(c, b, a);
        assertThat(repository.search(new OrderSearchCriteria(1L, null, null, null, null, null, null), sort, page).content())
                .containsExactly(b, a);
        assertThat(repository.search(new OrderSearchCriteria(null, OrderStatus.CONFIRMADO, null, null, null, null, null), sort, page)
                .content()).containsExactly(c, b);
        assertThat(repository.search(new OrderSearchCriteria(null, OrderStatus.EN_PRODUCCION, null, null, null, null, null), sort, page)
                .content()).containsExactly(a);
        assertThat(repository.search(new OrderSearchCriteria(null, null, OrderKind.ESTANDAR, null, null, null, null), sort, page)
                .content()).containsExactly(c, a);
        // from inclusive, toExclusive exclusive
        assertThat(repository.search(new OrderSearchCriteria(null, null, null, feb, null, null, null), sort, page).content())
                .containsExactly(c, b);
        assertThat(repository.search(new OrderSearchCriteria(null, null, null, null, feb, null, null), sort, page).content())
                .containsExactly(a);
        assertThat(repository.search(new OrderSearchCriteria(null, null, null, jan, jan, null, null), sort, page).content())
                .isEmpty();
    }

    @Test
    void searchTextMatchesTheOrderIdOrTheResolvedOwnersCaseInsensitively() {
        Order a = repository.save(order(repository.nextOrderNumber(), 1L, Instant.parse("2026-01-01T00:00:00Z")));
        Order b = repository.save(order(repository.nextOrderNumber(), 2L, Instant.parse("2026-01-02T00:00:00Z")));
        var page = new PageRequest(0, 50);

        var byId = new OrderSearchCriteria(null, null, null, null, null, a.id().toLowerCase(), Set.of());
        assertThat(repository.search(byId, OrderSort.DEFAULT, page).content()).containsExactly(a);
        var byOwner = new OrderSearchCriteria(null, null, null, null, null, "someone@example.test", Set.of(2L));
        assertThat(repository.search(byOwner, OrderSort.DEFAULT, page).content()).containsExactly(b);
        var neither = new OrderSearchCriteria(null, null, null, null, null, "zzz", Set.of());
        assertThat(repository.search(neither, OrderSort.DEFAULT, page).content()).isEmpty();
    }

    @Test
    void searchPagesAndSortsInBothDirections() {
        List<Order> saved = new java.util.ArrayList<>();
        for (int i = 1; i <= 5; i++) {
            saved.add(repository.save(order(repository.nextOrderNumber(), 1L, Instant.parse("2026-01-0" + i + "T00:00:00Z"))));
        }
        var desc = repository.search(all(), new OrderSort(true), new PageRequest(1, 2));
        assertThat(desc.content()).containsExactly(saved.get(2), saved.get(1));
        assertThat(desc.page()).isEqualTo(1);
        assertThat(desc.size()).isEqualTo(2);
        assertThat(desc.totalElements()).isEqualTo(5);
        assertThat(desc.totalPages()).isEqualTo(3);
        var asc = repository.search(all(), new OrderSort(false), new PageRequest(2, 2));
        assertThat(asc.content()).containsExactly(saved.get(4));
        assertThat(repository.search(all(), OrderSort.DEFAULT, new PageRequest(9, 2)).content()).isEmpty();
    }

    // ---------- compare-and-set ----------

    @Test
    void replaceIfStatusAppliesOnlyWhenTheCurrentStatusMatches() {
        Order saved = repository.save(order(repository.nextOrderNumber(), 1L, Instant.EPOCH));
        Order confirmed = saved.transitionTo(OrderStatus.EN_PRODUCCION, 5L, Rol.ASESOR, null, Instant.EPOCH.plusSeconds(1));

        assertThat(repository.replaceIfStatus(confirmed, OrderStatus.ENVIADO)).isFalse();
        assertThat(repository.findById(saved.id())).contains(saved);

        assertThat(repository.replaceIfStatus(confirmed, OrderStatus.CONFIRMADO)).isTrue();
        assertThat(repository.findById(saved.id())).contains(confirmed);

        // The same expectation again fails: the stored status is no longer PENDIENTE.
        assertThat(repository.replaceIfStatus(confirmed, OrderStatus.CONFIRMADO)).isFalse();
    }

    @Test
    void replaceIfStatusOnAnUnknownOrderIsFalseAndStoresNothing() {
        Order ghost = order("PED-424242", 1L, Instant.EPOCH);
        assertThat(repository.replaceIfStatus(ghost, OrderStatus.CONFIRMADO)).isFalse();
        assertThat(repository.findById("PED-424242")).isEmpty();
    }

    @Test
    void ofManyConcurrentCompareAndSetsExactlyOneWins() throws Exception {
        Order saved = repository.save(order(repository.nextOrderNumber(), 1L, Instant.EPOCH));
        int threads = 16;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        java.util.concurrent.CountDownLatch go = new java.util.concurrent.CountDownLatch(1);
        AtomicInteger winners = new AtomicInteger();
        List<Future<?>> futures = new java.util.ArrayList<>();
        for (int i = 0; i < threads; i++) {
            OrderStatus target = i % 2 == 0 ? OrderStatus.EN_PRODUCCION : OrderStatus.CANCELADO;
            futures.add(pool.submit(() -> {
                go.await();
                Order next = saved.transitionTo(target, 5L, Rol.ASESOR, null, Instant.EPOCH.plusSeconds(1));
                if (repository.replaceIfStatus(next, OrderStatus.CONFIRMADO)) {
                    winners.incrementAndGet();
                }
                return null;
            }));
        }
        go.countDown();
        for (Future<?> f : futures) {
            f.get();
        }
        pool.shutdown();
        assertThat(winners.get()).isEqualTo(1);
        assertThat(repository.findById(saved.id()).orElseThrow().history()).hasSize(2);
    }
}
