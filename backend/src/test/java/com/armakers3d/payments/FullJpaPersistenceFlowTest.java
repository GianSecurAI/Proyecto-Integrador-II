package com.armakers3d.payments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.auth.AbstractOtpIntegrationTest;
import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.shared.persistence.JpaTestData;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.Cookie;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;

/**
 * End-to-end flow with EVERY feature stored in PostgreSQL (H2 in PostgreSQL mode, Flyway V1-V7) instead of memory:
 * catalog product, checkout, payment proof, administrator approval, order, order history, status change, incident and
 * reports, all through the real HTTP API and security chain.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        properties = {
            "app.persistence.users=jpa",
            "app.persistence.catalog=jpa",
            "app.persistence.orders=jpa",
            "app.persistence.incidents=jpa",
            "app.persistence.payments=jpa",
            "app.persistence.proofs=jpa"
        })
class FullJpaPersistenceFlowTest extends AbstractOtpIntegrationTest {

    @Autowired JdbcTemplate jdbc;

    @AfterEach
    void cleanUp() {
        JpaTestData.reset(jdbc);
    }

    private JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    @Test
    void aCatalogPurchaseGoesFromCheckoutToATrackedOrderWithAnIncidentAndReportsAllInPostgres() throws Exception {
        // administrator (provisioned) and customer (self-registered through the OTP flow)
        String adminEmail = uniqueEmail("admin").toLowerCase();
        clienteRepository.save(Cliente.provisioned(adminEmail, Rol.ADMINISTRADOR, clock.instant()));
        Cookie admin = registerAndGetSessionCookie(adminEmail);
        Cookie customer = registerAndGetSessionCookie(uniqueEmail("buyer"));

        // 1. the administrator publishes a product (producto + producto_caracteristica)
        Map<String, Object> product = new LinkedHashMap<>();
        product.put("title", "Llavero Ar Makers");
        product.put("category", "LLAVERO");
        product.put("subcategory", "Personalizado");
        product.put("description", "Llavero impreso en 3D");
        product.put("price", new java.math.BigDecimal("12.50"));
        product.put("characteristics", List.of("PLA", "5 cm"));
        long productId = body(mockMvc.perform(post("/api/admin/products").cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(product)))
                .andExpect(status().isCreated()).andReturn()).get("id").asLong();
        mockMvc.perform(get("/api/catalog/products/" + productId))
                .andExpect(status().isOk());

        // 2. the customer starts a checkout (checkout + checkout_linea) and uploads the proof (comprobante_*)
        Map<String, Object> checkout = new LinkedHashMap<>();
        checkout.put("items", List.of(Map.of("productId", productId, "quantity", 2)));
        checkout.put("delivery", Map.of("address", "Av. Siempre Viva 123", "district", "Miraflores", "notes", "Timbre"));
        checkout.put("contact", Map.of("fullName", "Ana Perez", "phone", "+51 999 888 777"));
        String checkoutId = body(mockMvc.perform(post("/api/checkout").cookie(customer)
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(checkout)))
                .andExpect(status().isCreated()).andReturn()).get("checkoutId").asText();
        mockMvc.perform(multipart("/api/checkout/" + checkoutId + "/proof")
                        .file(new MockMultipartFile("file", "captura.jpg", "image/jpeg", TestImages.jpeg(64, 64, 7)))
                        .param("method", "YAPE").cookie(customer))
                .andExpect(status().isOk());

        // 3. the administrator approves it: the standard order is created from the checkout
        String orderId = body(mockMvc.perform(post("/api/admin/payments/" + checkoutId + "/approve").cookie(admin))
                .andExpect(status().isOk()).andReturn()).get("orderId").asText();
        assertThat(orderId).matches("PED-\\d{6}");
        assertThat(jdbc.queryForObject("select count(*) from pedido where codigo_pedido = ?", Integer.class, orderId))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject(
                        "select count(*) from historial_estado_pedido h join pedido p on p.id_pedido = h.id_pedido"
                                + " where p.codigo_pedido = ?",
                        Integer.class, orderId))
                .isEqualTo(1);

        // 4. the customer tracks the order; staff move it to production
        mockMvc.perform(get("/api/orders/" + orderId).cookie(customer))
                .andExpect(status().isOk());
        mockMvc.perform(patch("/api/admin/orders/" + orderId + "/status").cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"EN_PRODUCCION\"}"))
                .andExpect(status().isOk());
        JsonNode tracked = body(mockMvc.perform(get("/api/orders/" + orderId).cookie(customer))
                .andExpect(status().isOk()).andReturn());
        assertThat(tracked.get("status").asText()).isEqualTo("EN_PRODUCCION");

        // 5. the customer reports an incident on the order (incidencia), staff triage it
        Map<String, Object> incident = new LinkedHashMap<>();
        incident.put("orderId", orderId);
        incident.put("description", "La pieza llego con una esquina rota y quisiera cambiarla");
        String incidentId = body(mockMvc.perform(post("/api/incidents").cookie(customer)
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(incident)))
                .andExpect(status().isCreated()).andReturn()).get("id").asText();
        mockMvc.perform(patch("/api/admin/incidents/" + incidentId).cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"EN_REVISION\",\"priority\":\"ALTA\"}"))
                .andExpect(status().isOk());

        // 6. reports read the same data
        JsonNode orderReport = body(mockMvc.perform(get("/api/admin/reports/orders").cookie(admin))
                .andExpect(status().isOk()).andReturn());
        assertThat(orderReport.toString()).contains("EN_PRODUCCION");
        JsonNode incidentReport = body(mockMvc.perform(get("/api/admin/reports/incidents").cookie(admin))
                .andExpect(status().isOk()).andReturn());
        assertThat(incidentReport.toString()).contains("ALTA");
    }
}
