package com.armakers3d.users.service.exception;

import com.armakers3d.shared.error.ConflictException;

/** An administrator tried to change their own role or deactivate themselves (409 SELF_MODIFICATION_NOT_ALLOWED). */
public class SelfModificationNotAllowedException extends ConflictException {

    public SelfModificationNotAllowedException() {
        super("SELF_MODIFICATION_NOT_ALLOWED", "You cannot change your own role or deactivate your own account.");
    }
}
