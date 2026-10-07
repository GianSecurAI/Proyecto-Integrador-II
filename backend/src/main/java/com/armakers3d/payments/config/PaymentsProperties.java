package com.armakers3d.payments.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Payments configuration ({@code app.payments.*}), all externalized (Principle XIV/XVIII). There is no payment
 * provider and therefore no credential or secret anywhere (ADR-005): the customer uploads a Yape/Plin screenshot
 * and an administrator verifies it.
 */
@ConfigurationProperties(prefix = "app.payments")
public class PaymentsProperties {

    /** A checkout without any proof expires after this many hours. Once a proof exists it never expires. */
    private int checkoutTtlHours = 24;
    /** Max open (not terminal, not expired) checkouts per customer (ADR-004 D4). */
    private int maxOpenCheckouts = 3;
    /** Max proofs a customer may upload for one checkout (the first plus re-uploads after rejections). */
    private int maxProofAttempts = 5;
    /** Runs the 5-minute expiry job. */
    private boolean expiryJobEnabled = true;

    private final Proof proof = new Proof();

    public static class Proof {
        /** Largest accepted image. Also bounded by {@code spring.servlet.multipart.max-file-size}. */
        private long maxBytes = 5L * 1024 * 1024;
        /** In-memory adapter only: total bytes it will hold before refusing new proofs. */
        private long storageMaxTotalBytes = 256L * 1024 * 1024;
        /** In-memory adapter only: bytes it will hold for one checkout. */
        private long storageMaxBytesPerCheckout = 25L * 1024 * 1024;

        public long getMaxBytes() {
            return maxBytes;
        }

        public void setMaxBytes(long maxBytes) {
            this.maxBytes = maxBytes;
        }

        public long getStorageMaxTotalBytes() {
            return storageMaxTotalBytes;
        }

        public void setStorageMaxTotalBytes(long storageMaxTotalBytes) {
            this.storageMaxTotalBytes = storageMaxTotalBytes;
        }

        public long getStorageMaxBytesPerCheckout() {
            return storageMaxBytesPerCheckout;
        }

        public void setStorageMaxBytesPerCheckout(long storageMaxBytesPerCheckout) {
            this.storageMaxBytesPerCheckout = storageMaxBytesPerCheckout;
        }
    }

    public int getCheckoutTtlHours() {
        return checkoutTtlHours;
    }

    public void setCheckoutTtlHours(int checkoutTtlHours) {
        this.checkoutTtlHours = checkoutTtlHours;
    }

    public int getMaxOpenCheckouts() {
        return maxOpenCheckouts;
    }

    public void setMaxOpenCheckouts(int maxOpenCheckouts) {
        this.maxOpenCheckouts = maxOpenCheckouts;
    }

    public int getMaxProofAttempts() {
        return maxProofAttempts;
    }

    public void setMaxProofAttempts(int maxProofAttempts) {
        this.maxProofAttempts = maxProofAttempts;
    }

    public boolean isExpiryJobEnabled() {
        return expiryJobEnabled;
    }

    public void setExpiryJobEnabled(boolean expiryJobEnabled) {
        this.expiryJobEnabled = expiryJobEnabled;
    }

    public Proof getProof() {
        return proof;
    }
}
