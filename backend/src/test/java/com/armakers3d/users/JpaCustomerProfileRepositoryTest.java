package com.armakers3d.users;

import static org.assertj.core.api.Assertions.assertThat;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.auth.repository.ClienteRepository;
import com.armakers3d.users.domain.CustomerProfile;
import com.armakers3d.users.repository.CustomerProfileRepository;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/** The customer profile lives in the usuario columns; saving it must never touch the role, e-mail or status. */
@SpringBootTest(properties = "app.persistence.users=jpa")
@ActiveProfiles("test")
@Transactional
class JpaCustomerProfileRepositoryTest {

    @Autowired CustomerProfileRepository profiles;
    @Autowired ClienteRepository accounts;

    private Long newAccount(String email) {
        return accounts.save(new com.armakers3d.auth.domain.Cliente(email, Instant.parse("2026-10-07T10:00:00Z"))).getId();
    }

    @Test
    void anAccountWithoutAProfileReadsAsEmptyColumns() {
        Long id = newAccount("profile-empty@example.test");

        assertThat(profiles.findByClienteId(id)).contains(CustomerProfile.empty(id));
    }

    @Test
    void saveStoresTheProfileAndReadsItBack() {
        Long id = newAccount("profile-save@example.test");

        profiles.save(new CustomerProfile(id, "Ana", "Quispe", "999888777"));

        assertThat(profiles.findByClienteId(id)).contains(new CustomerProfile(id, "Ana", "Quispe", "999888777"));
    }

    @Test
    void savingAProfileDoesNotChangeTheAccount() {
        Long id = newAccount("profile-intact@example.test");

        profiles.save(new CustomerProfile(id, "Luis", "Rojas", "911222333"));

        var account = accounts.findById(id).orElseThrow();
        assertThat(account.getEmail()).isEqualTo("profile-intact@example.test");
        assertThat(account.getRol()).isEqualTo(Rol.CLIENTE);
        assertThat(account.isActive()).isTrue();
    }

    @Test
    void anUnknownAccountHasNoProfile() {
        assertThat(profiles.findByClienteId(987654L)).isEmpty();
    }
}
