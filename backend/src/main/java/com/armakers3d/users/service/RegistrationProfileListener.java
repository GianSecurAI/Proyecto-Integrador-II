package com.armakers3d.users.service;

import com.armakers3d.auth.domain.AccountCreatedEvent;
import com.armakers3d.auth.domain.CodigoOtp.RegistrationProfile;
import com.armakers3d.shared.error.ValidationFailedException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Copies the name and phone typed in the registration form to the profile of the account the first verified code just
 * created. Runs inside the verification transaction, so the account and its profile are stored together or not at all.
 */
@Component
public class RegistrationProfileListener {

    private static final Logger log = LoggerFactory.getLogger(RegistrationProfileListener.class);

    private final CustomerProfileService profiles;

    public RegistrationProfileListener(CustomerProfileService profiles) {
        this.profiles = profiles;
    }

    @EventListener
    public void onAccountCreated(AccountCreatedEvent event) {
        RegistrationProfile profile = event.registrationProfile();
        if (profile == null) {
            return;
        }
        try {
            profiles.updateOwn(event.clienteId(), profile.firstName(), profile.lastName(), profile.phone());
        } catch (ValidationFailedException invalid) {
            // a malformed optional field must never block the sign-in; the customer can fix it in the profile page
            log.warn("registration.profile.ignored cliente={} cause={}", event.clienteId(), invalid.getMessage());
        }
    }
}
