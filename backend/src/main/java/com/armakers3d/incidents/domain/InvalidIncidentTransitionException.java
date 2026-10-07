package com.armakers3d.incidents.domain;

import com.armakers3d.shared.error.ConflictException;

/** The requested incident change is not allowed from the current status (409 INVALID_STATUS_TRANSITION). */
public class InvalidIncidentTransitionException extends ConflictException {

    public InvalidIncidentTransitionException(IncidentStatus from, IncidentStatus to) {
        super("INVALID_STATUS_TRANSITION", "Cannot change the incident status from " + from + " to " + to + ".");
    }

    private InvalidIncidentTransitionException(String message) {
        super("INVALID_STATUS_TRANSITION", message);
    }

    /** The incident changed between the read and the write (a concurrent change won). */
    public static InvalidIncidentTransitionException concurrentChange() {
        return new InvalidIncidentTransitionException(
                "The incident was changed by another request; reload it and try again.");
    }
}
