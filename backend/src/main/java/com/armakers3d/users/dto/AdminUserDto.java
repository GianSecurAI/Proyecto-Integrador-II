package com.armakers3d.users.dto;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.Rol;
import java.time.Instant;

/** Contract review 4.5 {@code AdminUser}; names and phone are deliberately omitted (data minimisation). */
public record AdminUserDto(Long id, String email, Rol role, Instant createdAt, boolean active) {

    public static AdminUserDto from(Cliente c) {
        return new AdminUserDto(c.getId(), c.getEmail(), c.getRol(), c.getCreatedAt(), c.isActive());
    }
}
