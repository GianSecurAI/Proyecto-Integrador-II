package com.armakers3d.users.infrastructure.jpa;

import org.springframework.data.jpa.repository.JpaRepository;

/** Spring Data interface used only by {@link JpaCustomerProfileRepositoryAdapter}. */
public interface CustomerProfileJpaRepository extends JpaRepository<CustomerProfileEntity, Long> {
}
