package com.armakers3d.auth.infrastructure.inmemory;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.repository.ClienteRepository;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

/**
 * In-memory {@link ClienteRepository} for the {@code nodb} profile only (backend-foundation.md
 * section 11). Not for production: data is lost on restart. Thread-safe; {@link Cliente} is
 * immutable so no defensive copies are needed. Mirrors the JPA adapter's unique-email rule.
 */
@Repository
@Profile("nodb")
public class InMemoryClienteRepository implements ClienteRepository {

    private final Map<Long, Cliente> byId = new ConcurrentHashMap<>();
    private final AtomicLong ids = new AtomicLong();

    @Override
    public synchronized Cliente save(Cliente cliente) {
        boolean emailTakenByOther =
                byId.values().stream()
                        .anyMatch(c -> c.getEmail().equals(cliente.getEmail())
                                && !c.getId().equals(cliente.getId()));
        if (emailTakenByOther) {
            throw new IllegalStateException("Unique constraint violated: cliente.email");
        }
        long id = cliente.getId() != null ? cliente.getId() : ids.incrementAndGet();
        Cliente stored =
                new Cliente(id, cliente.getEmail(), cliente.getRol(), cliente.getCreatedAt(), cliente.isActive());
        byId.put(id, stored);
        return stored;
    }

    @Override
    public Optional<Cliente> findById(Long id) {
        return Optional.ofNullable(byId.get(id));
    }

    @Override
    public Optional<Cliente> findByEmail(String email) {
        return byId.values().stream().filter(c -> c.getEmail().equals(email)).findFirst();
    }

    @Override
    public List<Cliente> findAll() {
        return byId.values().stream().sorted(Comparator.comparing(Cliente::getId)).toList();
    }

    /** Test/dev helper; not part of the port. */
    public void clear() {
        byId.clear();
    }
}
