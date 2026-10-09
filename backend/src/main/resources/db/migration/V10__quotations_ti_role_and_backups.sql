-- V10: quotation management (RF08, RF09, RF11), the "Responsable de TI" role (RF18) and the backup log.

-- Quotation: who registered it and when it last changed (the document model keeps date, state, price and notes).
ALTER TABLE cotizacion ADD COLUMN registrado_por BIGINT;
ALTER TABLE cotizacion ADD COLUMN fecha_actualizacion TIMESTAMP;
ALTER TABLE cotizacion ADD CONSTRAINT fk_cotizacion_registrado_por FOREIGN KEY (registrado_por) REFERENCES usuario (id_usuario);
CREATE INDEX ix_cotizacion_estado_fecha ON cotizacion (estado, fecha_cotizacion);

-- Role and permissions of the IT officer (monitoring, availability and backups).
INSERT INTO rol (nombre, descripcion, estado) VALUES ('RESPONSABLE_TI', 'Responsable de TI: monitoreo, disponibilidad y respaldo', TRUE);

INSERT INTO permiso (nombre, descripcion) VALUES ('COTIZACION_GESTIONAR', 'Registrar cotizaciones acordadas, actualizar su estado y generar el pedido');
INSERT INTO permiso (nombre, descripcion) VALUES ('PEDIDO_RECOMPRAR', 'Volver a comprar productos del historial de pedidos propio');
INSERT INTO permiso (nombre, descripcion) VALUES ('MONITOREO_VER', 'Consultar el estado, la disponibilidad y los indicadores del sistema');
INSERT INTO permiso (nombre, descripcion) VALUES ('RESPALDO_GESTIONAR', 'Consultar y registrar los respaldos de la base de datos y sus pruebas de restauracion');

INSERT INTO rol_permiso (id_rol, id_permiso)
    SELECT r.id_rol, p.id_permiso FROM rol r, permiso p
    WHERE r.nombre = 'CLIENTE' AND p.nombre = 'PEDIDO_RECOMPRAR';
INSERT INTO rol_permiso (id_rol, id_permiso)
    SELECT r.id_rol, p.id_permiso FROM rol r, permiso p
    WHERE r.nombre IN ('ASESOR', 'ADMINISTRADOR') AND p.nombre = 'COTIZACION_GESTIONAR';
INSERT INTO rol_permiso (id_rol, id_permiso)
    SELECT r.id_rol, p.id_permiso FROM rol r, permiso p
    WHERE r.nombre IN ('RESPONSABLE_TI', 'ADMINISTRADOR') AND p.nombre IN ('MONITOREO_VER', 'RESPALDO_GESTIONAR');

-- Backup log: automatic or manual backups of the managed database and the restore tests that verified them.
CREATE TABLE respaldo_registro (
    id_respaldo             BIGSERIAL PRIMARY KEY,
    fecha_respaldo          TIMESTAMP    NOT NULL,
    tipo                    VARCHAR(20)  NOT NULL,
    resultado               VARCHAR(20)  NOT NULL,
    restauracion_verificada BOOLEAN      NOT NULL DEFAULT FALSE,
    detalle                 VARCHAR(500),
    id_usuario_registro     BIGINT       NOT NULL,
    fecha_registro          TIMESTAMP    NOT NULL,
    CONSTRAINT fk_respaldo_usuario FOREIGN KEY (id_usuario_registro) REFERENCES usuario (id_usuario),
    CONSTRAINT chk_respaldo_tipo CHECK (tipo IN ('AUTOMATICO', 'MANUAL')),
    CONSTRAINT chk_respaldo_resultado CHECK (resultado IN ('EXITOSO', 'FALLIDO'))
);

CREATE INDEX ix_respaldo_fecha ON respaldo_registro (fecha_respaldo DESC);
