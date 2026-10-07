package com.armakers3d.auth.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Daily trigger of {@link AuthDataPurgeService} (Spring {@code @Scheduled}, single instance, Lima time). Present only
 * when {@code purge.enabled=true} (default true in {@code application.yml}; off in the in-process test profile so no
 * timer runs there). A failure is logged by class only and retried the next day.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(prefix = "purge", name = "enabled", havingValue = "true")
public class AuthDataPurgeScheduler {

    private static final Logger log = LoggerFactory.getLogger(AuthDataPurgeScheduler.class);

    private final AuthDataPurgeService service;

    public AuthDataPurgeScheduler(AuthDataPurgeService service) {
        this.service = service;
    }

    @Scheduled(cron = "${purge.cron:0 30 3 * * *}", zone = "America/Lima")
    public void run() {
        try {
            service.purge();
        } catch (RuntimeException ex) {
            log.error("auth.purge.failed cause={}", ex.getClass().getSimpleName());
        }
    }
}
