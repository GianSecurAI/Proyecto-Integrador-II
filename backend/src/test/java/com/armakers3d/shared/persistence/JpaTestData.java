package com.armakers3d.shared.persistence;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Fixtures for the JPA adapter contract tests. The adapters enforce real foreign keys, while the shared port contracts
 * use fixed customer, staff and product ids (1, 2, 3, 5, 9, 99); this helper creates those rows and removes everything
 * the adapters wrote, so the shared H2 database is left as the other JPA tests expect it (rolled-back or emptied).
 */
public final class JpaTestData {

    public static final List<Long> USER_IDS = List.of(1L, 2L, 3L, 5L, 9L, 99L);

    private JpaTestData() {}

    /** Deletes the business data in foreign-key order and the fixed fixture users. */
    public static void reset(JdbcTemplate jdbc) {
        for (String table : List.of(
                "respaldo_registro",
                "comprobante_imagen",
                "comprobante_pago",
                "checkout_linea",
                "checkout",
                "idempotencia_pedido",
                "incidencia",
                "historial_estado_pedido",
                "detalle_pedido",
                "pedido",
                "detalle_cotizacion",
                "cotizacion",
                "producto_caracteristica",
                "producto")) {
            jdbc.update("delete from " + table);
        }
        for (Long id : USER_IDS) {
            jdbc.update("delete from authenticated_session where usuario_id = ?", id);
            jdbc.update("update codigo_otp set id_usuario = null where id_usuario = ?", id);
            jdbc.update("delete from usuario where id_usuario = ?", id);
        }
    }

    /** Resets, then creates the fixed fixture users (role CLIENTE) and one product with id 1. */
    public static void seed(JdbcTemplate jdbc) {
        reset(jdbc);
        for (Long id : USER_IDS) {
            jdbc.update(
                    "insert into usuario (id_usuario, correo, id_rol, estado, fecha_registro)"
                            + " values (?, ?, (select id_rol from rol where nombre = 'CLIENTE'), true, current_timestamp)",
                    id,
                    "fixture-" + id + "@example.test");
        }
        jdbc.update(
                "insert into producto (id_producto, nombre, descripcion, precio_referencial, estado, fecha_registro,"
                        + " categoria, fecha_actualizacion)"
                        + " values (1, 'Fixture', 'Fixture', 1.00, true, current_timestamp, 'LLAVERO', current_timestamp)");
    }

    /** Inserts a minimal confirmed standard order with the given public code, owned by an existing fixture user. */
    public static void seedOrder(JdbcTemplate jdbc, String code, Long customerId) {
        jdbc.update(
                "insert into pedido (id_cliente, id_estado_pedido, fecha_pedido, total, codigo_pedido, tipo)"
                        + " values (?, (select id_estado_pedido from estado_pedido where nombre = 'CONFIRMADO'),"
                        + " current_timestamp, 1.00, ?, 'ESTANDAR')",
                customerId,
                code);
    }
}
