package com.armakers3d.shared.persistence;

import java.util.HashMap;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Cached read of a small reference table of the physical model (estado_pedido, prioridad_incidencia,
 * estado_incidencia) that maps the name of a Java enum constant to its row id and back. The rows are seeded by the
 * Flyway migrations and never change at runtime, so they are loaded once, on first use.
 */
public final class LookupTable {

    private final JdbcTemplate jdbc;
    private final String sql;
    private final String table;
    private volatile Map<String, Long> idByName;
    private volatile Map<Long, String> nameById;

    public LookupTable(JdbcTemplate jdbc, String table, String idColumn, String nameColumn) {
        this.jdbc = jdbc;
        this.table = table;
        this.sql = "select " + idColumn + ", " + nameColumn + " from " + table;
    }

    public Long idOf(Enum<?> constant) {
        Long id = load().get(constant.name());
        if (id == null) {
            throw new IllegalStateException("Reference row '" + constant.name() + "' is missing in table " + table);
        }
        return id;
    }

    public <E extends Enum<E>> E valueOf(Class<E> type, Long id) {
        String name = nameById.get(id);
        if (name == null) {
            load();
            name = nameById.get(id);
        }
        if (name == null) {
            throw new IllegalStateException("Unknown id " + id + " in table " + table);
        }
        return Enum.valueOf(type, name);
    }

    private Map<String, Long> load() {
        Map<String, Long> current = idByName;
        if (current == null) {
            Map<String, Long> ids = new HashMap<>();
            Map<Long, String> names = new HashMap<>();
            jdbc.query(sql, rs -> {
                ids.put(rs.getString(2), rs.getLong(1));
                names.put(rs.getLong(1), rs.getString(2));
            });
            nameById = Map.copyOf(names);
            idByName = current = Map.copyOf(ids);
        }
        return current;
    }
}
