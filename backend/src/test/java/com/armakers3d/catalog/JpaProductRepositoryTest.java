package com.armakers3d.catalog;

import com.armakers3d.catalog.infrastructure.jpa.ProductJpaRepository;
import com.armakers3d.catalog.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/** Runs the shared port contract against the PostgreSQL adapter (H2 in PostgreSQL mode, Flyway-migrated). */
@SpringBootTest(properties = "app.persistence.catalog=jpa")
@ActiveProfiles("test")
class JpaProductRepositoryTest extends ProductRepositoryContractTest {

    @Autowired ProductRepository repository;
    @Autowired ProductJpaRepository jpa;

    @Override
    protected ProductRepository createRepository() {
        jpa.deleteAll();
        return repository;
    }
}
