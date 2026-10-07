package com.armakers3d.payments.service.exception;

import com.armakers3d.shared.error.ApiException;
import org.springframework.http.HttpStatus;

/** The proof storage cannot take more files right now (503 PROOF_STORAGE_UNAVAILABLE); the customer can retry later. */
public class ProofStorageUnavailableException extends ApiException {

    public ProofStorageUnavailableException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "PROOF_STORAGE_UNAVAILABLE",
                "Payment proofs cannot be received right now. Please try again later.");
    }
}
