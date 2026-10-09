-- V7: tables that the application needs for the manual Yape/Plin checkout (ADR-005) and for idempotent order creation.
-- They are not part of the document's physical model (section 5.2.2): they extend it without altering any of its tables.

CREATE TABLE checkout (
    id_checkout       VARCHAR(36) PRIMARY KEY,
    id_cliente        BIGINT      NOT NULL,
    estado            VARCHAR(30) NOT NULL,
    fecha_creacion    TIMESTAMP   NOT NULL,
    fecha_expiracion  TIMESTAMP   NOT NULL,
    id_pedido         BIGINT,
    fecha_pago        TIMESTAMP,
    aprobado_por      BIGINT,
    entrega_direccion VARCHAR(200),
    entrega_distrito  VARCHAR(80),
    entrega_notas     VARCHAR(300),
    contacto_nombre   VARCHAR(150),
    contacto_telefono VARCHAR(20),
    CONSTRAINT fk_checkout_cliente FOREIGN KEY (id_cliente) REFERENCES usuario (id_usuario),
    CONSTRAINT fk_checkout_pedido FOREIGN KEY (id_pedido) REFERENCES pedido (id_pedido),
    CONSTRAINT fk_checkout_aprobado_por FOREIGN KEY (aprobado_por) REFERENCES usuario (id_usuario),
    CONSTRAINT chk_checkout_estado CHECK (estado IN
        ('AWAITING_PAYMENT_PROOF', 'PROOF_SUBMITTED', 'PAID', 'PROOF_REJECTED', 'EXPIRED', 'CANCELLED'))
);

CREATE TABLE checkout_linea (
    id_checkout_linea BIGSERIAL PRIMARY KEY,
    id_checkout       VARCHAR(36)   NOT NULL,
    orden             INTEGER       NOT NULL,
    id_producto       BIGINT,
    titulo            VARCHAR(150)  NOT NULL,
    precio_unitario   NUMERIC(10,2) NOT NULL,
    cantidad          INTEGER       NOT NULL,
    CONSTRAINT fk_checkout_linea_checkout FOREIGN KEY (id_checkout) REFERENCES checkout (id_checkout),
    CONSTRAINT fk_checkout_linea_producto FOREIGN KEY (id_producto) REFERENCES producto (id_producto),
    CONSTRAINT uq_checkout_linea_orden UNIQUE (id_checkout, orden),
    CONSTRAINT chk_checkout_linea_cantidad CHECK (cantidad > 0),
    CONSTRAINT chk_checkout_linea_precio CHECK (precio_unitario >= 0)
);

CREATE TABLE comprobante_pago (
    id_comprobante      VARCHAR(36) PRIMARY KEY,
    id_checkout         VARCHAR(36) NOT NULL,
    numero              INTEGER     NOT NULL,
    metodo              VARCHAR(10) NOT NULL,
    codigo_operacion    VARCHAR(20),
    clave_almacenamiento VARCHAR(100) NOT NULL,
    tipo_imagen         VARCHAR(20) NOT NULL,
    tamano_bytes        BIGINT      NOT NULL,
    sha256              VARCHAR(64) NOT NULL,
    fecha_envio         TIMESTAMP   NOT NULL,
    decision            VARCHAR(10) NOT NULL,
    decidido_por        BIGINT,
    fecha_decision      TIMESTAMP,
    motivo_rechazo      VARCHAR(500),
    CONSTRAINT fk_comprobante_checkout FOREIGN KEY (id_checkout) REFERENCES checkout (id_checkout),
    CONSTRAINT fk_comprobante_decidido_por FOREIGN KEY (decidido_por) REFERENCES usuario (id_usuario),
    CONSTRAINT uq_comprobante_numero UNIQUE (id_checkout, numero),
    CONSTRAINT chk_comprobante_metodo CHECK (metodo IN ('YAPE', 'PLIN')),
    CONSTRAINT chk_comprobante_decision CHECK (decision IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT chk_comprobante_tamano CHECK (tamano_bytes > 0)
);

-- Binary content of the uploaded proofs (sensitive: never logged, only served to the owner and to administrators).
CREATE TABLE comprobante_imagen (
    clave_almacenamiento VARCHAR(100) PRIMARY KEY,
    contenido            BYTEA        NOT NULL
);

CREATE TABLE idempotencia_pedido (
    id_cliente       BIGINT       NOT NULL,
    clave            VARCHAR(100) NOT NULL,
    huella           VARCHAR(64)  NOT NULL,
    -- id of the resource the key created: the checkout id (UUID) for checkouts, the order code for other creations
    id_recurso       VARCHAR(36)  NOT NULL,
    fecha_creacion   TIMESTAMP    NOT NULL,
    fecha_expiracion TIMESTAMP    NOT NULL,
    CONSTRAINT pk_idempotencia_pedido PRIMARY KEY (id_cliente, clave),
    CONSTRAINT fk_idempotencia_cliente FOREIGN KEY (id_cliente) REFERENCES usuario (id_usuario)
);

CREATE INDEX ix_checkout_cliente_estado ON checkout (id_cliente, estado);
CREATE INDEX ix_checkout_estado_expiracion ON checkout (estado, fecha_expiracion);
CREATE INDEX ix_checkout_linea_checkout ON checkout_linea (id_checkout);
CREATE INDEX ix_comprobante_checkout ON comprobante_pago (id_checkout);
CREATE INDEX ix_comprobante_sha256 ON comprobante_pago (sha256);
