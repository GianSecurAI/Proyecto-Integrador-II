package com.armakers3d.auth.service;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.auth.repository.ClienteRepository;
import com.armakers3d.shared.util.EmailAddress;
import java.time.Clock;
import java.util.Optional;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * First administrator on a real database (DB-04, ADR-004 5.4, D-15). Runs at startup in every profile except
 * {@code nodb} (which has its own dev seed). Rules, in order:
 * <ol>
 *   <li>an ACTIVE administrator already exists: do nothing (INFO; the variable is ignored);
 *   <li>otherwise, {@code BOOTSTRAP_ADMIN_EMAIL} set: create that account as an active ADMINISTRADOR, or promote
 *       (and re-activate) the existing account with that email; audit {@code admin.bootstrap} with the MASKED email;
 *   <li>otherwise: WARN that no administrator exists.
 * </ol>
 * Idempotent (a second run finds the administrator and does nothing). The variable holds an email address, never a
 * secret; the person then signs in with the normal email OTP. An invalid address is logged as an error (never echoed)
 * and does not stop the application.
 */
@Component
@Profile("!nodb")
public class FirstAdministratorBootstrap implements CommandLineRunner {

    /** Outcome, for tests. */
    public enum Outcome { ALREADY_PRESENT, CREATED, PROMOTED, NOT_CONFIGURED, INVALID_EMAIL }

    private static final Logger log = LoggerFactory.getLogger(FirstAdministratorBootstrap.class);
    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.users");
    private static final Pattern SIMPLE_EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final ClienteRepository clienteRepository;
    private final Clock clock;
    private final String configuredEmail;

    public FirstAdministratorBootstrap(
            ClienteRepository clienteRepository, Clock clock, @Value("${bootstrap.admin-email:}") String configuredEmail) {
        this.clienteRepository = clienteRepository;
        this.clock = clock;
        this.configuredEmail = configuredEmail;
    }

    @Override
    public void run(String... args) {
        bootstrap();
    }

    public Outcome bootstrap() {
        boolean activeAdminExists = clienteRepository.findAll().stream()
                .anyMatch(c -> c.getRol() == Rol.ADMINISTRADOR && c.isActive());
        if (activeAdminExists) {
            log.info("admin.bootstrap.skipped reason=administrator-exists");
            return Outcome.ALREADY_PRESENT;
        }
        if (configuredEmail == null || configuredEmail.isBlank()) {
            log.warn("admin.bootstrap.none No active administrator exists and BOOTSTRAP_ADMIN_EMAIL is not set;"
                    + " nobody can manage users until one is configured.");
            return Outcome.NOT_CONFIGURED;
        }
        String email = EmailAddress.normalize(configuredEmail);
        if (!SIMPLE_EMAIL.matcher(email).matches() || email.length() > 255) {
            log.error("admin.bootstrap.invalid BOOTSTRAP_ADMIN_EMAIL is not a valid email address; no account was created.");
            return Outcome.INVALID_EMAIL;
        }
        Optional<Cliente> existing = clienteRepository.findByEmail(email);
        if (existing.isPresent()) {
            Cliente promoted = clienteRepository.save(existing.get().withRol(Rol.ADMINISTRADOR).withActive(true));
            audit.info("admin.bootstrap target={} outcome=promoted email={}", promoted.getId(), EmailAddress.mask(email));
            return Outcome.PROMOTED;
        }
        Cliente created = clienteRepository.save(Cliente.provisioned(email, Rol.ADMINISTRADOR, clock.instant()));
        audit.info("admin.bootstrap target={} outcome=created email={}", created.getId(), EmailAddress.mask(email));
        return Outcome.CREATED;
    }
}
