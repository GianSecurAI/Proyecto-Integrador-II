package com.armakers3d.users;

import static org.assertj.core.api.Assertions.assertThat;

import com.armakers3d.auth.config.SessionProperties;
import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.auth.infrastructure.inmemory.InMemoryAuthenticatedSessionRepository;
import com.armakers3d.auth.infrastructure.inmemory.InMemoryClienteRepository;
import com.armakers3d.auth.service.SessionService;
import com.armakers3d.testsupport.MutableClock;
import com.armakers3d.users.service.UserAdminService;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

/**
 * Security review, last-administrator TOCTOU: the mutation lock must be released only AFTER the write is
 * committed. A method-level {@code @Transactional} commits when the method returns, i.e. after the
 * {@code synchronized} block was already left, so two concurrent demotions could both pass the
 * "is this the last active administrator" check. The structural test pins the fix; the concurrency test
 * proves the invariant (at least one active administrator) under contention.
 */
class UserAdminLockingTest {

    @Test
    void mutatingMethodsAreNotWrappedInATransactionThatOutlivesTheLock() {
        for (String name : new String[] {"createStaff", "changeRole", "setActive"}) {
            Method m = Arrays.stream(UserAdminService.class.getDeclaredMethods())
                    .filter(x -> x.getName().equals(name))
                    .findFirst()
                    .orElseThrow();
            assertThat(m.getAnnotation(Transactional.class))
                    .as("%s must not be @Transactional: the lock would be released before commit", name)
                    .isNull();
        }
        assertThat(UserAdminService.class.getAnnotation(Transactional.class)).isNull();
    }

    @Test
    void twoAdministratorsDeactivatingEachOtherConcurrentlyNeverLeaveZeroActiveAdministrators() throws Exception {
        for (int round = 0; round < 50; round++) {
            var clientes = new InMemoryClienteRepository();
            var clock = MutableClock.startingNow();
            var sessions = new SessionService(
                    new InMemoryAuthenticatedSessionRepository(), clientes, clock, new SessionProperties());
            var service = new UserAdminService(clientes, sessions, clock);
            Cliente a = clientes.save(Cliente.provisioned("a@example.test", Rol.ADMINISTRADOR, clock.instant()));
            Cliente b = clientes.save(Cliente.provisioned("b@example.test", Rol.ADMINISTRADOR, clock.instant()));

            ExecutorService pool = Executors.newFixedThreadPool(2);
            CountDownLatch start = new CountDownLatch(1);
            Runnable aKillsB = () -> attempt(start, () -> service.setActive(a.getId(), b.getId(), false));
            Runnable bKillsA = () -> attempt(start, () -> service.setActive(b.getId(), a.getId(), false));
            pool.submit(aKillsB);
            pool.submit(bKillsA);
            start.countDown();
            pool.shutdown();
            assertThat(pool.awaitTermination(10, TimeUnit.SECONDS)).isTrue();

            long active = clientes.findAll().stream()
                    .filter(c -> c.getRol() == Rol.ADMINISTRADOR && c.isActive())
                    .count();
            assertThat(active).as("round %d", round).isEqualTo(1);
        }
    }

    private static void attempt(CountDownLatch start, Runnable action) {
        try {
            start.await();
            action.run();
        } catch (RuntimeException expectedLastAdminRejection) {
            // the loser of the race is rejected with LastAdministratorException
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
