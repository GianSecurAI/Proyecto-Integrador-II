package com.armakers3d.auth.infrastructure.inmemory;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.auth.repository.ClienteRepository;
import java.time.Clock;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Provisions one advisor and one administrator in the in-memory store so staff flows can be
 * exercised without a database. Active ONLY under the {@code nodb} profile (never in default,
 * local, test or production profiles) and only for emails explicitly configured through
 * {@code auth.dev-seed.*}. Staff authenticate with the same email OTP as customers; there are no
 * passwords. In real environments staff accounts are provisioned out of band, not self-registered.
 */
@Component
@Profile("nodb")
public class AuthDevSeed implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(AuthDevSeed.class);

    private final ClienteRepository clienteRepository;
    private final AuthDevSeedProperties properties;
    private final Clock clock;

    public AuthDevSeed(ClienteRepository clienteRepository, AuthDevSeedProperties properties, Clock clock) {
        this.clienteRepository = clienteRepository;
        this.properties = properties;
        this.clock = clock;
    }

    @Override
    public void run(String... args) {
        seed(properties.getAdvisorEmail(), Rol.ASESOR);
        seed(properties.getAdminEmail(), Rol.ADMINISTRADOR);
    }

    private void seed(String rawEmail, Rol rol) {
        if (rawEmail == null || rawEmail.isBlank()) {
            return;
        }
        String email = rawEmail.trim().toLowerCase(Locale.ROOT);
        if (clienteRepository.findByEmail(email).isEmpty()) {
            clienteRepository.save(Cliente.provisioned(email, rol, clock.instant()));
            log.info("auth.devseed.provisioned rol={}", rol);
        }
    }
}
