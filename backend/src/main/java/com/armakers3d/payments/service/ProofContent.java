package com.armakers3d.payments.service;

import com.armakers3d.payments.domain.ProofImageType;

/** Bytes of a stored proof and the type DETECTED from them at upload time (the only source of the served Content-Type). */
public record ProofContent(byte[] bytes, ProofImageType type) {}
