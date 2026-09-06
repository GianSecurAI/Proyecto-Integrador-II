package com.armakers3d.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * T017 (Constitution Principle XII, NON-NEGOTIABLE): neither the request nor verify response body
 * (nor any header) ever contains the one-time code or its hash, in any branch — including error
 * responses (FR-002). Exercises the happy path, an invalid-code rejection, and a request-endpoint
 * response.
 */
class OtpNeverExposedInResponseTest extends AbstractOtpIntegrationTest {

    @Test
    void requestResponseNeverContainsTheIssuedCode() throws Exception {
        String email = uniqueEmail("expose-request");

        MockHttpServletResponse response = requestOtp(email).andReturn().getResponse();
        String issuedCode = emailSender.lastCodeFor(email);

        assertThat(response.getContentAsString()).doesNotContain(issuedCode);
        assertThat(response.getHeaderNames()).noneMatch(name -> headerContainsCode(response, name, issuedCode));
    }

    @Test
    void successfulVerifyResponseNeverContainsTheCodeOrItsHash() throws Exception {
        String email = uniqueEmail("expose-verify-success");
        requestOtp(email);
        String issuedCode = emailSender.lastCodeFor(email);

        MockHttpServletResponse response = verifyOtp(email, issuedCode).andReturn().getResponse();

        String storedHash =
                codigoOtpRepository.findFirstByEmailOrderByIssuedAtDescIdDesc(email).orElseThrow().getCodeHash();

        assertThat(response.getContentAsString()).doesNotContain(issuedCode);
        assertThat(response.getContentAsString()).doesNotContain(storedHash);
    }

    @Test
    void failedVerifyResponseNeverContainsTheCodeOrItsHash() throws Exception {
        String email = uniqueEmail("expose-verify-failure");
        requestOtp(email);
        String issuedCode = emailSender.lastCodeFor(email);
        String wrongCode = wrongCodeDifferentFrom(issuedCode);

        MockHttpServletResponse response = verifyOtp(email, wrongCode).andReturn().getResponse();

        String storedHash =
                codigoOtpRepository.findFirstByEmailOrderByIssuedAtDescIdDesc(email).orElseThrow().getCodeHash();

        assertThat(response.getContentAsString()).doesNotContain(issuedCode);
        assertThat(response.getContentAsString()).doesNotContain(wrongCode);
        assertThat(response.getContentAsString()).doesNotContain(storedHash);
    }

    private boolean headerContainsCode(MockHttpServletResponse response, String headerName, String code) {
        String value = response.getHeader(headerName);
        return value != null && value.contains(code);
    }

    private String wrongCodeDifferentFrom(String issuedCode) {
        String candidate = "000000".equals(issuedCode) ? "111111" : "000000";
        return candidate;
    }
}
