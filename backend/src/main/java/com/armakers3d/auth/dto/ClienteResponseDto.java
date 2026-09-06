package com.armakers3d.auth.dto;

import com.armakers3d.auth.domain.Rol;
import java.time.Instant;

/**
 * DTO returned by the sample protected customer endpoints (T051). Controllers never return the
 * {@code Cliente} JPA entity directly (Constitution Principle IV).
 */
public record ClienteResponseDto(Long id, String email, Rol rol, Instant createdAt) {}
