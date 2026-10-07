package com.armakers3d.auth.security;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.Rol;

/**
 * The authenticated principal placed in the Spring Security context. Built from the LIVE account
 * record on every request (never from the session snapshot), so {@code rol} is always current.
 * Controllers receive it with {@code @AuthenticationPrincipal}; ownership is derived from
 * {@link #id()} and never from a client-supplied id.
 */
public record AuthenticatedUser(Long id, String email, Rol rol) {

    public static AuthenticatedUser from(Cliente cliente) {
        return new AuthenticatedUser(cliente.getId(), cliente.getEmail(), cliente.getRol());
    }

    /** The Spring Security authority for this principal: {@code ROLE_<rol>}. */
    public String authority() {
        return "ROLE_" + rol.name();
    }
}
