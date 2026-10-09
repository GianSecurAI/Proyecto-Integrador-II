package com.armakers3d.auth.infrastructure.jpa;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Spring Data interface used only by {@link JpaClienteRepositoryAdapter} to resolve the {@code rol} row of an account. */
public interface RolJpaRepository extends JpaRepository<RolEntity, Long> {

    Optional<RolEntity> findByNombre(String nombre);
}
