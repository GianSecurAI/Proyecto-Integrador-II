package com.armakers3d.auth.domain;

/**
 * Published by the auth module when a verified one-time code creates a new customer account. {@code registrationProfile}
 * is what the customer typed in the registration form (null when nothing was typed); the users module stores it in the
 * profile of the new account.
 */
public record AccountCreatedEvent(Long clienteId, CodigoOtp.RegistrationProfile registrationProfile) {}
