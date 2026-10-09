package com.armakers3d.incidents;

import com.armakers3d.incidents.repository.IncidentRepository;
import com.armakers3d.shared.persistence.JpaTestData;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/** Runs the shared port contract against the PostgreSQL adapter (H2 in PostgreSQL mode, Flyway-migrated). */
@SpringBootTest(properties = "app.persistence.incidents=jpa")
@ActiveProfiles("test")
class JpaIncidentRepositoryTest extends IncidentRepositoryContractTest {

    @Autowired IncidentRepository repository;
    @Autowired JdbcTemplate jdbc;

    @Override
    protected IncidentRepository createRepository() {
        JpaTestData.seed(jdbc);
        JpaTestData.seedOrder(jdbc, "PED-000001", 1L);
        JpaTestData.seedOrder(jdbc, "PED-000002", 2L);
        return repository;
    }

    @AfterEach
    void cleanUp() {
        JpaTestData.reset(jdbc);
    }
}
