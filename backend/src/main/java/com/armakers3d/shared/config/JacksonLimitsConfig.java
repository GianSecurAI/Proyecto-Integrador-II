package com.armakers3d.shared.config;

import com.fasterxml.jackson.core.StreamReadConstraints;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Hard limits on what the JSON parser will read (security review, input validation / DoS). The public OTP
 * endpoints parse a body before any authentication or field validation, and Jackson's defaults allow a
 * single 20 million character string or 1000 levels of nesting. Every legitimate body in this API is a few
 * hundred bytes (the largest field is a 2000 character product description), so these limits are generous
 * for real use and make hostile bodies fail fast as 400 MALFORMED_REQUEST instead of being buffered.
 */
@Configuration
public class JacksonLimitsConfig {

    static final int MAX_STRING_LENGTH = 20_000;
    static final int MAX_NESTING_DEPTH = 32;
    static final long MAX_DOCUMENT_LENGTH = 262_144;

    @Bean
    Jackson2ObjectMapperBuilderCustomizer jsonReadLimits() {
        return builder -> builder.postConfigurer(mapper -> mapper.getFactory()
                .setStreamReadConstraints(StreamReadConstraints.builder()
                        .maxStringLength(MAX_STRING_LENGTH)
                        .maxNestingDepth(MAX_NESTING_DEPTH)
                        .maxDocumentLength(MAX_DOCUMENT_LENGTH)
                        .build()));
    }
}
