package com.armakers3d.users.domain;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.Rol;
import java.time.Instant;

/** Read model joining the auth account with the profile, i.e. what {@code GET /api/customers/me} returns. */
public record CustomerAccountView(
        Long id, String email, Rol rol, Instant createdAt, String firstName, String lastName, String phone) {

    public static CustomerAccountView of(Cliente cliente, CustomerProfile profile) {
        return new CustomerAccountView(
                cliente.getId(),
                cliente.getEmail(),
                cliente.getRol(),
                cliente.getCreatedAt(),
                profile.firstName(),
                profile.lastName(),
                profile.phone());
    }
}
