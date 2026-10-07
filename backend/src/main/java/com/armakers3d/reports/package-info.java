/**
 * Reports domain (Stage 13): read-only aggregate reports for administrators (E32, E33). Queries go through the
 * ports in {@code repository}; the in-memory adapters read only the narrow feeds {@code OrderReportFeed} and
 * {@code IncidentReportFeed}, never another module repository or aggregate.
 */
package com.armakers3d.reports;
