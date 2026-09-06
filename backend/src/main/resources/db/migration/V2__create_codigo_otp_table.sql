-- One-time code (data-model.md: Entity CodigoOTP). Keyed by email rather than a Cliente FK
-- because a code must exist and be verifiable before any Cliente row exists (registration case,
-- FR-005). code_hash stores only a salted one-way hash, never the plaintext code (FR-014).
CREATE TABLE codigo_otp (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    issued_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL,
    CONSTRAINT chk_codigo_otp_status CHECK (status IN ('PENDING', 'VERIFIED', 'EXPIRED', 'SUPERSEDED'))
);

-- Supports both required queries: "latest code for an email" (verification, FR-003) and
-- "count of codes issued for an email within the throttling window" (FR-012).
CREATE INDEX ix_codigo_otp_email_issued_at ON codigo_otp (email, issued_at DESC);

-- Supports "find all PENDING rows for an email to supersede" (FR-013).
CREATE INDEX ix_codigo_otp_email_status ON codigo_otp (email, status);
