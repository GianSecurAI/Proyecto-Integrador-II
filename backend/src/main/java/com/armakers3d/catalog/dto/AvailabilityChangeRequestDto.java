package com.armakers3d.catalog.dto;

import jakarta.validation.constraints.NotNull;

/** Contract review E13 body. */
public record AvailabilityChangeRequestDto(@NotNull Boolean available) {}
