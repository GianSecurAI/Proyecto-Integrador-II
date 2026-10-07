package com.armakers3d.auth.repository;

import com.armakers3d.auth.domain.Cliente;
import java.time.Instant;
import org.junit.jupiter.api.Nested;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * Runs the shared adapter contracts against the JPA adapters on H2 (Flyway-migrated). Each test
 * runs in a transaction that is rolled back, so tests are isolated without manual cleanup.
 */
@SpringBootTest
@ActiveProfiles("test")
class JpaAdaptersContractTest {

    @Autowired ClienteRepository clienteRepository;
    @Autowired CodigoOtpRepository codigoOtpRepository;
    @Autowired AuthenticatedSessionRepository sessionRepository;

    @Nested
    @Transactional
    class ClienteContract extends ClienteRepositoryContract {
        @Override
        protected ClienteRepository repository() {
            return clienteRepository;
        }
    }

    @Nested
    @Transactional
    class CodigoOtpContract extends CodigoOtpRepositoryContract {
        @Override
        protected CodigoOtpRepository repository() {
            return codigoOtpRepository;
        }
    }

    @Nested
    @Transactional
    class SessionContract extends AuthenticatedSessionRepositoryContract {
        @Override
        protected AuthenticatedSessionRepository repository() {
            return sessionRepository;
        }

        @Override
        protected Long existingClienteId() {
            String email = "session-owner-" + System.nanoTime() + "@example.test";
            return clienteRepository.save(new Cliente(email, Instant.parse("2026-01-01T10:00:00Z"))).getId();
        }
    }
}
