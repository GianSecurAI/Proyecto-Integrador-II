package com.armakers3d.users.service;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.repository.ClienteRepository;
import com.armakers3d.shared.error.NotFoundException;
import com.armakers3d.shared.error.ValidationFailedException;
import com.armakers3d.users.domain.CustomerAccountView;
import com.armakers3d.users.domain.CustomerProfile;
import com.armakers3d.users.domain.ProfileRules;
import com.armakers3d.users.repository.CustomerProfileRepository;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Customer self-service profile (contract review E5/E6). Ownership is structural: every method
 * takes the id of the AUTHENTICATED account (from the security principal, never from a request
 * field), so there is no way to address another customer's profile through this service.
 */
@Service
public class CustomerProfileService {

    private static final Logger log = LoggerFactory.getLogger(CustomerProfileService.class);
    private static final Pattern PHONE = Pattern.compile(ProfileRules.PHONE_REGEX);

    private final ClienteRepository clienteRepository;
    private final CustomerProfileRepository profileRepository;

    public CustomerProfileService(ClienteRepository clienteRepository, CustomerProfileRepository profileRepository) {
        this.clienteRepository = clienteRepository;
        this.profileRepository = profileRepository;
    }

    @Transactional(readOnly = true)
    public CustomerAccountView getOwn(Long clienteId) {
        Cliente cliente = load(clienteId);
        return CustomerAccountView.of(cliente, profileRepository.findByClienteId(clienteId).orElse(CustomerProfile.empty(clienteId)));
    }

    /** Full replacement of the editable fields; email and role are never writable here. */
    @Transactional
    public CustomerAccountView updateOwn(Long clienteId, String firstName, String lastName, String phone) {
        Cliente cliente = load(clienteId);
        String normalizedPhone = blankToNull(phone);
        if (normalizedPhone != null && !PHONE.matcher(normalizedPhone).matches()) {
            throw new ValidationFailedException("phone", "phone must be 6-20 characters: digits, +, -, spaces or parentheses");
        }
        CustomerProfile saved = profileRepository.save(
                new CustomerProfile(clienteId, blankToNull(firstName), blankToNull(lastName), normalizedPhone));
        log.info("customer.profile.updated cliente={}", clienteId);
        return CustomerAccountView.of(cliente, saved);
    }

    private Cliente load(Long clienteId) {
        return clienteRepository.findById(clienteId).orElseThrow(() -> new NotFoundException("Customer not found."));
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
