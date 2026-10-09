package com.armakers3d.users.infrastructure.jpa;

import com.armakers3d.users.domain.CustomerProfile;
import com.armakers3d.users.repository.CustomerProfileRepository;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * PostgreSQL-backed {@link CustomerProfileRepository}: the profile lives in the {@code usuario} columns
 * nombres, apellidos and telefono. Selected by {@code app.persistence.users=jpa}.
 */
@Repository
@ConditionalOnProperty(name = "app.persistence.users", havingValue = "jpa")
public class JpaCustomerProfileRepositoryAdapter implements CustomerProfileRepository {

    private final CustomerProfileJpaRepository jpa;

    public JpaCustomerProfileRepositoryAdapter(CustomerProfileJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CustomerProfile> findByClienteId(Long clienteId) {
        return jpa.findById(clienteId).map(JpaCustomerProfileRepositoryAdapter::toDomain);
    }

    @Override
    @Transactional
    public CustomerProfile save(CustomerProfile profile) {
        CustomerProfileEntity entity = jpa.findById(profile.clienteId())
                .orElseThrow(() -> new IllegalStateException("No account for profile " + profile.clienteId()));
        entity.update(profile.firstName(), profile.lastName(), profile.phone());
        return toDomain(jpa.save(entity));
    }

    private static CustomerProfile toDomain(CustomerProfileEntity e) {
        return new CustomerProfile(e.getId(), e.getFirstName(), e.getLastName(), e.getPhone());
    }
}
