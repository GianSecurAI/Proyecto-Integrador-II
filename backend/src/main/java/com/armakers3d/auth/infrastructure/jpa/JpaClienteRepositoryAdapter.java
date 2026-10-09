package com.armakers3d.auth.infrastructure.jpa;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.repository.ClienteRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

/** Database-backed {@link ClienteRepository}; active in every profile except {@code nodb}. */
@Repository
@Profile("!nodb")
public class JpaClienteRepositoryAdapter implements ClienteRepository {

    private final ClienteJpaRepository jpa;
    private final RolJpaRepository roles;

    public JpaClienteRepositoryAdapter(ClienteJpaRepository jpa, RolJpaRepository roles) {
        this.jpa = jpa;
        this.roles = roles;
    }

    @Override
    public Cliente save(Cliente cliente) {
        ClienteEntity saved =
                jpa.save(new ClienteEntity(
                        cliente.getId(),
                        cliente.getEmail(),
                        roles.findByNombre(cliente.getRol().name())
                                .orElseThrow(() -> new IllegalStateException("Unknown role: " + cliente.getRol())),
                        cliente.getCreatedAt(),
                        cliente.isActive()));
        return toDomain(saved);
    }

    @Override
    public Optional<Cliente> findById(Long id) {
        return jpa.findById(id).map(JpaClienteRepositoryAdapter::toDomain);
    }

    @Override
    public Optional<Cliente> findByEmail(String email) {
        return jpa.findByEmail(email).map(JpaClienteRepositoryAdapter::toDomain);
    }

    @Override
    public List<Cliente> findAll() {
        return jpa.findAll().stream().map(JpaClienteRepositoryAdapter::toDomain).toList();
    }

    private static Cliente toDomain(ClienteEntity e) {
        return new Cliente(e.getId(), e.getEmail(), e.getRol(), e.getCreatedAt(), e.isActive());
    }
}
