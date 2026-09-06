-- Customer account (data-model.md: Entity Cliente). Created automatically on first successful
-- OTP verification for a previously unseen email (FR-005). One email registers at most once;
-- application code always normalizes email to lower-case before write/read, so a plain UNIQUE
-- constraint on the stored value enforces case-insensitive uniqueness without requiring a
-- database-specific expression index (keeps the migration portable across PostgreSQL and the H2
-- PostgreSQL-compatibility mode used in automated tests).
CREATE TABLE cliente (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'CLIENTE',
    created_at TIMESTAMP NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_cliente_email UNIQUE (email),
    CONSTRAINT chk_cliente_rol CHECK (rol IN ('CLIENTE', 'ADMINISTRADOR'))
);
