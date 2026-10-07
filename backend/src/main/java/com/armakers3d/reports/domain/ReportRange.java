package com.armakers3d.reports.domain;

import com.armakers3d.shared.error.ValidationFailedException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

/**
 * Validated report window (PD-REP-02): calendar days in America/Lima, both ends INCLUSIVE. Absent bounds
 * default to the last {@link #DEFAULT_DAYS} days ending today (Lima); the effective range is echoed in the
 * response. {@code from <= to} and at most {@link #MAX_DAYS} days (inclusive count), else 400.
 */
public record ReportRange(LocalDate from, LocalDate to) {

    public static final ZoneId BUSINESS_ZONE = ZoneId.of("America/Lima");
    public static final int DEFAULT_DAYS = 30;
    public static final int MAX_DAYS = 366;
    public static final int MIN_YEAR = 2000;
    public static final int MAX_YEAR = 2999;

    public static ReportRange resolve(LocalDate from, LocalDate to, LocalDate todayInLima) {
        requireSaneYear("from", from);
        requireSaneYear("to", to);
        LocalDate end = to != null ? to : todayInLima;
        LocalDate start = from != null ? from : end.minusDays(DEFAULT_DAYS - 1L);
        if (start.isAfter(end)) {
            throw new ValidationFailedException("from", "must not be after to");
        }
        if (ChronoUnit.DAYS.between(start, end) + 1 > MAX_DAYS) {
            throw new ValidationFailedException("to", "the range must not exceed " + MAX_DAYS + " days");
        }
        return new ReportRange(start, end);
    }

    /** Rejects absurd years (e.g. +999999999-12-31) that would overflow when the exclusive end bound is built (was a 500). */
    private static void requireSaneYear(String field, LocalDate value) {
        if (value != null && (value.getYear() < MIN_YEAR || value.getYear() > MAX_YEAR)) {
            throw new ValidationFailedException(field, "year must be between " + MIN_YEAR + " and " + MAX_YEAR);
        }
    }

    /** Start of the first day in Lima (inclusive). */
    public Instant fromInstant() {
        return from.atStartOfDay(BUSINESS_ZONE).toInstant();
    }

    /** Start of the day after the last one in Lima (exclusive bound). */
    public Instant toExclusiveInstant() {
        return to.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant();
    }
}
