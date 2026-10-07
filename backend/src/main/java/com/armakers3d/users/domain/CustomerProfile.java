package com.armakers3d.users.domain;

/**
 * Editable customer profile data (contract review E5/E6), keyed by the account id owned by
 * {@code auth}. All fields are optional (null = not provided). Immutable.
 */
public record CustomerProfile(Long clienteId, String firstName, String lastName, String phone) {

    public static CustomerProfile empty(Long clienteId) {
        return new CustomerProfile(clienteId, null, null, null);
    }
}
