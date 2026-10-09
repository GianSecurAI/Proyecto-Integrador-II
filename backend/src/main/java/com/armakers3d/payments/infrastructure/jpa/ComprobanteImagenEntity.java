package com.armakers3d.payments.infrastructure.jpa;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** JPA mapping of table {@code comprobante_imagen} (V7): the bytes of an uploaded payment proof, by storage key. */
@Entity
@Table(name = "comprobante_imagen")
public class ComprobanteImagenEntity {

    @Id
    @Column(name = "clave_almacenamiento", length = 100)
    private String key;

    @Column(name = "contenido", nullable = false)
    private byte[] content;

    protected ComprobanteImagenEntity() {
    }

    ComprobanteImagenEntity(String key, byte[] content) {
        this.key = key;
        this.content = content;
    }

    byte[] getContent() {
        return content;
    }
}
