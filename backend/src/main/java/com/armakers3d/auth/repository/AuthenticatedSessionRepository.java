package com.armakers3d.auth.repository;

import com.armakers3d.auth.domain.AuthenticatedSession;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthenticatedSessionRepository extends JpaRepository<AuthenticatedSession, String> {}
