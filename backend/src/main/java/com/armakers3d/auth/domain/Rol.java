package com.armakers3d.auth.domain;

/**
 * RBAC role model (Constitution Principle VII). Names stay in the Spanish vocabulary already
 * used by the approved contract and the SPA ({@code roles.ts}): {@code CLIENTE},
 * {@code ASESOR}, {@code ADMINISTRADOR}. All roles authenticate through the same email-OTP
 * mechanism (no staff passwords). Only {@link #CLIENTE} can be created by self-registration;
 * {@link #ASESOR} and {@link #ADMINISTRADOR} accounts are provisioned.
 */
public enum Rol {
    CLIENTE,
    ASESOR,
    ADMINISTRADOR
}
