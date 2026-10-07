package com.armakers3d.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * One-time-code policy values (research.md #1 / spec.md Assumptions), externalized so they are
 * an explicit, testable, environment-tunable configuration rather than implicit in code
 * (Constitution Principle VI requires the exact numeric values to be an explicit acceptance
 * criterion).
 */
@ConfigurationProperties(prefix = "otp")
public class OtpPolicyProperties {

    /** Minutes after issuance a code remains valid. Default: 10 (spec.md Assumptions). */
    private int expiryMinutes = 10;

    /** Maximum failed verification attempts allowed per issued code. Default: 5. */
    private int maxAttempts = 5;

    /** Maximum codes that may be requested per email within the throttling window. Default: 3. */
    private int maxRequestsPerWindow = 3;

    /** Length, in minutes, of the request-throttling window. Default: 15. */
    private int requestWindowMinutes = 15;

    /**
     * Cumulative cap on FAILED verification attempts per email across every code issued within
     * {@link #failedAttemptsWindowMinutes} (security review M1): the per-code limit alone lets an attacker
     * keep requesting fresh codes and get {@code maxAttempts} new guesses each time. Default: 10.
     */
    private int maxFailedAttemptsPerEmail = 10;

    /** Look-back window, in minutes, for {@link #maxFailedAttemptsPerEmail}. Default: 60. */
    private int failedAttemptsWindowMinutes = 60;

    /** Max {@code POST /api/auth/otp/request} calls per client IP per request window (M3). Default: 10. */
    private int ipMaxRequestCalls = 10;

    /** Max {@code POST /api/auth/otp/verify} calls per client IP per request window (M3). Default: 30. */
    private int ipMaxVerifyCalls = 30;

    public int getMaxFailedAttemptsPerEmail() {
        return maxFailedAttemptsPerEmail;
    }

    public void setMaxFailedAttemptsPerEmail(int maxFailedAttemptsPerEmail) {
        this.maxFailedAttemptsPerEmail = maxFailedAttemptsPerEmail;
    }

    public int getFailedAttemptsWindowMinutes() {
        return failedAttemptsWindowMinutes;
    }

    public void setFailedAttemptsWindowMinutes(int failedAttemptsWindowMinutes) {
        this.failedAttemptsWindowMinutes = failedAttemptsWindowMinutes;
    }

    public int getIpMaxRequestCalls() {
        return ipMaxRequestCalls;
    }

    public void setIpMaxRequestCalls(int ipMaxRequestCalls) {
        this.ipMaxRequestCalls = ipMaxRequestCalls;
    }

    public int getIpMaxVerifyCalls() {
        return ipMaxVerifyCalls;
    }

    public void setIpMaxVerifyCalls(int ipMaxVerifyCalls) {
        this.ipMaxVerifyCalls = ipMaxVerifyCalls;
    }

    public int getExpiryMinutes() {
        return expiryMinutes;
    }

    public void setExpiryMinutes(int expiryMinutes) {
        this.expiryMinutes = expiryMinutes;
    }

    public int getMaxAttempts() {
        return maxAttempts;
    }

    public void setMaxAttempts(int maxAttempts) {
        this.maxAttempts = maxAttempts;
    }

    public int getMaxRequestsPerWindow() {
        return maxRequestsPerWindow;
    }

    public void setMaxRequestsPerWindow(int maxRequestsPerWindow) {
        this.maxRequestsPerWindow = maxRequestsPerWindow;
    }

    public int getRequestWindowMinutes() {
        return requestWindowMinutes;
    }

    public void setRequestWindowMinutes(int requestWindowMinutes) {
        this.requestWindowMinutes = requestWindowMinutes;
    }
}
