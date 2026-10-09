package com.armakers3d.catalog.infrastructure.jpa;

import org.springframework.data.jpa.repository.JpaRepository;

/** Spring Data interface used only by {@link JpaProductRepositoryAdapter} (and test cleanup). */
public interface ProductJpaRepository extends JpaRepository<ProductEntity, Long> {
}
