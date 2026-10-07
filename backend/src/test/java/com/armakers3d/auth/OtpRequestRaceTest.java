package com.armakers3d.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.armakers3d.auth.domain.CodigoOtpStatus;
import com.armakers3d.auth.service.OtpService;
import com.armakers3d.auth.service.exception.OtpRequestThrottledException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Security review M4: the count-then-insert in requestOtp was not atomic, so parallel requests for
 * one email could each pass the throttle (more than 3 codes per window, several PENDING codes at once).
 */
class OtpRequestRaceTest extends AbstractOtpIntegrationTest {

    @Autowired private OtpService otpService;

    @Test
    void parallelRequestsForOneEmailNeverExceedTheWindowLimitAndLeaveOnePendingCode() throws Exception {
        String email = uniqueEmail("race");
        int threads = 12;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger throttled = new AtomicInteger();
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            futures.add(pool.submit(() -> {
                start.await();
                try {
                    otpService.requestOtp(email);
                } catch (OtpRequestThrottledException expected) {
                    throttled.incrementAndGet();
                }
                return null;
            }));
        }
        start.countDown();
        for (Future<?> f : futures) {
            f.get(30, TimeUnit.SECONDS);
        }
        pool.shutdown();
        assertThat(pool.awaitTermination(10, TimeUnit.SECONDS)).isTrue();

        long issued = codigoOtpRepository.countIssuedAfter(email, mutableClock().instant().minusSeconds(3600));
        assertThat(issued).as("codes issued").isEqualTo(3); // policy default: 3 per window
        assertThat(throttled.get()).isEqualTo(threads - 3);
        assertThat(codigoOtpRepository.findByEmailAndStatus(email, CodigoOtpStatus.PENDING)).hasSize(1);
    }
}
