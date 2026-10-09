package com.armakers3d.orders;

import com.armakers3d.orders.repository.OrderRepository;
import com.armakers3d.shared.persistence.JpaTestData;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/** Runs the shared port contract against the PostgreSQL adapter (H2 in PostgreSQL mode, Flyway-migrated). */
@SpringBootTest(properties = "app.persistence.orders=jpa")
@ActiveProfiles("test")
class JpaOrderRepositoryTest extends OrderRepositoryContractTest {

    @Autowired OrderRepository repository;
    @Autowired JdbcTemplate jdbc;

    @Override
    protected OrderRepository createRepository() {
        JpaTestData.seed(jdbc);
        return repository;
    }

    @AfterEach
    void cleanUp() {
        JpaTestData.reset(jdbc);
    }
}
