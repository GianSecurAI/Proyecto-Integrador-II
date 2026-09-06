package com.armakers3d.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Server-side session policy (research.md #3). spec.md Assumptions explicitly leaves session
 * lifetime out of this feature's detailed scope; these are the documented, reasonable defaults
 * chosen so the authorization checks (User Story 4) have something concrete to evaluate.
 */
@ConfigurationProperties(prefix = "session")
public class SessionProperties {

    private int ttlHours = 24;
    private String cookieName = "ARM3D_SESSION";
    private boolean cookieSecure = true;

    public int getTtlHours() {
        return ttlHours;
    }

    public void setTtlHours(int ttlHours) {
        this.ttlHours = ttlHours;
    }

    public String getCookieName() {
        return cookieName;
    }

    public void setCookieName(String cookieName) {
        this.cookieName = cookieName;
    }

    public boolean isCookieSecure() {
        return cookieSecure;
    }

    public void setCookieSecure(boolean cookieSecure) {
        this.cookieSecure = cookieSecure;
    }
}
