-- V6: aligns the schema with the physical data model of the official project document (section 5.2.2).
--
--  * `cliente` becomes `usuario` (id_usuario, correo, nombres, apellidos, telefono, direccion, id_rol FK, estado,
--    fecha_registro) and the role moves to the new `rol` table (+ `permiso`, `rol_permiso`).
--  * `codigo_otp` / `authenticated_session` are renamed to the document's column names.
--  * The business tables of the model are created: producto, cotizacion, detalle_cotizacion, estado_pedido, pedido,
--    detalle_pedido, historial_estado_pedido, prioridad_incidencia, estado_incidencia, incidencia.
--
-- Columns that the document does not list but the running application needs (public order/incident codes, delivery and
-- contact data, the checkout link, etc.) are added as clearly named extra columns. Written without PostgreSQL-only
-- syntax so the H2 (PostgreSQL mode) test database can run it unchanged.

-- ---------------------------------------------------------------------------------------------------------------
-- Roles and permissions
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE rol (
    id_rol      BIGSERIAL PRIMARY KEY,
    nombre      VARCHAR(50)  NOT NULL,
    descripcion VARCHAR(200),
    estado      BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_rol_nombre UNIQUE (nombre)
);

CREATE TABLE permiso (
    id_permiso  BIGSERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    descripcion VARCHAR(250),
    CONSTRAINT uq_permiso_nombre UNIQUE (nombre)
);

CREATE TABLE rol_permiso (
    id_rol     BIGINT NOT NULL,
    id_permiso BIGINT NOT NULL,
    CONSTRAINT pk_rol_permiso PRIMARY KEY (id_rol, id_permiso),
    CONSTRAINT fk_rol_permiso_rol FOREIGN KEY (id_rol) REFERENCES rol (id_rol),
    CONSTRAINT fk_rol_permiso_permiso FOREIGN KEY (id_permiso) REFERENCES permiso (id_permiso)
);

-- The role names are the values of the Java enum com.armakers3d.auth.domain.Rol.
INSERT INTO rol (nombre, descripcion, estado) VALUES ('CLIENTE', 'Cliente de Ar Makers 3D', TRUE);
INSERT INTO rol (nombre, descripcion, estado) VALUES ('ASESOR', 'Personal responsable de cotizaciones, pedidos e incidencias', TRUE);
INSERT INTO rol (nombre, descripcion, estado) VALUES ('ADMINISTRADOR', 'Administrador del sistema', TRUE);

INSERT INTO permiso (nombre, descripcion) VALUES ('CATALOGO_VER', 'Consultar el catalogo de productos');
INSERT INTO permiso (nombre, descripcion) VALUES ('CATALOGO_GESTIONAR', 'Registrar, editar y habilitar productos del catalogo');
INSERT INTO permiso (nombre, descripcion) VALUES ('PERFIL_GESTIONAR', 'Consultar y actualizar el perfil propio');
INSERT INTO permiso (nombre, descripcion) VALUES ('CHECKOUT_REALIZAR', 'Comprar productos del catalogo y enviar el comprobante de pago');
INSERT INTO permiso (nombre, descripcion) VALUES ('PEDIDO_VER_PROPIOS', 'Consultar el historial y el estado de los pedidos propios');
INSERT INTO permiso (nombre, descripcion) VALUES ('PEDIDO_GESTIONAR', 'Consultar pedidos y cambiar su estado');
INSERT INTO permiso (nombre, descripcion) VALUES ('PEDIDO_PERSONALIZADO_REGISTRAR', 'Registrar pedidos personalizados con la cotizacion acordada');
INSERT INTO permiso (nombre, descripcion) VALUES ('PAGO_VERIFICAR', 'Aprobar o rechazar comprobantes de pago Yape/Plin');
INSERT INTO permiso (nombre, descripcion) VALUES ('INCIDENCIA_REGISTRAR', 'Registrar incidencias sobre pedidos propios');
INSERT INTO permiso (nombre, descripcion) VALUES ('INCIDENCIA_GESTIONAR', 'Gestionar estado, prioridad y resolucion de incidencias');
INSERT INTO permiso (nombre, descripcion) VALUES ('REPORTE_VER', 'Consultar reportes administrativos');
INSERT INTO permiso (nombre, descripcion) VALUES ('USUARIO_GESTIONAR', 'Administrar usuarios, roles y activacion de cuentas');

INSERT INTO rol_permiso (id_rol, id_permiso)
    SELECT r.id_rol, p.id_permiso FROM rol r, permiso p
    WHERE r.nombre = 'CLIENTE'
      AND p.nombre IN ('CATALOGO_VER', 'PERFIL_GESTIONAR', 'CHECKOUT_REALIZAR', 'PEDIDO_VER_PROPIOS', 'INCIDENCIA_REGISTRAR');
INSERT INTO rol_permiso (id_rol, id_permiso)
    SELECT r.id_rol, p.id_permiso FROM rol r, permiso p
    WHERE r.nombre = 'ASESOR'
      AND p.nombre IN ('CATALOGO_VER', 'PEDIDO_GESTIONAR', 'PEDIDO_PERSONALIZADO_REGISTRAR', 'INCIDENCIA_GESTIONAR');
INSERT INTO rol_permiso (id_rol, id_permiso)
    SELECT r.id_rol, p.id_permiso FROM rol r, permiso p
    WHERE r.nombre = 'ADMINISTRADOR'
      AND p.nombre IN ('CATALOGO_VER', 'CATALOGO_GESTIONAR', 'PEDIDO_GESTIONAR', 'PEDIDO_PERSONALIZADO_REGISTRAR',
                       'PAGO_VERIFICAR', 'INCIDENCIA_GESTIONAR', 'REPORTE_VER', 'USUARIO_GESTIONAR');

-- ---------------------------------------------------------------------------------------------------------------
-- cliente -> usuario
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE cliente RENAME TO usuario;
ALTER TABLE usuario RENAME COLUMN id TO id_usuario;
ALTER TABLE usuario RENAME COLUMN email TO correo;
ALTER TABLE usuario RENAME COLUMN first_name TO nombres;
ALTER TABLE usuario RENAME COLUMN last_name TO apellidos;
ALTER TABLE usuario RENAME COLUMN phone TO telefono;
ALTER TABLE usuario RENAME COLUMN active TO estado;
ALTER TABLE usuario RENAME COLUMN created_at TO fecha_registro;
ALTER TABLE usuario ADD COLUMN direccion VARCHAR(250);
ALTER TABLE usuario RENAME CONSTRAINT uq_cliente_email TO uq_usuario_correo;

ALTER TABLE usuario ADD COLUMN id_rol BIGINT;
UPDATE usuario SET id_rol = (SELECT r.id_rol FROM rol r WHERE r.nombre = usuario.rol);
ALTER TABLE usuario ALTER COLUMN id_rol SET NOT NULL;
ALTER TABLE usuario ADD CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol) REFERENCES rol (id_rol);
ALTER TABLE usuario DROP CONSTRAINT chk_cliente_rol;
ALTER TABLE usuario DROP COLUMN rol;
CREATE INDEX ix_usuario_id_rol ON usuario (id_rol);

ALTER TABLE authenticated_session RENAME COLUMN cliente_id TO usuario_id;
ALTER TABLE authenticated_session RENAME CONSTRAINT fk_authenticated_session_cliente TO fk_authenticated_session_usuario;
DROP INDEX ix_authenticated_session_cliente_id;
CREATE INDEX ix_authenticated_session_usuario_id ON authenticated_session (usuario_id);

-- ---------------------------------------------------------------------------------------------------------------
-- codigo_otp
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE codigo_otp RENAME COLUMN id TO id_otp;
ALTER TABLE codigo_otp RENAME COLUMN code_hash TO codigo_hash;
ALTER TABLE codigo_otp RENAME COLUMN issued_at TO fecha_creacion;
ALTER TABLE codigo_otp RENAME COLUMN expires_at TO fecha_expiracion;
ALTER TABLE codigo_otp RENAME COLUMN attempt_count TO intentos;
ALTER TABLE codigo_otp RENAME COLUMN used_at TO fecha_uso;
-- The document links the code to an existing user; an OTP can be requested before the account exists (anti-enumeration,
-- the account is created on the first successful verification), so the link is nullable and `correo` stays as the key.
ALTER TABLE codigo_otp RENAME COLUMN email TO correo;
ALTER TABLE codigo_otp ADD COLUMN id_usuario BIGINT;
ALTER TABLE codigo_otp ADD COLUMN utilizado BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE codigo_otp SET utilizado = TRUE WHERE status = 'VERIFIED';
UPDATE codigo_otp SET id_usuario = (SELECT u.id_usuario FROM usuario u WHERE u.correo = codigo_otp.correo);
ALTER TABLE codigo_otp ADD CONSTRAINT fk_codigo_otp_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario);
DROP INDEX ix_codigo_otp_email_issued_at;
DROP INDEX ix_codigo_otp_email_status;
CREATE INDEX ix_codigo_otp_correo_fecha_creacion ON codigo_otp (correo, fecha_creacion DESC);
CREATE INDEX ix_codigo_otp_correo_status ON codigo_otp (correo, status);

-- ---------------------------------------------------------------------------------------------------------------
-- producto
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE producto (
    id_producto        BIGSERIAL PRIMARY KEY,
    nombre             VARCHAR(150)  NOT NULL,
    descripcion        TEXT,
    precio_referencial NUMERIC(10,2),
    imagen_url         VARCHAR(500),
    stock_disponible   INTEGER,
    estado             BOOLEAN       NOT NULL,
    fecha_registro     TIMESTAMP     NOT NULL,
    -- extra: catalog classification and last update used by the application
    categoria          VARCHAR(30)   NOT NULL,
    subcategoria       VARCHAR(80),
    fecha_actualizacion TIMESTAMP    NOT NULL,
    CONSTRAINT chk_producto_precio CHECK (precio_referencial IS NULL OR precio_referencial >= 0),
    CONSTRAINT chk_producto_stock CHECK (stock_disponible IS NULL OR stock_disponible >= 0)
);

CREATE TABLE producto_caracteristica (
    id_producto BIGINT       NOT NULL,
    orden       INTEGER      NOT NULL,
    texto       VARCHAR(200) NOT NULL,
    CONSTRAINT pk_producto_caracteristica PRIMARY KEY (id_producto, orden),
    CONSTRAINT fk_producto_caracteristica_producto FOREIGN KEY (id_producto) REFERENCES producto (id_producto)
);

CREATE INDEX ix_producto_estado_categoria ON producto (estado, categoria);

-- ---------------------------------------------------------------------------------------------------------------
-- cotizacion / detalle_cotizacion
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE cotizacion (
    id_cotizacion   BIGSERIAL PRIMARY KEY,
    id_cliente      BIGINT        NOT NULL,
    descripcion     TEXT          NOT NULL,
    precio_acordado NUMERIC(10,2) NOT NULL,
    estado          VARCHAR(30)   NOT NULL,
    fecha_cotizacion TIMESTAMP    NOT NULL,
    observaciones   TEXT,
    CONSTRAINT fk_cotizacion_cliente FOREIGN KEY (id_cliente) REFERENCES usuario (id_usuario),
    CONSTRAINT chk_cotizacion_precio CHECK (precio_acordado >= 0),
    CONSTRAINT chk_cotizacion_estado CHECK (estado IN ('REGISTRADA', 'ACEPTADA', 'RECHAZADA', 'VENCIDA'))
);

CREATE TABLE detalle_cotizacion (
    id_detalle_cotizacion      BIGSERIAL PRIMARY KEY,
    id_cotizacion              BIGINT  NOT NULL,
    descripcion_personalizacion TEXT   NOT NULL,
    cantidad                   INTEGER NOT NULL,
    observaciones              TEXT,
    CONSTRAINT fk_detalle_cotizacion_cotizacion FOREIGN KEY (id_cotizacion) REFERENCES cotizacion (id_cotizacion),
    CONSTRAINT chk_detalle_cotizacion_cantidad CHECK (cantidad > 0)
);

CREATE INDEX ix_cotizacion_cliente ON cotizacion (id_cliente);
CREATE INDEX ix_detalle_cotizacion_cotizacion ON detalle_cotizacion (id_cotizacion);

-- ---------------------------------------------------------------------------------------------------------------
-- estado_pedido / pedido / detalle_pedido / historial_estado_pedido
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE estado_pedido (
    id_estado_pedido BIGSERIAL PRIMARY KEY,
    nombre           VARCHAR(50) NOT NULL,
    descripcion      VARCHAR(200),
    CONSTRAINT uq_estado_pedido_nombre UNIQUE (nombre)
);

-- Values of com.armakers3d.orders.domain.OrderStatus (final order lifecycle, ADR-004).
INSERT INTO estado_pedido (nombre, descripcion) VALUES ('CONFIRMADO', 'Pedido confirmado con el pago verificado');
INSERT INTO estado_pedido (nombre, descripcion) VALUES ('EN_PRODUCCION', 'Pedido en produccion (impresion)');
INSERT INTO estado_pedido (nombre, descripcion) VALUES ('ENVIADO', 'Pedido entregado al courier');
INSERT INTO estado_pedido (nombre, descripcion) VALUES ('ENTREGADO', 'Pedido entregado al cliente');
INSERT INTO estado_pedido (nombre, descripcion) VALUES ('CANCELADO', 'Pedido cancelado por el personal');

CREATE TABLE pedido (
    id_pedido        BIGSERIAL PRIMARY KEY,
    id_cliente       BIGINT        NOT NULL,
    id_cotizacion    BIGINT,
    id_estado_pedido BIGINT        NOT NULL,
    fecha_pedido     TIMESTAMP     NOT NULL,
    total            NUMERIC(10,2),
    observaciones    TEXT,
    -- extra: public order code, kind, who registered it, delivery/contact data and the originating checkout
    codigo_pedido    VARCHAR(30)   NOT NULL,
    tipo             VARCHAR(20)   NOT NULL,
    registrado_por   BIGINT,
    entrega_direccion VARCHAR(200),
    entrega_distrito VARCHAR(80),
    entrega_notas    VARCHAR(300),
    contacto_nombre  VARCHAR(150),
    contacto_telefono VARCHAR(20),
    id_checkout      VARCHAR(36),
    referencia_pago  VARCHAR(30),
    CONSTRAINT uq_pedido_codigo UNIQUE (codigo_pedido),
    CONSTRAINT uq_pedido_cotizacion UNIQUE (id_cotizacion),
    CONSTRAINT uq_pedido_checkout UNIQUE (id_checkout),
    CONSTRAINT fk_pedido_cliente FOREIGN KEY (id_cliente) REFERENCES usuario (id_usuario),
    CONSTRAINT fk_pedido_cotizacion FOREIGN KEY (id_cotizacion) REFERENCES cotizacion (id_cotizacion),
    CONSTRAINT fk_pedido_estado FOREIGN KEY (id_estado_pedido) REFERENCES estado_pedido (id_estado_pedido),
    CONSTRAINT fk_pedido_registrado_por FOREIGN KEY (registrado_por) REFERENCES usuario (id_usuario),
    CONSTRAINT chk_pedido_total CHECK (total IS NULL OR total >= 0),
    CONSTRAINT chk_pedido_tipo CHECK (tipo IN ('ESTANDAR', 'PERSONALIZADO'))
);

CREATE TABLE detalle_pedido (
    id_detalle_pedido BIGSERIAL PRIMARY KEY,
    id_pedido         BIGINT        NOT NULL,
    id_producto       BIGINT,
    descripcion       TEXT,
    cantidad          INTEGER       NOT NULL,
    precio_unitario   NUMERIC(10,2) NOT NULL,
    subtotal          NUMERIC(10,2) NOT NULL,
    CONSTRAINT fk_detalle_pedido_pedido FOREIGN KEY (id_pedido) REFERENCES pedido (id_pedido),
    CONSTRAINT fk_detalle_pedido_producto FOREIGN KEY (id_producto) REFERENCES producto (id_producto),
    CONSTRAINT chk_detalle_pedido_cantidad CHECK (cantidad > 0),
    CONSTRAINT chk_detalle_pedido_precio CHECK (precio_unitario >= 0),
    CONSTRAINT chk_detalle_pedido_subtotal CHECK (subtotal >= 0)
);

CREATE TABLE historial_estado_pedido (
    id_historial           BIGSERIAL PRIMARY KEY,
    id_pedido              BIGINT    NOT NULL,
    id_estado_pedido       BIGINT    NOT NULL,
    fecha_cambio           TIMESTAMP NOT NULL,
    observacion            TEXT,
    id_usuario_responsable BIGINT,
    -- extra: previous state (NULL for the first entry) and the role of the responsible at that moment
    id_estado_anterior     BIGINT,
    rol_responsable        VARCHAR(20),
    CONSTRAINT fk_historial_pedido FOREIGN KEY (id_pedido) REFERENCES pedido (id_pedido),
    CONSTRAINT fk_historial_estado FOREIGN KEY (id_estado_pedido) REFERENCES estado_pedido (id_estado_pedido),
    CONSTRAINT fk_historial_estado_anterior FOREIGN KEY (id_estado_anterior) REFERENCES estado_pedido (id_estado_pedido),
    CONSTRAINT fk_historial_responsable FOREIGN KEY (id_usuario_responsable) REFERENCES usuario (id_usuario)
);

CREATE INDEX ix_pedido_cliente ON pedido (id_cliente, fecha_pedido DESC);
CREATE INDEX ix_pedido_estado_fecha ON pedido (id_estado_pedido, fecha_pedido);
CREATE INDEX ix_detalle_pedido_pedido ON detalle_pedido (id_pedido);
CREATE INDEX ix_historial_pedido_fecha ON historial_estado_pedido (id_pedido, fecha_cambio);

CREATE SEQUENCE seq_codigo_pedido START WITH 1 INCREMENT BY 1;

-- ---------------------------------------------------------------------------------------------------------------
-- prioridad_incidencia / estado_incidencia / incidencia
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE prioridad_incidencia (
    id_prioridad BIGSERIAL PRIMARY KEY,
    nombre       VARCHAR(30) NOT NULL,
    CONSTRAINT uq_prioridad_incidencia_nombre UNIQUE (nombre)
);

CREATE TABLE estado_incidencia (
    id_estado_incidencia BIGSERIAL PRIMARY KEY,
    nombre               VARCHAR(50) NOT NULL,
    CONSTRAINT uq_estado_incidencia_nombre UNIQUE (nombre)
);

-- Values of IncidentPriority and IncidentStatus.
INSERT INTO prioridad_incidencia (nombre) VALUES ('BAJA');
INSERT INTO prioridad_incidencia (nombre) VALUES ('MEDIA');
INSERT INTO prioridad_incidencia (nombre) VALUES ('ALTA');
INSERT INTO estado_incidencia (nombre) VALUES ('ABIERTA');
INSERT INTO estado_incidencia (nombre) VALUES ('EN_REVISION');
INSERT INTO estado_incidencia (nombre) VALUES ('RESUELTA');
INSERT INTO estado_incidencia (nombre) VALUES ('RECHAZADA');

CREATE TABLE incidencia (
    id_incidencia        BIGSERIAL PRIMARY KEY,
    id_pedido            BIGINT      NOT NULL,
    id_prioridad         BIGINT      NOT NULL,
    id_estado_incidencia BIGINT      NOT NULL,
    descripcion          TEXT        NOT NULL,
    fecha_registro       TIMESTAMP   NOT NULL,
    resolucion           TEXT,
    fecha_cierre         TIMESTAMP,
    id_responsable       BIGINT,
    -- extra: public incident code, owner customer and last update
    codigo_incidencia    VARCHAR(30) NOT NULL,
    id_cliente           BIGINT      NOT NULL,
    fecha_actualizacion  TIMESTAMP   NOT NULL,
    CONSTRAINT uq_incidencia_codigo UNIQUE (codigo_incidencia),
    CONSTRAINT fk_incidencia_pedido FOREIGN KEY (id_pedido) REFERENCES pedido (id_pedido),
    CONSTRAINT fk_incidencia_prioridad FOREIGN KEY (id_prioridad) REFERENCES prioridad_incidencia (id_prioridad),
    CONSTRAINT fk_incidencia_estado FOREIGN KEY (id_estado_incidencia) REFERENCES estado_incidencia (id_estado_incidencia),
    CONSTRAINT fk_incidencia_responsable FOREIGN KEY (id_responsable) REFERENCES usuario (id_usuario),
    CONSTRAINT fk_incidencia_cliente FOREIGN KEY (id_cliente) REFERENCES usuario (id_usuario)
);

CREATE INDEX ix_incidencia_pedido ON incidencia (id_pedido);
CREATE INDEX ix_incidencia_cliente ON incidencia (id_cliente, fecha_registro DESC);
CREATE INDEX ix_incidencia_estado_prioridad ON incidencia (id_estado_incidencia, id_prioridad);

CREATE SEQUENCE seq_codigo_incidencia START WITH 1 INCREMENT BY 1;
