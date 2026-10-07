package com.armakers3d.users.service.exception;

import com.armakers3d.shared.error.ConflictException;

/**
 * The email belongs to an account that cannot own a customer order: it is deactivated or it is a staff
 * account (409 CUSTOMER_NOT_ELIGIBLE). One message for both cases so the response reveals no role.
 */
public class CustomerNotEligibleException extends ConflictException {

    public CustomerNotEligibleException() {
        super("CUSTOMER_NOT_ELIGIBLE", "The email does not belong to an active customer account.");
    }
}
