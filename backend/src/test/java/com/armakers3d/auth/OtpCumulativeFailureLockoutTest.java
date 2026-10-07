package com.armakers3d.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import org.junit.jupiter.api.Test;

/**
 * Security review M1 (cross-code OTP brute force). The per-code limit (5) alone is not enough: an attacker
 * who keeps requesting fresh codes gets 5 new guesses each time. The cumulative per-email failed-attempt
 * cap (default 10 within 60 minutes) must lock verification even for the correct, newest code.
 */
class OtpCumulativeFailureLockoutTest extends AbstractOtpIntegrationTest {

    private static String wrongFor(String code) {
        return "000000".equals(code) ? "999999" : "000000";
    }

    @Test
    void failedAttemptsAcrossSeveralCodesAccumulateAndEvenTheCorrectNewestCodeIsRefused() throws Exception {
        String email = uniqueEmail("cumulative");
        for (int code = 1; code <= 2; code++) {
            requestOtp(email);
            String wrong = wrongFor(emailSender.lastCodeFor(email));
            for (int attempt = 1; attempt <= 5; attempt++) {
                verifyOtp(email, wrong).andExpect(status().isUnauthorized());
            }
        }
        // 10 failures so far across two codes; a third, fresh code must NOT reset the guess budget.
        requestOtp(email).andExpect(status().isAccepted());
        String correct = emailSender.lastCodeFor(email);

        var result = verifyOtp(email, correct)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("OTP_ATTEMPTS_EXCEEDED"))
                .andReturn();
        assertThat(result.getResponse().getCookie("ARM3D_SESSION")).isNull();
        assertThat(clienteRepository.findByEmail(email)).isEmpty();
    }

    @Test
    void theLockoutExpiresWhenTheWindowHasPassed() throws Exception {
        String email = uniqueEmail("cumulative-window");
        for (int code = 1; code <= 2; code++) {
            requestOtp(email);
            String wrong = wrongFor(emailSender.lastCodeFor(email));
            for (int attempt = 1; attempt <= 5; attempt++) {
                verifyOtp(email, wrong);
            }
        }
        mutableClock().advance(Duration.ofMinutes(61));
        requestOtp(email).andExpect(status().isAccepted());
        verifyOtp(email, emailSender.lastCodeFor(email)).andExpect(status().isOk());
    }

    @Test
    void successfulLoginsAreNotCountedAsFailures() throws Exception {
        String email = uniqueEmail("cumulative-success");
        for (int login = 1; login <= 3; login++) {
            requestOtp(email).andExpect(status().isAccepted());
            verifyOtp(email, emailSender.lastCodeFor(email)).andExpect(status().isOk());
        }
        assertThat(codigoOtpRepository.sumFailedAttemptsIssuedAfter(email, mutableClock().instant().minus(Duration.ofHours(1))))
                .isZero();
    }
}
