package com.armakers3d.shared.persistence;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Lookup of an order row by its public code, for modules that reference orders by foreign key. */
public interface PedidoRefRepository extends JpaRepository<PedidoRefEntity, Long> {

    Optional<PedidoRefEntity> findByCode(String code);
}
