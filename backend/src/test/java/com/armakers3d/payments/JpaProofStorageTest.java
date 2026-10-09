package com.armakers3d.payments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.armakers3d.payments.storage.ProofStorage;
import com.armakers3d.payments.storage.ProofStorageException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/** The proof storage port behavior on the PostgreSQL adapter (the in-memory capacity caps do not apply). */
@SpringBootTest(properties = "app.persistence.proofs=jpa")
@ActiveProfiles("test")
class JpaProofStorageTest {

    @Autowired ProofStorage storage;
    @Autowired JdbcTemplate jdbc;

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from comprobante_imagen");
    }

    @Test
    void storesLoadsAndDeletesAndLoadOfUnknownKeyIsEmpty() {
        storage.store("c1", "k1", new byte[] {1, 2, 3});

        assertThat(storage.load("k1")).hasValueSatisfying(b -> assertThat(b).containsExactly(1, 2, 3));
        assertThat(storage.load("nope")).isEmpty();
        storage.delete("k1");
        storage.delete("k1"); // idempotent
        assertThat(storage.load("k1")).isEmpty();
    }

    @Test
    void storedBytesCannotBeMutatedThroughTheCallerOrTheResult() {
        byte[] in = {1, 2, 3};
        storage.store("c1", "k1", in);
        in[0] = 99;
        byte[] out = storage.load("k1").orElseThrow();
        out[1] = 99;

        assertThat(storage.load("k1").orElseThrow()).containsExactly(1, 2, 3);
    }

    @Test
    void aKeyIsNeverOverwritten() {
        storage.store("c1", "k1", new byte[] {1});

        assertThatThrownBy(() -> storage.store("c1", "k1", new byte[] {2}))
                .isInstanceOfSatisfying(ProofStorageException.class,
                        e -> assertThat(e.reason()).isEqualTo(ProofStorageException.Reason.DUPLICATE_KEY));
        assertThat(storage.load("k1").orElseThrow()).containsExactly(1);
    }
}
