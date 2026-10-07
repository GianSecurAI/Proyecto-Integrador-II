package com.armakers3d.payments.storage;

/** A {@link ProofStorage} refused to store a proof. {@link Reason} lets the service pick the right HTTP answer. */
public class ProofStorageException extends RuntimeException {

    public enum Reason {
        /** The adapter as a whole is full: nothing can be uploaded until space is freed (503). */
        TOTAL_CAPACITY,
        /** This checkout already holds as many bytes as allowed (413). */
        CHECKOUT_CAPACITY,
        /** A proof with this key already exists (cannot happen with random keys; never overwrite). */
        DUPLICATE_KEY
    }

    private final Reason reason;

    public ProofStorageException(Reason reason) {
        super(reason.name()); // no checkout id, key or content in the message
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}
