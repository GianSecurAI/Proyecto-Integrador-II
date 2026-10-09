package com.armakers3d.users.infrastructure.jpa;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Second view of table {@code usuario}: only the profile columns (nombres, apellidos, telefono). Hibernate updates just
 * the mapped columns, so saving a profile can never overwrite the role, e-mail or status owned by the auth module.
 * The row always exists (it is the account); this entity never inserts.
 */
@Entity
@Table(name = "usuario")
public class CustomerProfileEntity {

    @Id
    @Column(name = "id_usuario")
    private Long id;

    @Column(name = "nombres", length = 100)
    private String firstName;

    @Column(name = "apellidos", length = 100)
    private String lastName;

    @Column(name = "telefono", length = 20)
    private String phone;

    protected CustomerProfileEntity() {
    }

    Long getId() {
        return id;
    }

    String getFirstName() {
        return firstName;
    }

    String getLastName() {
        return lastName;
    }

    String getPhone() {
        return phone;
    }

    void update(String firstName, String lastName, String phone) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.phone = phone;
    }
}
