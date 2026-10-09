package com.armakers3d.catalog.infrastructure.jpa;

import com.armakers3d.catalog.domain.ProductCategory;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** JPA mapping of table {@code producto} (V6) and its {@code producto_caracteristica} list. Infrastructure only. */
@Entity
@Table(name = "producto")
public class ProductEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_producto")
    private Long id;

    @Column(name = "nombre", nullable = false, length = 150)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "categoria", nullable = false, length = 30)
    private ProductCategory category;

    @Column(name = "subcategoria", length = 80)
    private String subcategory;

    @Column(name = "descripcion")
    private String description;

    @Column(name = "precio_referencial", precision = 10, scale = 2)
    private BigDecimal price;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "producto_caracteristica", joinColumns = @JoinColumn(name = "id_producto"))
    @OrderColumn(name = "orden")
    @Column(name = "texto", nullable = false, length = 200)
    private List<String> characteristics = new ArrayList<>();

    @Column(name = "imagen_url", length = 500)
    private String imageUrl;

    @Column(name = "estado", nullable = false)
    private boolean available;

    @Column(name = "fecha_registro", nullable = false)
    private Instant createdAt;

    @Column(name = "fecha_actualizacion", nullable = false)
    private Instant updatedAt;

    protected ProductEntity() {
    }

    ProductEntity(
            Long id,
            String title,
            ProductCategory category,
            String subcategory,
            String description,
            BigDecimal price,
            List<String> characteristics,
            boolean available,
            Instant createdAt,
            Instant updatedAt,
            String imageUrl) {
        this.id = id;
        this.title = title;
        this.category = category;
        this.subcategory = subcategory;
        this.description = description;
        this.price = price;
        this.characteristics = new ArrayList<>(characteristics);
        this.available = available;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.imageUrl = imageUrl;
    }

    Long getId() {
        return id;
    }

    String getTitle() {
        return title;
    }

    ProductCategory getCategory() {
        return category;
    }

    String getSubcategory() {
        return subcategory;
    }

    String getDescription() {
        return description;
    }

    BigDecimal getPrice() {
        return price;
    }

    List<String> getCharacteristics() {
        return characteristics;
    }

    String getImageUrl() {
        return imageUrl;
    }

    boolean isAvailable() {
        return available;
    }

    Instant getCreatedAt() {
        return createdAt;
    }

    Instant getUpdatedAt() {
        return updatedAt;
    }
}
