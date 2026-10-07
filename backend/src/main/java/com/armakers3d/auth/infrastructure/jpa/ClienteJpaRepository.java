package com.armakers3d.auth.infrastructure.jpa;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Spring Data interface used only by {@link JpaClienteRepositoryAdapter} (and test cleanup). */
public interface ClienteJpaRepository extends JpaRepository<ClienteEntity, Long> {

    Optional<ClienteEntity> findByEmail(String email);
}
