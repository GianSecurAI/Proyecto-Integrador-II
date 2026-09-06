package com.armakers3d.auth.domain;

/**
 * Minimal RBAC role model (Constitution Principle VII). Per spec.md Assumptions, "Asesor" is not
 * a confirmed distinct role yet (open question #2 in 06-system-definition.md); until resolved,
 * ADMINISTRADOR also stands in for advisor-only capabilities.
 */
public enum Rol {
    CLIENTE,
    ADMINISTRADOR
}
