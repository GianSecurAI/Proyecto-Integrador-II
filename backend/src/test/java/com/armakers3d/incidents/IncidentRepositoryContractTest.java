package com.armakers3d.incidents;

import static org.assertj.core.api.Assertions.assertThat;

import com.armakers3d.incidents.domain.Incident;
import com.armakers3d.incidents.domain.IncidentPriority;
import com.armakers3d.incidents.domain.IncidentSearchCriteria;
import com.armakers3d.incidents.domain.IncidentSort;
import com.armakers3d.incidents.domain.IncidentStatus;
import com.armakers3d.incidents.repository.IncidentRepository;
import com.armakers3d.shared.pagination.PageRequest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Behavior every {@link IncidentRepository} adapter must have; a JPA adapter test subclasses it later. */
public abstract class IncidentRepositoryContractTest {

    private static final Instant T0 = Instant.parse("2026-10-06T10:00:00Z");

    protected abstract IncidentRepository createRepository();

    private IncidentRepository repository;

    @BeforeEach
    void setUp() {
        repository = createRepository();
    }

    private Incident incident(Long customer, String order, String description, Instant at) {
        return repository.save(Incident.open(repository.nextIncidentNumber(), order, customer, description, at));
    }

    @Test
    void incidentNumbersAreUniqueWellFormedAndNeverReusedEvenConcurrently() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(8);
        Set<String> numbers = ConcurrentHashMap.newKeySet();
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < 200; i++) {
            futures.add(pool.submit(() -> numbers.add(repository.nextIncidentNumber())));
        }
        for (Future<?> f : futures) {
            f.get();
        }
        pool.shutdown();
        assertThat(numbers).hasSize(200).allMatch(n -> n.matches("INC-\\d{6}"));
    }

    @Test
    void saveThenFindByIdRoundTripsAndUnknownIsEmpty() {
        Incident saved = incident(1L, "PED-000001", "Descripcion de prueba", T0);
        assertThat(repository.findById(saved.id())).contains(saved);
        assertThat(repository.findById("INC-999999")).isEmpty();
    }

    @Test
    void findNonTerminalByOrderIdReturnsOnlyOpenIncidentsOfThatOrder() {
        Incident open = incident(1L, "PED-000001", "Abierta", T0);
        Incident review = incident(1L, "PED-000001", "En revision", T0);
        repository.save(review.triage(IncidentStatus.EN_REVISION, null, T0));
        Incident rejected = incident(1L, "PED-000001", "Rechazada", T0);
        repository.save(rejected.triage(IncidentStatus.EN_REVISION, null, T0).triage(IncidentStatus.RECHAZADA, null, T0));
        incident(1L, "PED-000002", "Otro pedido", T0);

        assertThat(repository.findNonTerminalByOrderId("PED-000001")).extracting(Incident::id)
                .containsExactlyInAnyOrder(open.id(), review.id());
        assertThat(repository.findNonTerminalByOrderId("PED-000009")).isEmpty();
    }

    @Test
    void searchAppliesCriteriaSortAndPaging() {
        Incident a = incident(1L, "PED-000001", "Pieza rota", T0);
        Incident b = incident(1L, "PED-000001", "Color INCORRECTO", T0.plusSeconds(10));
        Incident c = incident(2L, "PED-000002", "Pieza rota tambien", T0.plusSeconds(20));
        repository.save(b.triage(null, IncidentPriority.ALTA, T0.plusSeconds(30)));

        var all = new IncidentSearchCriteria(null, null, null, null);
        assertThat(repository.search(all, IncidentSort.DEFAULT, new PageRequest(0, 20)).content())
                .extracting(Incident::id).containsExactly(c.id(), b.id(), a.id());
        assertThat(repository.search(all, new IncidentSort(false), new PageRequest(0, 20)).content())
                .extracting(Incident::id).containsExactly(a.id(), b.id(), c.id());
        assertThat(repository.search(new IncidentSearchCriteria(1L, null, null, null), IncidentSort.DEFAULT,
                        new PageRequest(0, 20)).content()).extracting(Incident::id).containsExactly(b.id(), a.id());
        assertThat(repository.search(new IncidentSearchCriteria(null, null, IncidentPriority.ALTA, null),
                        IncidentSort.DEFAULT, new PageRequest(0, 20)).content()).extracting(Incident::id).containsExactly(b.id());
        assertThat(repository.search(new IncidentSearchCriteria(null, IncidentStatus.RESUELTA, null, null),
                IncidentSort.DEFAULT, new PageRequest(0, 20)).content()).isEmpty();
        assertThat(repository.search(new IncidentSearchCriteria(null, null, null, "  PIEZA ROTA "), IncidentSort.DEFAULT,
                        new PageRequest(0, 20)).content()).extracting(Incident::id).containsExactly(c.id(), a.id());

        var page = repository.search(all, IncidentSort.DEFAULT, new PageRequest(1, 2));
        assertThat(page.content()).extracting(Incident::id).containsExactly(a.id());
        assertThat(page.totalElements()).isEqualTo(3);
        assertThat(page.totalPages()).isEqualTo(2);
        assertThat(repository.search(all, IncidentSort.DEFAULT, new PageRequest(5, 2)).content()).isEmpty();
    }

    @Test
    void sortTiesAreBrokenByIdSoThePageOrderIsStable() {
        Incident a = incident(1L, "PED-000001", "Misma hora uno", T0);
        Incident b = incident(1L, "PED-000001", "Misma hora dos", T0);
        var all = new IncidentSearchCriteria(null, null, null, null);
        assertThat(repository.search(all, new IncidentSort(false), new PageRequest(0, 20)).content())
                .extracting(Incident::id).containsExactly(a.id(), b.id());
    }

    @Test
    void replaceIfCurrentReplacesOnlyWhenTheStoredValueIsTheExpectedOne() {
        Incident original = incident(1L, "PED-000001", "Para cambiar", T0);
        Incident moved = original.triage(IncidentStatus.EN_REVISION, null, T0.plusSeconds(1));

        assertThat(repository.replaceIfCurrent(original, moved)).isTrue();
        assertThat(repository.findById(original.id())).contains(moved);
        // the stale expectation no longer matches
        Incident other = original.triage(null, IncidentPriority.BAJA, T0.plusSeconds(2));
        assertThat(repository.replaceIfCurrent(original, other)).isFalse();
        assertThat(repository.findById(original.id())).contains(moved);
        // unknown incident
        Incident ghost = Incident.open("INC-999999", "PED-000001", 1L, "Fantasma", T0);
        assertThat(repository.replaceIfCurrent(ghost, ghost.triage(null, IncidentPriority.ALTA, T0))).isFalse();
        assertThat(repository.findById("INC-999999")).isEmpty();
    }

    @Test
    void ofManyConcurrentReplacementsExactlyOneWins() throws Exception {
        Incident original = incident(1L, "PED-000001", "Carrera", T0);
        int threads = 8;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger wins = new AtomicInteger();
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            final int n = i;
            futures.add(pool.submit(() -> {
                start.await();
                Incident updated = original.triage(null, n % 2 == 0 ? IncidentPriority.ALTA : IncidentPriority.BAJA,
                        T0.plusSeconds(n + 1));
                if (repository.replaceIfCurrent(original, updated)) {
                    wins.incrementAndGet();
                }
                return null;
            }));
        }
        start.countDown();
        for (Future<?> f : futures) {
            f.get();
        }
        pool.shutdown();
        assertThat(wins.get()).isEqualTo(1);
    }
}
