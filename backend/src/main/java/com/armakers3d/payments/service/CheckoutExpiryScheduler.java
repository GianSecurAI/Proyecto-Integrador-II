package com.armakers3d.payments.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Every 5 minutes (single instance, ADR-004 5.6) expires AWAITING_PAYMENT_PROOF checkouts older than the TTL through {@link CheckoutExpiryService}.
 * Present only when {@code app.payments.expiry-job-enabled=true} (default true; switched off in the automated tests,
 * which call the service directly with a fixed clock). A failure is logged by class only and retried next run.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(prefix = "app.payments", name = "expiry-job-enabled", havingValue = "true", matchIfMissing = true)
public class CheckoutExpiryScheduler {

    private static final Logger log = LoggerFactory.getLogger(CheckoutExpiryScheduler.class);

    private final CheckoutExpiryService service;

    public CheckoutExpiryScheduler(CheckoutExpiryService service) {
        this.service = service;
    }

    @Scheduled(cron = "0 */5 * * * *", zone = "America/Lima")
    public void run() {
        try {
            int expired = service.expireStale();
            if (expired > 0) {
                log.info("checkout.expiry.run expired={}", expired);
            }
        } catch (RuntimeException ex) {
            log.error("checkout.expiry.failed cause={}", ex.getClass().getSimpleName());
        }
    }
}
