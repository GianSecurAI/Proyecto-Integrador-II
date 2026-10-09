package com.armakers3d.incidents.infrastructure.jpa;

import com.armakers3d.incidents.domain.Incident;
import com.armakers3d.incidents.domain.IncidentPriority;
import com.armakers3d.incidents.domain.IncidentSearchCriteria;
import com.armakers3d.incidents.domain.IncidentSort;
import com.armakers3d.incidents.domain.IncidentStatus;
import com.armakers3d.incidents.repository.IncidentRepository;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import com.armakers3d.shared.persistence.LookupTable;
import com.armakers3d.shared.persistence.PedidoRefEntity;
import com.armakers3d.shared.persistence.PedidoRefRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * PostgreSQL-backed {@link IncidentRepository} over {@code incidencia}. The public code ({@code INC-000001}) comes from
 * the sequence {@code seq_codigo_incidencia}; the order is linked through its foreign key and exposed by its public code.
 * The compare-and-set locks the incident row. Selected by {@code app.persistence.incidents=jpa}.
 */
@Repository
@ConditionalOnProperty(name = "app.persistence.incidents", havingValue = "jpa")
public class JpaIncidentRepositoryAdapter implements IncidentRepository {

    private final IncidenciaJpaRepository jpa;
    private final PedidoRefRepository orders;
    private final JdbcTemplate jdbc;
    private final LookupTable statuses;
    private final LookupTable priorities;

    @PersistenceContext
    private EntityManager em;

    public JpaIncidentRepositoryAdapter(IncidenciaJpaRepository jpa, PedidoRefRepository orders, JdbcTemplate jdbc) {
        this.jpa = jpa;
        this.orders = orders;
        this.jdbc = jdbc;
        this.statuses = new LookupTable(jdbc, "estado_incidencia", "id_estado_incidencia", "nombre");
        this.priorities = new LookupTable(jdbc, "prioridad_incidencia", "id_prioridad", "nombre");
    }

    @Override
    public String nextIncidentNumber() {
        Long next = jdbc.queryForObject("select nextval('seq_codigo_incidencia')", Long.class);
        return String.format("INC-%06d", next);
    }

    @Override
    @Transactional
    public Incident save(Incident incident) {
        IncidenciaEntity entity = jpa.findByCode(incident.id())
                .map(existing -> apply(existing, incident))
                .orElseGet(() -> insert(incident));
        return toDomain(jpa.save(entity));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Incident> findById(String id) {
        return jpa.findByCode(id).map(this::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Incident> findNonTerminalByOrderId(String orderId) {
        List<Long> terminal = Arrays.stream(IncidentStatus.values())
                .filter(IncidentStatus::isTerminal)
                .map(statuses::idOf)
                .toList();
        return jpa.findOpenByOrderCode(orderId, terminal).stream().map(this::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Incident> search(IncidentSearchCriteria criteria, IncidentSort sort, PageRequest pageRequest) {
        CriteriaBuilder cb = em.getCriteriaBuilder();

        CriteriaQuery<Long> count = cb.createQuery(Long.class);
        Root<IncidenciaEntity> countRoot = count.from(IncidenciaEntity.class);
        count.select(cb.count(countRoot)).where(predicates(cb, countRoot, criteria));
        long total = em.createQuery(count).getSingleResult();

        CriteriaQuery<IncidenciaEntity> query = cb.createQuery(IncidenciaEntity.class);
        Root<IncidenciaEntity> root = query.from(IncidenciaEntity.class);
        query.select(root)
                .where(predicates(cb, root, criteria))
                .orderBy(
                        sort.descending()
                                ? List.of(cb.desc(root.get("createdAt")), cb.desc(root.get("code")))
                                : List.of(cb.asc(root.get("createdAt")), cb.asc(root.get("code"))));
        List<Incident> content = em.createQuery(query)
                .setFirstResult((int) pageRequest.offset())
                .setMaxResults(pageRequest.size())
                .getResultList()
                .stream()
                .map(this::toDomain)
                .toList();

        int totalPages = (int) ((total + pageRequest.size() - 1L) / pageRequest.size());
        return new Page<>(content, pageRequest.page(), pageRequest.size(), total, totalPages);
    }

    @Override
    @Transactional
    public boolean replaceIfCurrent(Incident expected, Incident updated) {
        Optional<IncidenciaEntity> locked = jpa.findByCodeForUpdate(expected.id());
        if (locked.isEmpty() || !toDomain(locked.get()).equals(expected)) {
            return false;
        }
        jpa.save(apply(locked.get(), updated));
        return true;
    }

    // ---------------------------------------------------------------------------------------------------------------

    private IncidenciaEntity insert(Incident incident) {
        PedidoRefEntity order = orders.findByCode(incident.orderId())
                .orElseThrow(() -> new IllegalStateException("Unknown order " + incident.orderId()));
        return new IncidenciaEntity(
                incident.id(),
                order,
                incident.customerId(),
                priorities.idOf(incident.priority()),
                statuses.idOf(incident.status()),
                incident.description(),
                incident.createdAt(),
                incident.resolution(),
                incident.resolvedAt(),
                incident.updatedAt());
    }

    private IncidenciaEntity apply(IncidenciaEntity entity, Incident incident) {
        entity.update(
                priorities.idOf(incident.priority()),
                statuses.idOf(incident.status()),
                incident.resolution(),
                incident.resolvedAt(),
                incident.updatedAt());
        return entity;
    }

    private Incident toDomain(IncidenciaEntity e) {
        return new Incident(
                e.getCode(),
                e.getOrder().getCode(),
                e.getCustomerId(),
                e.getDescription(),
                statuses.valueOf(IncidentStatus.class, e.getStatusId()),
                priorities.valueOf(IncidentPriority.class, e.getPriorityId()),
                e.getResolution(),
                e.getCreatedAt(),
                e.getUpdatedAt(),
                e.getResolvedAt());
    }

    private Predicate[] predicates(CriteriaBuilder cb, Root<IncidenciaEntity> root, IncidentSearchCriteria c) {
        List<Predicate> list = new ArrayList<>();
        if (c.customerId() != null) {
            list.add(cb.equal(root.get("customerId"), c.customerId()));
        }
        if (c.status() != null) {
            list.add(cb.equal(root.get("statusId"), statuses.idOf(c.status())));
        }
        if (c.priority() != null) {
            list.add(cb.equal(root.get("priorityId"), priorities.idOf(c.priority())));
        }
        if (c.from() != null) {
            list.add(cb.greaterThanOrEqualTo(root.<Instant>get("createdAt"), c.from()));
        }
        if (c.toExclusive() != null) {
            list.add(cb.lessThan(root.<Instant>get("createdAt"), c.toExclusive()));
        }
        if (c.q() != null && !c.q().isBlank()) {
            String needle = "%" + escapeLike(c.q().trim().toLowerCase(Locale.ROOT)) + "%";
            list.add(cb.like(cb.lower(root.<String>get("description")), needle, '\\'));
        }
        return list.toArray(Predicate[]::new);
    }

    private static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
