package com.armakers3d.users.service;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.auth.repository.ClienteRepository;
import com.armakers3d.auth.service.SessionService;
import com.armakers3d.shared.error.ConflictException;
import com.armakers3d.shared.error.MalformedRequestException;
import com.armakers3d.shared.error.NotFoundException;
import com.armakers3d.shared.error.ValidationFailedException;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import com.armakers3d.shared.util.EmailAddress;
import com.armakers3d.users.service.exception.LastAdministratorException;
import com.armakers3d.users.service.exception.SelfModificationNotAllowedException;
import java.time.Clock;
import java.util.Comparator;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Administrator user management (contract review E14-E17 plus staff provisioning). This is the
 * single place for the safety rules: nobody may change their own role or deactivate themselves,
 * the last ACTIVE administrator can never be demoted or deactivated, and any role change or
 * deactivation revokes the target's sessions. Every mutation is audit-logged with ids only
 * (email masked on creation), never personal data (RNF-15, Principles XIII/XVIII).
 *
 * <p>Who may call this (ADMINISTRADOR only) is decided centrally by the role matrix, not here.
 * Mutations are serialized with a lock held OUTSIDE any transaction (the mutating methods are deliberately
 * not {@code @Transactional}, see {@code UserAdminLockingTest}) so two concurrent requests cannot each pass the
 * last-administrator check; that is sufficient for a single-instance deployment and must become a
 * database-level guard (row lock / constraint) when persistence moves to a shared database with
 * several instances.
 */
@Service
public class UserAdminService {

    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.users");

    private static final Map<String, Comparator<Cliente>> SORTABLE = Map.of(
            "createdAt", Comparator.comparing(Cliente::getCreatedAt),
            "email", Comparator.comparing(Cliente::getEmail));

    /** Search criteria; every field is optional (absent = no filter). */
    public record UserFilter(String q, Rol role, Boolean active) {}

    private final ClienteRepository clienteRepository;
    private final SessionService sessionService;
    private final Clock clock;
    private final Object mutationLock = new Object();

    public UserAdminService(ClienteRepository clienteRepository, SessionService sessionService, Clock clock) {
        this.clienteRepository = clienteRepository;
        this.sessionService = sessionService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Page<Cliente> list(UserFilter filter, PageRequest pageRequest, String sort) {
        Comparator<Cliente> comparator = parseSort(sort);
        String needle = filter.q() == null || filter.q().isBlank() ? null : filter.q().trim().toLowerCase(Locale.ROOT);
        var matching = clienteRepository.findAll().stream()
                .filter(c -> needle == null || c.getEmail().contains(needle))
                .filter(c -> filter.role() == null || c.getRol() == filter.role())
                .filter(c -> filter.active() == null || c.isActive() == filter.active())
                .sorted(comparator.thenComparing(Cliente::getId))
                .toList();
        return Page.of(matching, pageRequest);
    }

    @Transactional(readOnly = true)
    public Cliente get(Long id) {
        return load(id);
    }

    /** Provisions a staff account (ASESOR or ADMINISTRADOR); the person then signs in with the email OTP. */
    // NOT @Transactional (security review, last-admin TOCTOU): the mutation lock below must be released only
    // after the write is committed. Under a method-level transaction the lock was released before commit, so
    // a second request could still read the old state and both demote/deactivate the last two administrators.
    // Each repository call commits on its own, inside the lock.
    public Cliente createStaff(Long actorId, String rawEmail, Rol role) {
        if (role == null || role == Rol.CLIENTE) {
            throw new ValidationFailedException("role", "role must be ASESOR or ADMINISTRADOR");
        }
        String email = EmailAddress.normalize(rawEmail);
        synchronized (mutationLock) {
            if (clienteRepository.findByEmail(email).isPresent()) {
                throw new ConflictException("An account with this email already exists.");
            }
            Cliente created = clienteRepository.save(Cliente.provisioned(email, role, clock.instant()));
            audit.info("admin.user.created actor={} target={} role={} email={}",
                    actorId, created.getId(), role, EmailAddress.mask(email));
            return created;
        }
    }

    public Cliente changeRole(Long actorId, Long targetId, Rol newRole) {
        synchronized (mutationLock) {
            Cliente target = load(targetId);
            if (target.getRol() == newRole) {
                return target;
            }
            if (targetId.equals(actorId)) {
                throw new SelfModificationNotAllowedException();
            }
            if (target.getRol() == Rol.ADMINISTRADOR && target.isActive() && activeAdministrators() <= 1) {
                throw new LastAdministratorException();
            }
            Cliente saved = clienteRepository.save(target.withRol(newRole));
            int revoked = sessionService.revokeAllForCliente(targetId);
            audit.info("admin.user.role_changed actor={} target={} from={} to={} sessionsRevoked={}",
                    actorId, targetId, target.getRol(), newRole, revoked);
            return saved;
        }
    }

    public Cliente setActive(Long actorId, Long targetId, boolean active) {
        synchronized (mutationLock) {
            Cliente target = load(targetId);
            if (target.isActive() == active) {
                return target;
            }
            if (!active) {
                if (targetId.equals(actorId)) {
                    throw new SelfModificationNotAllowedException();
                }
                if (target.getRol() == Rol.ADMINISTRADOR && activeAdministrators() <= 1) {
                    throw new LastAdministratorException();
                }
            }
            Cliente saved = clienteRepository.save(target.withActive(active));
            int revoked = active ? 0 : sessionService.revokeAllForCliente(targetId);
            audit.info("admin.user.active_changed actor={} target={} from={} to={} sessionsRevoked={}",
                    actorId, targetId, target.isActive(), active, revoked);
            return saved;
        }
    }

    private long activeAdministrators() {
        return clienteRepository.findAll().stream()
                .filter(c -> c.getRol() == Rol.ADMINISTRADOR && c.isActive())
                .count();
    }

    private Cliente load(Long id) {
        return clienteRepository.findById(id).orElseThrow(() -> new NotFoundException("User not found."));
    }

    /** {@code field[,asc|desc]} over a whitelist (createdAt, email); anything else is 400 MALFORMED_REQUEST. */
    private static Comparator<Cliente> parseSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return SORTABLE.get("createdAt").reversed();
        }
        String[] parts = sort.split(",", -1);
        Comparator<Cliente> base = SORTABLE.get(parts[0].trim());
        boolean directionOk = parts.length == 1
                || (parts.length == 2 && ("asc".equalsIgnoreCase(parts[1].trim()) || "desc".equalsIgnoreCase(parts[1].trim())));
        if (base == null || !directionOk) {
            throw new MalformedRequestException("sort must be one of createdAt, email optionally followed by ,asc or ,desc.");
        }
        return parts.length == 2 && "desc".equalsIgnoreCase(parts[1].trim()) ? base.reversed() : base;
    }
}
