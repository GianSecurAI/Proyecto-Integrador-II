package com.armakers3d.users.service;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.auth.repository.ClienteRepository;
import com.armakers3d.shared.util.EmailAddress;
import com.armakers3d.users.domain.CustomerProfile;
import com.armakers3d.users.repository.CustomerProfileRepository;
import com.armakers3d.users.service.exception.CustomerNotEligibleException;
import java.time.Clock;
import java.util.Collection;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Public API other modules use to resolve the owner of a customer order by email (the orders module
 * must not touch the account repository). Contract review D-13 recommendation: an unknown email gets
 * an active CLIENTE account created by the staff action, so the customer sees the order after the
 * first OTP login. An existing account must be an ACTIVE CLIENTE; staff or deactivated accounts are
 * rejected. Access to the caller is decided by the role matrix, not here.
 */
@Service
public class CustomerDirectoryService {

    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.users");

    /** Small read model: the account id and its normalized email. */
    public record CustomerRef(Long id, String email) {}

    /** Read model for staff order screens: account email plus optional profile name and phone. */
    public record ContactView(Long id, String email, String name, String phone) {}

    private final ClienteRepository clienteRepository;
    private final CustomerProfileRepository profiles;
    private final Clock clock;
    private final Object creationLock = new Object();

    public CustomerDirectoryService(
            ClienteRepository clienteRepository, CustomerProfileRepository profiles, Clock clock) {
        this.clienteRepository = clienteRepository;
        this.profiles = profiles;
        this.clock = clock;
    }

    /** @param normalizedEmail already validated and lower-cased */
    public CustomerRef findOrCreateCustomer(Long staffActorId, String normalizedEmail) {
        String email = EmailAddress.normalize(normalizedEmail);
        Cliente found = clienteRepository.findByEmail(email).orElse(null);
        if (found == null) {
            synchronized (creationLock) {
                found = clienteRepository.findByEmail(email).orElse(null);
                if (found == null) {
                    Cliente created = clienteRepository.save(new Cliente(email, clock.instant()));
                    audit.info("customer.created_by_staff actor={} target={} email={}",
                            staffActorId, created.getId(), EmailAddress.mask(email));
                    return new CustomerRef(created.getId(), created.getEmail());
                }
            }
        }
        if (found.getRol() != Rol.CLIENTE || !found.isActive()) {
            throw new CustomerNotEligibleException();
        }
        return new CustomerRef(found.getId(), found.getEmail());
    }

    /** Accounts (any role) by id with their optional profile data; unknown ids are absent from the result. */
    public Map<Long, ContactView> contactsByIds(Collection<Long> ids) {
        Map<Long, ContactView> result = new HashMap<>();
        for (Long id : Set.copyOf(ids)) {
            clienteRepository.findById(id).ifPresent(c -> {
                CustomerProfile p = profiles.findByClienteId(id).orElse(CustomerProfile.empty(id));
                String name = Stream.of(p.firstName(), p.lastName())
                        .filter(part -> part != null && !part.isBlank())
                        .collect(Collectors.joining(" "));
                result.put(id, new ContactView(id, c.getEmail(), name.isEmpty() ? null : name, p.phone()));
            });
        }
        return result;
    }

    /** Ids of the CLIENTE accounts whose email contains the fragment (case-insensitive). For staff order search. */
    public Set<Long> customerIdsByEmailContaining(String fragment) {
        String needle = fragment.trim().toLowerCase(Locale.ROOT);
        return clienteRepository.findAll().stream()
                .filter(c -> c.getRol() == Rol.CLIENTE && c.getEmail().toLowerCase(Locale.ROOT).contains(needle))
                .map(Cliente::getId)
                .collect(Collectors.toSet());
    }
}
