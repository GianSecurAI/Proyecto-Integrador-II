package com.armakers3d.payments.controller;

import com.armakers3d.payments.service.ProofContent;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/**
 * The ONE way a payment proof leaves the API (ADR-005). The Content-Type comes from the type detected from the
 * bytes at upload time; the file name is fixed (never client-controlled); the response can never be sniffed,
 * cached or executed: nosniff, private+no-store, and a CSP that forbids everything plus sandbox, so even a file that
 * slipped through validation could not run script in the API origin.
 */
final class ProofResponses {

    private ProofResponses() {}

    static ResponseEntity<byte[]> inline(ProofContent proof) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(proof.type().contentType()))
                .contentLength(proof.bytes().length)
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .header("Content-Security-Policy", "default-src 'none'; sandbox")
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"payment-proof." + proof.type().extension() + "\"")
                .body(proof.bytes());
    }
}
