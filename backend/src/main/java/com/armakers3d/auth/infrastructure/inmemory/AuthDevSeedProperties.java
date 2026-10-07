package com.armakers3d.auth.infrastructure.inmemory;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Explicit dev-seed configuration ({@code auth.dev-seed.*}), read only by {@link AuthDevSeed}
 * under the {@code nodb} profile. Blank (the default) means "seed nothing". Values live in
 * {@code application-nodb.yml} and use the reserved {@code example.test} domain; they are never
 * read by any other profile.
 */
@ConfigurationProperties(prefix = "auth.dev-seed")
public class AuthDevSeedProperties {

    private String advisorEmail = "";
    private String adminEmail = "";

    public String getAdvisorEmail() {
        return advisorEmail;
    }

    public void setAdvisorEmail(String advisorEmail) {
        this.advisorEmail = advisorEmail;
    }

    public String getAdminEmail() {
        return adminEmail;
    }

    public void setAdminEmail(String adminEmail) {
        this.adminEmail = adminEmail;
    }
}
