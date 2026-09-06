package com.armakers3d.auth.repository;

import com.armakers3d.auth.domain.Cliente;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClienteRepository extends JpaRepository<Cliente, Long> {

    /** Email is always normalized to lower-case by the service layer before this is called. */
    Optional<Cliente> findByEmail(String email);
}
