package com.armakers3d.users.dto;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.users.domain.CustomerAccountView;
import java.time.Instant;

/** Response of {@code GET/PUT /api/customers/me} (contract review E5/E6); nullable fields are always present. */
public record CustomerProfileResponseDto(
        Long id, String email, Rol role, Instant createdAt, String firstName, String lastName, String phone) {

    public static CustomerProfileResponseDto from(CustomerAccountView v) {
        return new CustomerProfileResponseDto(
                v.id(), v.email(), v.rol(), v.createdAt(), v.firstName(), v.lastName(), v.phone());
    }
}
