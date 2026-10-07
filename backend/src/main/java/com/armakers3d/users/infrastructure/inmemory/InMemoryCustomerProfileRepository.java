package com.armakers3d.users.infrastructure.inmemory;

import com.armakers3d.users.domain.CustomerProfile;
import com.armakers3d.users.repository.CustomerProfileRepository;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

/**
 * In-memory {@link CustomerProfileRepository}. NOT durable: profile data is lost on restart, in
 * EVERY profile (including the database-backed ones), because the profile columns need a Flyway
 * migration that this phase does not add. Selected by {@code app.persistence.users=memory}
 * (the default, backend-foundation.md section 11); the JPA adapter will flip the default. A
 * startup guard refuses to run this adapter under the {@code prod} profile. Records are immutable,
 * so no defensive copies are needed.
 */
@Repository
@ConditionalOnProperty(name = "app.persistence.users", havingValue = "memory", matchIfMissing = true)
public class InMemoryCustomerProfileRepository implements CustomerProfileRepository {

    private final Map<Long, CustomerProfile> byClienteId = new ConcurrentHashMap<>();

    @Override
    public Optional<CustomerProfile> findByClienteId(Long clienteId) {
        return Optional.ofNullable(byClienteId.get(clienteId));
    }

    @Override
    public CustomerProfile save(CustomerProfile profile) {
        byClienteId.put(profile.clienteId(), profile);
        return profile;
    }

    /** Test/dev helper; not part of the port. */
    public void clear() {
        byClienteId.clear();
    }
}
