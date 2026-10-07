-- ASESOR (advisor) is a distinct role (CLAUDE.md, constitution VII, ADR-004 5.3, task DB-02). V1 only allowed
-- CLIENTE and ADMINISTRADOR, so a provisioned advisor could not be stored on a real database.
ALTER TABLE cliente DROP CONSTRAINT chk_cliente_rol;
ALTER TABLE cliente
    ADD CONSTRAINT chk_cliente_rol CHECK (rol IN ('CLIENTE', 'ASESOR', 'ADMINISTRADOR'));
