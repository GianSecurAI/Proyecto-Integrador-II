package com.armakers3d.payments.domain;

/**
 * Image formats accepted as payment proof, decided from the file CONTENT (magic bytes), never from the client's
 * Content-Type or filename. The served Content-Type is derived from this value only.
 */
public enum ProofImageType {
    JPEG("image/jpeg", "jpg"),
    PNG("image/png", "png"),
    WEBP("image/webp", "webp");

    private final String contentType;
    private final String extension;

    ProofImageType(String contentType, String extension) {
        this.contentType = contentType;
        this.extension = extension;
    }

    public String contentType() {
        return contentType;
    }

    /** Fixed file name extension used in the Content-Disposition of served proofs. */
    public String extension() {
        return extension;
    }
}
