package com.armakers3d.orders;

import static org.assertj.core.api.Assertions.assertThat;

import com.armakers3d.catalog.service.CatalogService;
import com.armakers3d.orders.domain.ContactInfo;
import com.armakers3d.orders.domain.DeliveryInfo;
import com.armakers3d.orders.domain.RequestedItem;
import com.armakers3d.orders.repository.OrderRepository;
import com.armakers3d.orders.service.OrderService;
import com.armakers3d.orders.service.PlaceOrderCommand;
import com.armakers3d.orders.service.PlacedOrder;
import com.armakers3d.orders.service.exception.IdempotencyKeyReusedException;
import com.armakers3d.shared.pagination.PageRequest;
import com.armakers3d.users.AbstractNoDbRbacTest;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Service level (real beans, in-memory adapters): duplicate-submission protection under real concurrency. */
class OrderServiceConcurrencyTest extends AbstractNoDbRbacTest {

    @Autowired private OrderService orderService;
    @Autowired private OrderRepository orderRepository;
    @Autowired private CatalogService catalogService;

    private PlaceOrderCommand command(Long customerId, String key, int quantity) {
        long productId = catalogService
                .listAvailable(new CatalogService.Filter(null, null, null, null, null), new PageRequest(0, 1), null)
                .content()
                .get(0)
                .id();
        return new PlaceOrderCommand(
                customerId, key, List.of(new RequestedItem(productId, quantity)),
                new DeliveryInfo("Calle 1", "Surco", null), new ContactInfo("Ana Perez", "999888777"));
    }

    @Test
    void concurrentSubmissionsWithTheSameKeyCreateExactlyOneOrder() throws Exception {
        String email = uniqueEmail("race");
        Long customerId = provision(email, com.armakers3d.auth.domain.Rol.CLIENTE).getId();
        String key = UUID.randomUUID().toString();
        int threads = 24;

        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch go = new CountDownLatch(1);
        List<Future<PlacedOrder>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            futures.add(pool.submit(() -> {
                ready.countDown();
                go.await();
                return orderService.placeStandardOrder(command(customerId, key, 2));
            }));
        }
        ready.await();
        go.countDown();
        List<PlacedOrder> results = new ArrayList<>();
        for (Future<PlacedOrder> f : futures) {
            results.add(f.get());
        }
        pool.shutdown();

        assertThat(orderRepository.findByCustomerId(customerId)).hasSize(1);
        Set<String> ids = results.stream().map(r -> r.order().id()).collect(Collectors.toSet());
        assertThat(ids).hasSize(1);
        assertThat(results.stream().filter(r -> !r.replayed())).hasSize(1);
        assertThat(results.stream().filter(PlacedOrder::replayed)).hasSize(threads - 1);
    }

    @Test
    void concurrentSubmissionsWithDifferentBodiesUnderOneKeyCreateOneOrderAndRejectTheRest() throws Exception {
        Long customerId = provision(uniqueEmail("race-diff"), com.armakers3d.auth.domain.Rol.CLIENTE).getId();
        String key = UUID.randomUUID().toString();
        int threads = 16;

        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch go = new CountDownLatch(1);
        List<Future<Object>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            int quantity = 1 + i; // every thread sends a different body
            futures.add(pool.submit(() -> {
                go.await();
                try {
                    return orderService.placeStandardOrder(command(customerId, key, quantity));
                } catch (IdempotencyKeyReusedException e) {
                    return e;
                }
            }));
        }
        go.countDown();
        int created = 0;
        int rejected = 0;
        for (Future<Object> f : futures) {
            Object r = f.get();
            if (r instanceof PlacedOrder p && !p.replayed()) {
                created++;
            } else if (r instanceof IdempotencyKeyReusedException) {
                rejected++;
            }
        }
        pool.shutdown();

        assertThat(created).isEqualTo(1);
        assertThat(rejected).isEqualTo(threads - 1);
        assertThat(orderRepository.findByCustomerId(customerId)).hasSize(1);
    }

    @Test
    void concurrentSubmissionsWithoutKeysAreAllCreatedWithUniqueCodes() throws ExecutionException, InterruptedException {
        Long customerId = provision(uniqueEmail("race-nokey"), com.armakers3d.auth.domain.Rol.CLIENTE).getId();
        int threads = 12;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        List<Future<PlacedOrder>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            futures.add(pool.submit(() -> orderService.placeStandardOrder(command(customerId, null, 1))));
        }
        Set<String> ids = new java.util.HashSet<>();
        for (Future<PlacedOrder> f : futures) {
            ids.add(f.get().order().id());
        }
        pool.shutdown();
        assertThat(ids).hasSize(threads);
        assertThat(orderRepository.findByCustomerId(customerId)).hasSize(threads);
    }
}
