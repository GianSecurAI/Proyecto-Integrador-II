package com.armakers3d.payments.infrastructure.inmemory;

import com.armakers3d.payments.config.PaymentsProperties;
import com.armakers3d.payments.storage.ProofStorage;
import com.armakers3d.payments.storage.ProofStorageException;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * In-memory {@link ProofStorage}. NOT durable and per instance: selected by {@code app.persistence.proofs=memory};
 * {@code InMemoryStorageGuard} refuses to boot it outside local/nodb/test. Bounded: a total byte cap and a per
 * checkout byte cap, so a client cannot exhaust the heap by uploading images. Stored arrays are copied in and out
 * so a caller cannot mutate what is stored.
 */
@Component
@ConditionalOnProperty(name = "app.persistence.proofs", havingValue = "memory", matchIfMissing = true)
public class InMemoryProofStorage implements ProofStorage {

    private record Entry(String checkoutId, byte[] content) {}

    private final Map<String, Entry> byKey = new HashMap<>();
    private final Map<String, Long> bytesPerCheckout = new HashMap<>();
    private final long maxTotalBytes;
    private final long maxBytesPerCheckout;
    private long totalBytes;

    @Autowired
    public InMemoryProofStorage(PaymentsProperties properties) {
        this(properties.getProof().getStorageMaxTotalBytes(), properties.getProof().getStorageMaxBytesPerCheckout());
    }

    public InMemoryProofStorage(long maxTotalBytes, long maxBytesPerCheckout) {
        this.maxTotalBytes = maxTotalBytes;
        this.maxBytesPerCheckout = maxBytesPerCheckout;
    }

    @Override
    public synchronized void store(String checkoutId, String key, byte[] content) {
        if (byKey.containsKey(key)) {
            throw new ProofStorageException(ProofStorageException.Reason.DUPLICATE_KEY);
        }
        long size = content.length;
        if (totalBytes + size > maxTotalBytes) {
            throw new ProofStorageException(ProofStorageException.Reason.TOTAL_CAPACITY);
        }
        long forCheckout = bytesPerCheckout.getOrDefault(checkoutId, 0L);
        if (forCheckout + size > maxBytesPerCheckout) {
            throw new ProofStorageException(ProofStorageException.Reason.CHECKOUT_CAPACITY);
        }
        byKey.put(key, new Entry(checkoutId, content.clone()));
        totalBytes += size;
        bytesPerCheckout.put(checkoutId, forCheckout + size);
    }

    @Override
    public synchronized Optional<byte[]> load(String key) {
        Entry entry = byKey.get(key);
        return entry == null ? Optional.empty() : Optional.of(entry.content().clone());
    }

    @Override
    public synchronized void delete(String key) {
        Entry removed = byKey.remove(key);
        if (removed != null) {
            totalBytes -= removed.content().length;
            bytesPerCheckout.merge(removed.checkoutId(), -(long) removed.content().length, Long::sum);
        }
    }

    /** Test/diagnostic: bytes currently held. */
    public synchronized long totalBytes() {
        return totalBytes;
    }
}
