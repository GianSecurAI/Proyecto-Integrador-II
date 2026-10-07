package com.armakers3d.payments.service.exception;

import com.armakers3d.shared.error.ApiException;
import org.springframework.http.HttpStatus;

/** The file content is not a JPEG, PNG or WebP image (415 UNSUPPORTED_IMAGE_TYPE); decided from the bytes, not the declared type. */
public class UnsupportedProofImageTypeException extends ApiException {

    public UnsupportedProofImageTypeException() {
        super(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_IMAGE_TYPE", "Only JPEG, PNG or WebP images are accepted.");
    }
}
