package com.armakers3d.payments.service;

/** Masks identifiers before they reach a log line: logs never carry a full checkout id (it is the poll key). */
final class LogMasks {

    private LogMasks() {}

    /** Checkout UUID: first 8 characters (enough to correlate, not enough to poll or guess the full id). */
    static String checkout(String checkoutId) {
        if (checkoutId == null) {
            return "-";
        }
        return checkoutId.length() <= 8 ? checkoutId : checkoutId.substring(0, 8) + "...";
    }
}
