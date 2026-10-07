package com.armakers3d.users.service.exception;

import com.armakers3d.shared.error.ConflictException;

/** The change would leave the system without any active administrator (contract: 409 LAST_ADMINISTRATOR). */
public class LastAdministratorException extends ConflictException {

    public LastAdministratorException() {
        super("LAST_ADMINISTRATOR", "At least one active administrator must remain.");
    }
}
