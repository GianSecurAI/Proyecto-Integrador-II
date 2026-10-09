package com.armakers3d.shared.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;

/**
 * Read-only view of table {@code pedido} (id and public code only). The incidents and payments modules point at an
 * order through its foreign key but their domain refers to it by the public code ({@code PED-000001}); this view lets
 * them resolve one into the other without depending on the orders module's entities.
 */
@Entity
@Immutable
@Table(name = "pedido")
public class PedidoRefEntity {

    @Id
    @Column(name = "id_pedido")
    private Long id;

    @Column(name = "codigo_pedido", nullable = false, length = 30)
    private String code;

    protected PedidoRefEntity() {
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }
}
