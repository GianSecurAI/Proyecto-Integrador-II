package com.armakers3d.incidents.domain;

/** Triage priority, PROVISIONAL (contract review D-03, PD-INC-02). Set by staff only; new incidents are {@link #MEDIA}. */
public enum IncidentPriority {
    BAJA,
    MEDIA,
    ALTA
}
