package com.armakers3d.auth;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.auth.infrastructure.inmemory.InMemoryClienteRepository;
import com.armakers3d.auth.service.FirstAdministratorBootstrap;
import com.armakers3d.auth.service.FirstAdministratorBootstrap.Outcome;
import com.armakers3d.testsupport.MutableClock;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

/** DB-04 rules, with the repository port (the JPA end-to-end sign-in is in {@code BootstrapAdministratorSignInTest}). */
class FirstAdministratorBootstrapTest {

    private final MutableClock clock = MutableClock.startingNow();
    private InMemoryClienteRepository clientes;
    private ListAppender<ILoggingEvent> auditLogs;
    private ListAppender<ILoggingEvent> classLogs;
    private Logger auditLogger;
    private Logger classLogger;

    @BeforeEach
    void setUp() {
        clientes = new InMemoryClienteRepository();
        auditLogger = (Logger) LoggerFactory.getLogger("com.armakers3d.audit.users");
        classLogger = (Logger) LoggerFactory.getLogger(FirstAdministratorBootstrap.class);
        auditLogs = new ListAppender<>();
        classLogs = new ListAppender<>();
        auditLogs.start();
        classLogs.start();
        auditLogger.addAppender(auditLogs);
        classLogger.addAppender(classLogs);
    }

    @AfterEach
    void tearDown() {
        auditLogger.detachAppender(auditLogs);
        classLogger.detachAppender(classLogs);
    }

    private FirstAdministratorBootstrap bootstrap(String email) {
        return new FirstAdministratorBootstrap(clientes, clock, email);
    }

    private List<String> audit() {
        return auditLogs.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
    }

    @Test
    void emptyStoreAndVariableCreatesAnActiveAdministratorWithOneMaskedAuditLine() {
        Outcome outcome = bootstrap("  Owner@Example.TEST ").bootstrap();

        assertThat(outcome).isEqualTo(Outcome.CREATED);
        Cliente admin = clientes.findByEmail("owner@example.test").orElseThrow();
        assertThat(admin.getRol()).isEqualTo(Rol.ADMINISTRADOR);
        assertThat(admin.isActive()).isTrue();
        assertThat(audit()).hasSize(1);
        assertThat(audit().get(0)).startsWith("admin.bootstrap ").contains("o***@example.test").contains("outcome=created");
        assertThat(audit().get(0)).doesNotContain("owner@example.test");
    }

    @Test
    void anExistingActiveAdministratorMakesItANoOpAndTheVariableIsIgnored() {
        clientes.save(Cliente.provisioned("boss@example.test", Rol.ADMINISTRADOR, clock.instant()));

        Outcome outcome = bootstrap("other@example.test").bootstrap();

        assertThat(outcome).isEqualTo(Outcome.ALREADY_PRESENT);
        assertThat(clientes.findByEmail("other@example.test")).isEmpty();
        assertThat(clientes.findAll()).hasSize(1);
        assertThat(audit()).isEmpty();
    }

    @Test
    void variableUnsetOrBlankOnlyWarns() {
        assertThat(bootstrap("").bootstrap()).isEqualTo(Outcome.NOT_CONFIGURED);
        assertThat(bootstrap(null).bootstrap()).isEqualTo(Outcome.NOT_CONFIGURED);
        assertThat(bootstrap("   ").bootstrap()).isEqualTo(Outcome.NOT_CONFIGURED);

        assertThat(clientes.findAll()).isEmpty();
        assertThat(audit()).isEmpty();
        assertThat(classLogs.list).hasSize(3).allSatisfy(e -> assertThat(e.getLevel()).isEqualTo(Level.WARN));
    }

    @Test
    void anExistingCustomerAccountWithThatEmailIsPromoted() {
        Cliente customer = clientes.save(new Cliente("promote@example.test", clock.instant()));

        Outcome outcome = bootstrap("promote@example.test").bootstrap();

        assertThat(outcome).isEqualTo(Outcome.PROMOTED);
        Cliente promoted = clientes.findById(customer.getId()).orElseThrow();
        assertThat(promoted.getRol()).isEqualTo(Rol.ADMINISTRADOR);
        assertThat(promoted.isActive()).isTrue();
        assertThat(clientes.findAll()).hasSize(1);
        assertThat(audit()).hasSize(1);
        assertThat(audit().get(0)).contains("outcome=promoted").doesNotContain("promote@example.test");
    }

    @Test
    void aDeactivatedAccountWithThatEmailIsReactivatedAndPromotedWhenNoActiveAdminExists() {
        Cliente old = clientes.save(Cliente.provisioned("former@example.test", Rol.ADMINISTRADOR, clock.instant()).withActive(false));
        // withActive on an unsaved account keeps id null; save a deactivated admin explicitly
        assertThat(old.isActive()).isFalse();

        assertThat(bootstrap("former@example.test").bootstrap()).isEqualTo(Outcome.PROMOTED);

        assertThat(clientes.findByEmail("former@example.test").orElseThrow().isActive()).isTrue();
    }

    @Test
    void reRunningIsIdempotent() {
        FirstAdministratorBootstrap job = bootstrap("again@example.test");

        assertThat(job.bootstrap()).isEqualTo(Outcome.CREATED);
        assertThat(job.bootstrap()).isEqualTo(Outcome.ALREADY_PRESENT);
        assertThat(job.bootstrap()).isEqualTo(Outcome.ALREADY_PRESENT);

        assertThat(clientes.findAll()).hasSize(1);
        assertThat(audit()).hasSize(1);
    }

    @Test
    void anInvalidAddressCreatesNothingAndIsNotEchoed() {
        assertThat(bootstrap("not-an-email").bootstrap()).isEqualTo(Outcome.INVALID_EMAIL);

        assertThat(clientes.findAll()).isEmpty();
        assertThat(classLogs.list).hasSize(1);
        assertThat(classLogs.list.get(0).getFormattedMessage()).doesNotContain("not-an-email");
    }

    @Test
    void runViaCommandLineRunnerDelegates() {
        bootstrap("runner@example.test").run();

        assertThat(clientes.findByEmail("runner@example.test")).isPresent();
    }
}
