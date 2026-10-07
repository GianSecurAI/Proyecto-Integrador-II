package com.armakers3d.users.repository;

import com.armakers3d.users.domain.CustomerProfile;
import java.util.Optional;

/**
 * Port for customer profile persistence (backend-foundation.md section 10). One row per account;
 * {@code save} inserts or overwrites by {@code clienteId}. Today the only adapter is in-memory
 * (see {@code users.infrastructure.inmemory}); the JPA adapter arrives with the DB phase and its
 * Flyway migration, with zero change to callers.
 */
public interface CustomerProfileRepository {

    Optional<CustomerProfile> findByClienteId(Long clienteId);

    CustomerProfile save(CustomerProfile profile);
}
