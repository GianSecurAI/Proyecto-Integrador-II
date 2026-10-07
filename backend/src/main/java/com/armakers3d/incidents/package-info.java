/**
 * Incidents domain: problems reported by customers against orders they own, and the staff triage and
 * resolution workflow (RF-15..RF-18; statuses and priorities PROVISIONAL, D-03). Depends on
 * {@code orders} (ownership lookup through {@code OrderLookupService}), {@code users} (owner contact for
 * staff screens) and {@code shared}. In-memory storage until the database phase (PD-INC-06).
 */
package com.armakers3d.incidents;
