-- Authenticated session (data-model.md: Entity AuthenticatedSession), the artifact created on
-- successful OTP verification (FR-015) and resolved on every subsequent request via the
-- SessionAuthenticationFilter (research.md #3: opaque, server-side session, not a JWT). This
-- table is introduced alongside T049 (session-resolution security filter) even though it was not
-- separately enumerated in tasks.md's migration tasks, because Constitution Principle X requires
-- every schema change — including this one — to ship as a versioned migration in the same change
-- as the entity/repository code that depends on it.
CREATE TABLE authenticated_session (
    id VARCHAR(64) PRIMARY KEY,
    cliente_id BIGINT NOT NULL,
    rol VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,
    CONSTRAINT fk_authenticated_session_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
);

CREATE INDEX ix_authenticated_session_cliente_id ON authenticated_session (cliente_id);
