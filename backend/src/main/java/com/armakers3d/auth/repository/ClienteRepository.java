package com.armakers3d.auth.repository;

import com.armakers3d.auth.domain.Cliente;
import java.util.List;
import java.util.Optional;

/**
 * Port for account persistence (backend-foundation.md section 10). Domain types and plain Java
 * only. Implemented by {@code infrastructure.jpa} (all database-backed profiles) and
 * {@code infrastructure.inmemory} (profile {@code nodb}). Ids are assigned by the adapter on
 * first save; email is always normalized to lower-case by the service layer before it is passed
 * in, and is unique.
 */
public interface ClienteRepository {

    /** Inserts when {@code cliente.getId()} is null, otherwise updates. Returns the stored account. */
    Cliente save(Cliente cliente);

    Optional<Cliente> findById(Long id);

    Optional<Cliente> findByEmail(String email);

    List<Cliente> findAll();
}
