package com.armakers3d.users;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.armakers3d.auth.config.SessionProperties;
import com.armakers3d.auth.domain.AuthenticatedSession;
import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.auth.infrastructure.inmemory.InMemoryAuthenticatedSessionRepository;
import com.armakers3d.auth.infrastructure.inmemory.InMemoryClienteRepository;
import com.armakers3d.auth.service.SessionService;
import com.armakers3d.shared.error.ApiException;
import com.armakers3d.shared.error.MalformedRequestException;
import com.armakers3d.shared.error.NotFoundException;
import com.armakers3d.shared.pagination.PageRequest;
import com.armakers3d.testsupport.MutableClock;
import com.armakers3d.users.service.UserAdminService;
import com.armakers3d.users.service.UserAdminService.UserFilter;
import com.armakers3d.users.service.exception.LastAdministratorException;
import com.armakers3d.users.service.exception.SelfModificationNotAllowedException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

/**
 * Service-level rules of the user administration use cases, on the in-memory adapters with no
 * Spring context: last-administrator protection, self-lockout, session revocation, filtering and
 * the audit trail. The service does not look at the actor role (the central matrix does), which is
 * what lets these tests reach the last-administrator rule with a non-administrator actor id.
 */
class UserAdminServiceTest {

    private static final Long NOBODY = 9_999L;

    private InMemoryClienteRepository clientes;
    private InMemoryAuthenticatedSessionRepository sessions;
    private MutableClock clock;
    private SessionService sessionService;
    private UserAdminService service;
    private ListAppender<ILoggingEvent> auditLog;
    private Logger auditLogger;

    @BeforeEach
    void setUp() {
        clientes = new InMemoryClienteRepository();
        sessions = new InMemoryAuthenticatedSessionRepository();
        clock = MutableClock.startingNow();
        sessionService = new SessionService(sessions, clientes, clock, new SessionProperties());
        service = new UserAdminService(clientes, sessionService, clock);
        auditLogger = (Logger) LoggerFactory.getLogger("com.armakers3d.audit.users");
        auditLog = new ListAppender<>();
        auditLog.start();
        auditLogger.addAppender(auditLog);
    }

    @AfterEach
    void tearDown() {
        auditLogger.detachAppender(auditLog);
    }

    private Cliente account(String email, Rol rol) {
        return clientes.save(Cliente.provisioned(email, rol, clock.instant()));
    }

    private List<String> auditMessages() {
        return auditLog.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
    }

    @Test
    void theLastActiveAdministratorCannotBeDemoted() {
        Cliente onlyAdmin = account("root@example.test", Rol.ADMINISTRADOR);

        assertThatThrownBy(() -> service.changeRole(NOBODY, onlyAdmin.getId(), Rol.ASESOR))
                .isInstanceOf(LastAdministratorException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo("LAST_ADMINISTRATOR");
        assertThat(clientes.findById(onlyAdmin.getId()).orElseThrow().getRol()).isEqualTo(Rol.ADMINISTRADOR);
    }

    @Test
    void theLastActiveAdministratorCannotBeDeactivated() {
        Cliente onlyAdmin = account("root@example.test", Rol.ADMINISTRADOR);
        account("advisor@example.test", Rol.ASESOR);

        assertThatThrownBy(() -> service.setActive(NOBODY, onlyAdmin.getId(), false))
                .isInstanceOf(LastAdministratorException.class);
        assertThat(clientes.findById(onlyAdmin.getId()).orElseThrow().isActive()).isTrue();
    }

    @Test
    void anInactiveAdministratorDoesNotCountAsRemainingSoTheOnlyActiveOneIsProtected() {
        Cliente active = account("a@example.test", Rol.ADMINISTRADOR);
        Cliente inactive = account("b@example.test", Rol.ADMINISTRADOR);
        service.setActive(active.getId(), inactive.getId(), false); // two active admins -> allowed

        assertThatThrownBy(() -> service.setActive(NOBODY, active.getId(), false)).isInstanceOf(LastAdministratorException.class);
        assertThatThrownBy(() -> service.changeRole(NOBODY, active.getId(), Rol.CLIENTE)).isInstanceOf(LastAdministratorException.class);
    }

    @Test
    void withTwoActiveAdministratorsOneMayDemoteTheOtherButThenTheSurvivorIsProtected() {
        Cliente a = account("a@example.test", Rol.ADMINISTRADOR);
        Cliente b = account("b@example.test", Rol.ADMINISTRADOR);

        service.changeRole(a.getId(), b.getId(), Rol.ASESOR);

        assertThatThrownBy(() -> service.changeRole(b.getId(), a.getId(), Rol.ASESOR))
                .isInstanceOf(LastAdministratorException.class);
        assertThatThrownBy(() -> service.setActive(b.getId(), a.getId(), false)).isInstanceOf(LastAdministratorException.class);
    }

    @Test
    void selfDemotionAndSelfDeactivationAreRefusedEvenWhenAnotherAdministratorExists() {
        Cliente a = account("a@example.test", Rol.ADMINISTRADOR);
        account("b@example.test", Rol.ADMINISTRADOR);

        assertThatThrownBy(() -> service.changeRole(a.getId(), a.getId(), Rol.CLIENTE))
                .isInstanceOf(SelfModificationNotAllowedException.class);
        assertThatThrownBy(() -> service.setActive(a.getId(), a.getId(), false))
                .isInstanceOf(SelfModificationNotAllowedException.class);
    }

    @Test
    void roleChangeAndDeactivationRevokeEverySessionOfTheTargetOnly() {
        Cliente admin = account("admin@example.test", Rol.ADMINISTRADOR);
        Cliente target = account("target@example.test", Rol.CLIENTE);
        Cliente bystander = account("bystander@example.test", Rol.CLIENTE);
        Instant now = clock.instant();
        for (String token : List.of("t1", "t2")) {
            sessions.save(new AuthenticatedSession(SessionService.storageKey(token), target.getId(), Rol.CLIENTE, now, now.plus(Duration.ofHours(1))));
        }
        sessions.save(new AuthenticatedSession(SessionService.storageKey("b1"), bystander.getId(), Rol.CLIENTE, now, now.plus(Duration.ofHours(1))));

        service.changeRole(admin.getId(), target.getId(), Rol.ASESOR);
        assertThat(sessionService.authenticate("t1")).isEmpty();
        assertThat(sessionService.authenticate("t2")).isEmpty();
        assertThat(sessionService.authenticate("b1")).isPresent();

        sessions.save(new AuthenticatedSession(SessionService.storageKey("t3"), target.getId(), Rol.ASESOR, now, now.plus(Duration.ofHours(1))));
        service.setActive(admin.getId(), target.getId(), false);
        assertThat(sessionService.authenticate("t3")).isEmpty();
    }

    @Test
    void noOpChangesDoNotRevokeSessionsOrWriteAuditLines() {
        Cliente admin = account("admin@example.test", Rol.ADMINISTRADOR);
        Cliente target = account("target@example.test", Rol.ASESOR);
        Instant now = clock.instant();
        sessions.save(new AuthenticatedSession(SessionService.storageKey("keep"), target.getId(), Rol.ASESOR, now, now.plus(Duration.ofHours(1))));

        service.changeRole(admin.getId(), target.getId(), Rol.ASESOR);
        service.setActive(admin.getId(), target.getId(), true);

        assertThat(sessionService.authenticate("keep")).isPresent();
        assertThat(auditMessages()).isEmpty();
    }

    @Test
    void everyMutationIsAuditLoggedWithIdsOnlyAndNeverTheFullEmail() {
        Cliente admin = account("admin@example.test", Rol.ADMINISTRADOR);
        Cliente created = service.createStaff(admin.getId(), "  New.Person@Example.TEST ", Rol.ASESOR);
        service.changeRole(admin.getId(), created.getId(), Rol.ADMINISTRADOR);
        service.setActive(admin.getId(), created.getId(), false);

        List<String> messages = auditMessages();
        assertThat(messages).hasSize(3);
        assertThat(messages.get(0)).contains("admin.user.created", "actor=" + admin.getId(), "target=" + created.getId(), "role=ASESOR");
        assertThat(messages.get(1)).contains("admin.user.role_changed", "from=ASESOR", "to=ADMINISTRADOR");
        assertThat(messages.get(2)).contains("admin.user.active_changed", "from=true", "to=false");
        assertThat(String.join("\n", messages)).doesNotContain("new.person@example.test").contains("n***@example.test");
    }

    @Test
    void createNormalizesEmailRejectsDuplicatesAndCustomerRole() {
        Cliente admin = account("admin@example.test", Rol.ADMINISTRADOR);

        Cliente created = service.createStaff(admin.getId(), "  Staff@Example.TEST ", Rol.ASESOR);

        assertThat(created.getEmail()).isEqualTo("staff@example.test");
        assertThat(created.isActive()).isTrue();
        assertThatThrownBy(() -> service.createStaff(admin.getId(), "STAFF@example.test", Rol.ADMINISTRADOR))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo("CONFLICT");
        assertThatThrownBy(() -> service.createStaff(admin.getId(), "c@example.test", Rol.CLIENTE))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo("VALIDATION_FAILED");
    }

    @Test
    void listFiltersSortsAndPaginates() {
        account("b-advisor@example.test", Rol.ASESOR);
        account("a-advisor@example.test", Rol.ASESOR);
        Cliente inactive = account("c-advisor@example.test", Rol.ASESOR);
        clientes.save(inactive.withActive(false));
        account("customer@example.test", Rol.CLIENTE);

        var activeAdvisors = service.list(new UserFilter("ADVISOR", Rol.ASESOR, true), new PageRequest(0, 10), "email,asc");
        assertThat(activeAdvisors.content()).extracting(Cliente::getEmail)
                .containsExactly("a-advisor@example.test", "b-advisor@example.test");
        assertThat(activeAdvisors.totalElements()).isEqualTo(2);

        var secondPage = service.list(new UserFilter(null, null, null), new PageRequest(1, 3), "email,desc");
        assertThat(secondPage.content()).hasSize(1);
        assertThat(secondPage.totalElements()).isEqualTo(4);
        assertThat(secondPage.totalPages()).isEqualTo(2);

        assertThat(service.list(new UserFilter(null, null, null), new PageRequest(5, 3), null).content()).isEmpty();
        assertThatThrownBy(() -> service.list(new UserFilter(null, null, null), new PageRequest(0, 3), "rol"))
                .isInstanceOf(MalformedRequestException.class);
        assertThatThrownBy(() -> service.list(new UserFilter(null, null, null), new PageRequest(0, 3), "email,sideways"))
                .isInstanceOf(MalformedRequestException.class);
    }

    @Test
    void unknownTargetIsNotFound() {
        assertThatThrownBy(() -> service.get(42L)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.changeRole(NOBODY, 42L, Rol.ASESOR)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.setActive(NOBODY, 42L, false)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void authenticateTakesTheRoleFromTheLiveRecordAndRequiresAnActiveAccount() {
        Cliente c = account("live@example.test", Rol.ADMINISTRADOR);
        Instant now = clock.instant();
        sessions.save(new AuthenticatedSession(SessionService.storageKey("live"), c.getId(), Rol.ADMINISTRADOR, now, now.plus(Duration.ofHours(1))));

        clientes.save(c.withRol(Rol.CLIENTE));
        assertThat(sessionService.authenticate("live")).get().extracting(Cliente::getRol).isEqualTo(Rol.CLIENTE);

        clientes.save(clientes.findById(c.getId()).orElseThrow().withActive(false));
        assertThat(sessionService.authenticate("live")).isEmpty();
        assertThat(sessionService.authenticate("unknown")).isEmpty();
        assertThat(sessionService.authenticate(null)).isEmpty();
    }
}
