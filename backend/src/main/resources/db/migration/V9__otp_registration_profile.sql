-- V9: the registration form sends first name, last name and phone together with the first code request. They are kept
-- on the (single-use, short-lived) code row and copied to the profile of the account when the code creates it.
ALTER TABLE codigo_otp ADD COLUMN nombres_registro   VARCHAR(80);
ALTER TABLE codigo_otp ADD COLUMN apellidos_registro VARCHAR(80);
ALTER TABLE codigo_otp ADD COLUMN telefono_registro  VARCHAR(20);
