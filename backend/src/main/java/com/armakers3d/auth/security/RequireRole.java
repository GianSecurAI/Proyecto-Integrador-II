package com.armakers3d.auth.security;

import com.armakers3d.auth.domain.Rol;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a controller method (or class) as requiring an authenticated session whose role is one
 * of the listed values (Constitution Principle VII: explicit role check on every protected
 * endpoint, never a generic "is-staff" flag). Enforced by {@link RoleAuthorizationInterceptor}.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD, ElementType.TYPE})
public @interface RequireRole {

    Rol[] value();
}
