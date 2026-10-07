package com.armakers3d.incidents.domain;

import java.util.List;

/**
 * Incident status vocabulary and transition table, PROVISIONAL (contract review D-03 recommendation,
 * PD-INC-01): {@code ABIERTA -> EN_REVISION -> RESUELTA | RECHAZADA}. Wire values are these names. This
 * table is THE single source of truth for incident transitions. {@code RESUELTA} is reachable only through
 * the resolution action ({@link Incident#resolve}), never through the status PATCH.
 */
public enum IncidentStatus {
    ABIERTA,
    EN_REVISION,
    RESUELTA,
    RECHAZADA;

    public List<IncidentStatus> allowedNext() {
        return switch (this) {
            case ABIERTA -> List.of(EN_REVISION);
            case EN_REVISION -> List.of(RESUELTA, RECHAZADA);
            case RESUELTA, RECHAZADA -> List.of();
        };
    }

    public boolean canTransitionTo(IncidentStatus target) {
        return target != null && allowedNext().contains(target);
    }

    public boolean isTerminal() {
        return allowedNext().isEmpty();
    }
}
