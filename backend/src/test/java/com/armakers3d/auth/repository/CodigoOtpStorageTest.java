package com.armakers3d.auth.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.armakers3d.auth.AbstractOtpIntegrationTest;
import com.armakers3d.auth.domain.CodigoOtp;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * T018 (Constitution Principle XII, NON-NEGOTIABLE): the persisted {@code codigo_otp.code_hash}
 * value is never equal to the plaintext code and cannot be trivially reversed to it (FR-014).
 */
class CodigoOtpStorageTest extends AbstractOtpIntegrationTest {

    @Test
    void storedHashIsNeverThePlaintextCodeAndIsNotTriviallyReversible() throws Exception {
        String email = uniqueEmail("storage");
        requestOtp(email);
        String plaintextCode = emailSender.lastCodeFor(email);

        CodigoOtp persisted = codigoOtpRepository.findFirstByEmailOrderByIssuedAtDescIdDesc(email).orElseThrow();
        String storedHash = persisted.getCodeHash();

        assertThat(storedHash).isNotEqualTo(plaintextCode);
        assertThat(storedHash).doesNotContain(plaintextCode);
        // A reversible/weak encoding (Base64, hex, simple substitution) of a 6-digit number would
        // be short and/or numeric; a proper adaptive hash is neither.
        assertThat(storedHash.length()).isGreaterThan(plaintextCode.length());
        assertThat(storedHash).matches(value -> !value.chars().allMatch(Character::isDigit));

        // Control: the stored value must still be a *valid* hash of the plaintext code, i.e. this
        // is genuinely the corresponding one-way hash, not unrelated garbage.
        assertThat(new BCryptPasswordEncoder().matches(plaintextCode, storedHash)).isTrue();
    }
}
