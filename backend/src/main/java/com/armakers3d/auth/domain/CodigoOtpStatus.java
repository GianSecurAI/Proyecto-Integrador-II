package com.armakers3d.auth.domain;

/**
 * State machine for a {@link CodigoOtp} row, per data-model.md:
 *
 * <pre>
 * PENDING --(correct code, before expiry, attemptCount &lt; max)--&gt; VERIFIED   (terminal)
 * PENDING --(expiresAt passed)-----------------------------------&gt; EXPIRED    (terminal)
 * PENDING --(new code requested for same email)-------------------&gt; SUPERSEDED (terminal)
 * PENDING --(attemptCount reaches max)-----------------------------&gt; stays PENDING but is
 *                                                                    permanently unverifiable
 *                                                                    until superseded or expired
 * </pre>
 */
public enum CodigoOtpStatus {
    PENDING,
    VERIFIED,
    EXPIRED,
    SUPERSEDED
}
