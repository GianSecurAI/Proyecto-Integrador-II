-- Customer profile columns (ADR-004 5.3, contract finding 17). Nullable: a customer has an empty profile until
-- they fill it in. Added now (authorized); the JPA profile adapter that reads and writes them ships with DB-03.
ALTER TABLE cliente ADD COLUMN first_name VARCHAR(80);
ALTER TABLE cliente ADD COLUMN last_name  VARCHAR(80);
ALTER TABLE cliente ADD COLUMN phone      VARCHAR(20);
