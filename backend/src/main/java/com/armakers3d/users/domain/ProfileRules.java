package com.armakers3d.users.domain;

/**
 * Validation constants for the customer profile (contract review E1/E6), shared by the DTO
 * annotations and the service re-check so the rule exists in exactly one place.
 */
public final class ProfileRules {

    public static final int NAME_MAX = 80;

    /** Strict phone format applied to the trimmed value (also the SPA rule). */
    public static final String PHONE_REGEX = "^[0-9+\\-\\s()]{6,20}$";

    /** Lenient input form accepted by the DTO: empty/blank is allowed and means "clear the value". */
    public static final String PHONE_INPUT_REGEX = "^(\\s*|[0-9+\\-\\s()]{6,20})$";

    private ProfileRules() {}
}
