package com.armakers3d.catalog.dto;

/** Read-only image reference; the list is always empty in v1 (decision D-12). */
public record ProductImageDto(String url, String alt) {}
