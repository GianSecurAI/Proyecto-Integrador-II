package com.armakers3d.auth.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.Rol;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/**
 * Behavior every {@link ClienteRepository} adapter must share (run against the JPA and the
 * in-memory adapter). ASESOR is intentionally not used: the V1 check constraint does not allow it
 * yet, so only the in-memory adapter could store it.
 */
abstract class ClienteRepositoryContract {

    private static final Instant T0 = Instant.parse("2026-01-01T10:00:00Z");

    protected abstract ClienteRepository repository();

    @Test
    void saveAssignsIdAndRoundTripsAllFields() {
        Cliente saved = repository().save(Cliente.provisioned("contract-admin@example.test", Rol.ADMINISTRADOR, T0));

        assertThat(saved.getId()).isNotNull();
        Cliente found = repository().findById(saved.getId()).orElseThrow();
        assertThat(found.getEmail()).isEqualTo("contract-admin@example.test");
        assertThat(found.getRol()).isEqualTo(Rol.ADMINISTRADOR);
        assertThat(found.getCreatedAt()).isEqualTo(T0);
        assertThat(found.isActive()).isTrue();
    }

    @Test
    void selfRegisteredAccountIsAlwaysCliente() {
        Cliente saved = repository().save(new Cliente("contract-customer@example.test", T0));

        assertThat(repository().findByEmail("contract-customer@example.test").orElseThrow().getRol())
                .isEqualTo(Rol.CLIENTE);
        assertThat(saved.getRol()).isEqualTo(Rol.CLIENTE);
    }

    @Test
    void findByEmailIsExactAndAbsentIsEmpty() {
        repository().save(new Cliente("contract-a@example.test", T0));

        assertThat(repository().findByEmail("contract-a@example.test")).isPresent();
        assertThat(repository().findByEmail("contract-missing@example.test")).isEmpty();
        assertThat(repository().findById(Long.MAX_VALUE)).isEmpty();
    }

    @Test
    void saveWithExistingIdUpdatesInsteadOfInserting() {
        Cliente first = repository().save(new Cliente("contract-update@example.test", T0));
        int before = repository().findAll().size();

        repository().save(new Cliente(first.getId(), first.getEmail(), Rol.CLIENTE, T0, false));

        assertThat(repository().findAll()).hasSize(before);
        assertThat(repository().findById(first.getId()).orElseThrow().isActive()).isFalse();
    }

    @Test
    void duplicateEmailIsRejected() {
        repository().save(new Cliente("contract-dup@example.test", T0));

        assertThatThrownBy(() -> repository().save(new Cliente("contract-dup@example.test", T0)))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void findAllReturnsEverySavedAccount() {
        Cliente a = repository().save(new Cliente("contract-all-a@example.test", T0));
        Cliente b = repository().save(new Cliente("contract-all-b@example.test", T0));

        assertThat(repository().findAll()).extracting(Cliente::getId).contains(a.getId(), b.getId());
    }
}
