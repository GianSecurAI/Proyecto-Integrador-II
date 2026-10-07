package com.armakers3d.payments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.armakers3d.payments.infrastructure.inmemory.InMemoryProofStorage;
import com.armakers3d.payments.storage.ProofStorageException;
import org.junit.jupiter.api.Test;

/** Port behavior of the in-memory proof storage: bounded, copy-safe, idempotent delete (the contract a DB/blob adapter must meet). */
class InMemoryProofStorageTest {

    @Test
    void storesLoadsAndDeletesAndLoadOfUnknownKeyIsEmpty() {
        var storage = new InMemoryProofStorage(1000, 500);
        storage.store("c1", "k1", new byte[] {1, 2, 3});
        assertThat(storage.load("k1")).hasValueSatisfying(b -> assertThat(b).containsExactly(1, 2, 3));
        assertThat(storage.load("nope")).isEmpty();
        storage.delete("k1");
        storage.delete("k1"); // idempotent
        assertThat(storage.load("k1")).isEmpty();
        assertThat(storage.totalBytes()).isZero();
    }

    @Test
    void storedBytesCannotBeMutatedThroughTheCallerOrTheResult() {
        var storage = new InMemoryProofStorage(1000, 500);
        byte[] in = {1, 2, 3};
        storage.store("c1", "k1", in);
        in[0] = 99;
        byte[] out = storage.load("k1").orElseThrow();
        out[1] = 99;
        assertThat(storage.load("k1").orElseThrow()).containsExactly(1, 2, 3);
    }

    @Test
    void theTotalCapRefusesAndFreedSpaceIsReusable() {
        var storage = new InMemoryProofStorage(100, 100);
        storage.store("c1", "k1", new byte[60]);
        assertThatThrownBy(() -> storage.store("c2", "k2", new byte[60]))
                .isInstanceOfSatisfying(ProofStorageException.class, e -> assertThat(e.reason()).isEqualTo(ProofStorageException.Reason.TOTAL_CAPACITY));
        storage.delete("k1");
        storage.store("c2", "k2", new byte[60]);
        assertThat(storage.totalBytes()).isEqualTo(60);
    }

    @Test
    void thePerCheckoutCapRefusesOnlyThatCheckout() {
        var storage = new InMemoryProofStorage(1000, 100);
        storage.store("c1", "k1", new byte[60]);
        assertThatThrownBy(() -> storage.store("c1", "k2", new byte[60]))
                .isInstanceOfSatisfying(ProofStorageException.class, e -> assertThat(e.reason()).isEqualTo(ProofStorageException.Reason.CHECKOUT_CAPACITY));
        storage.store("c2", "k3", new byte[60]); // another checkout is unaffected
        storage.delete("k1");
        storage.store("c1", "k4", new byte[60]); // deleting frees the checkout budget
    }

    @Test
    void aKeyIsNeverOverwritten() {
        var storage = new InMemoryProofStorage(1000, 1000);
        storage.store("c1", "k1", new byte[] {1});
        assertThatThrownBy(() -> storage.store("c1", "k1", new byte[] {2}))
                .isInstanceOfSatisfying(ProofStorageException.class, e -> assertThat(e.reason()).isEqualTo(ProofStorageException.Reason.DUPLICATE_KEY));
        assertThat(storage.load("k1").orElseThrow()).containsExactly(1);
    }
}
