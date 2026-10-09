package com.armakers3d.users.controller;

import com.armakers3d.auth.domain.Rol;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/roles")
@Tag(name = "Roles (admin)", description = "Roles of the system and the permissions assigned to each (RF03).")
public class AdminRoleController {

    public record RoleDto(String name, String description, List<String> permissions) {}

    private final ObjectProvider<JdbcTemplate> jdbcProvider;

    public AdminRoleController(ObjectProvider<JdbcTemplate> jdbcProvider) {
        this.jdbcProvider = jdbcProvider;
    }

    @GetMapping
    @Operation(
            summary = "Roles and their permissions",
            description = "Read from the rol, permiso and rol_permiso tables. A user's role is changed with"
                    + " PATCH /api/admin/users/{id}/role; access to each endpoint is enforced by the central role matrix.")
    public List<RoleDto> roles() {
        JdbcTemplate jdbc = jdbcProvider.getIfAvailable();
        if (jdbc == null) {
            return Arrays.stream(Rol.values()).map(r -> new RoleDto(r.name(), null, List.of())).toList();
        }
        Map<String, RoleDto> byName = new LinkedHashMap<>();
        jdbc.query(
                "select r.nombre, r.descripcion, p.nombre from rol r"
                        + " left join rol_permiso rp on rp.id_rol = r.id_rol"
                        + " left join permiso p on p.id_permiso = rp.id_permiso"
                        + " where r.estado order by r.id_rol, p.nombre",
                rs -> {
                    RoleDto role = byName.computeIfAbsent(
                            rs.getString(1), n -> {
                                try {
                                    return new RoleDto(n, rs.getString(2), new ArrayList<>());
                                } catch (java.sql.SQLException e) {
                                    throw new IllegalStateException(e);
                                }
                            });
                    String permission = rs.getString(3);
                    if (permission != null) {
                        role.permissions().add(permission);
                    }
                });
        return List.copyOf(byName.values());
    }
}
