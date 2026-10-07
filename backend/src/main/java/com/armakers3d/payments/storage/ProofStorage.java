package com.armakers3d.payments.storage;

import java.util.Optional;

/**
 * Port for the bytes of uploaded payment proofs (ADR-005). The key is a random UUID chosen by the service; a
 * client-supplied name never reaches an adapter, so there is no path to traverse. Behavior every adapter must have:
 * {@code store} refuses (throws {@link ProofStorageException}) instead of overwriting or growing without bound;
 * {@code load} is empty for unknown keys; {@code delete} is idempotent. The in-memory adapter is for dev/test only
 * ({@code app.persistence.proofs=memory}, refused outside local/nodb/test by {@code InMemoryStorageGuard}); the DB
 * or cloud-blob adapter arrives with the database phase. Content type is not stored here: the aggregate keeps the
 * type detected from the bytes.
 */
public interface ProofStorage {

    /** @throws ProofStorageException when a configured capacity limit would be exceeded or the key already exists */
    void store(String checkoutId, String key, byte[] content);

    Optional<byte[]> load(String key);

    void delete(String key);
}
