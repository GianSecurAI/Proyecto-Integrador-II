package com.armakers3d.payments.domain;

import java.time.Instant;

/**
 * One uploaded payment proof (immutable). {@code storageKey} is a random UUID that points into the
 * {@code ProofStorage}; the client's file name is never kept. {@code sha256} is the hex digest of the stored bytes
 * (used to flag the same screenshot submitted for another checkout). {@code operationCode} is what the customer
 * typed (optional, unverified). The decision fields are set by the administrator.
 */
public record ProofAttempt(
        String id,
        int number,
        PaymentMethod method,
        String operationCode,
        String storageKey,
        ProofImageType type,
        long sizeBytes,
        String sha256,
        Instant submittedAt,
        ProofDecision decision,
        Long decidedBy,
        Instant decidedAt,
        String rejectionReason) {

    public static ProofAttempt submitted(
            String id, int number, PaymentMethod method, String operationCode, String storageKey, ProofImageType type,
            long sizeBytes, String sha256, Instant now) {
        return new ProofAttempt(id, number, method, operationCode, storageKey, type, sizeBytes, sha256, now,
                ProofDecision.PENDING, null, null, null);
    }

    ProofAttempt approvedBy(Long adminId, Instant now) {
        return new ProofAttempt(id, number, method, operationCode, storageKey, type, sizeBytes, sha256, submittedAt,
                ProofDecision.APPROVED, adminId, now, null);
    }

    ProofAttempt rejectedBy(Long adminId, String reason, Instant now) {
        return new ProofAttempt(id, number, method, operationCode, storageKey, type, sizeBytes, sha256, submittedAt,
                ProofDecision.REJECTED, adminId, now, reason);
    }
}
