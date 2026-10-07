package com.armakers3d.payments.service.exception;

import com.armakers3d.shared.error.ConflictException;

/** The customer already uploaded the maximum number of proofs for this checkout (409 PROOF_ATTEMPTS_EXCEEDED). */
public class ProofAttemptsExceededException extends ConflictException {

    public ProofAttemptsExceededException() {
        super("PROOF_ATTEMPTS_EXCEEDED", "The maximum number of payment proofs for this checkout was reached.");
    }
}
