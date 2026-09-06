package com.armakers3d.auth.security;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.shared.error.ForbiddenException;
import com.armakers3d.shared.error.UnauthenticatedException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Arrays;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Enforces {@link RequireRole} on every matching controller method (Constitution Principle VII,
 * NON-NEGOTIABLE): no session at all -&gt; 401; a session with the wrong role -&gt; 403.
 * Object-level checks (a customer reading another customer's resource) are enforced separately,
 * inside the controller method itself, since only the controller knows which path variable
 * identifies the resource owner.
 */
@Component
public class RoleAuthorizationInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }

        RequireRole requireRole = handlerMethod.getMethodAnnotation(RequireRole.class);
        if (requireRole == null) {
            requireRole = handlerMethod.getBeanType().getAnnotation(RequireRole.class);
        }
        if (requireRole == null) {
            return true;
        }

        Object clienteId = request.getAttribute(SessionAuthenticationFilter.ATTR_CLIENTE_ID);
        Object rol = request.getAttribute(SessionAuthenticationFilter.ATTR_ROL);
        if (clienteId == null || rol == null) {
            throw new UnauthenticatedException();
        }

        boolean permitted = Arrays.asList(requireRole.value()).contains((Rol) rol);
        if (!permitted) {
            throw new ForbiddenException("This capability is not available for your role.");
        }
        return true;
    }
}
