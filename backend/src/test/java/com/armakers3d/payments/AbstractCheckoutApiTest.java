package com.armakers3d.payments;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.orders.repository.OrderRepository;
import com.armakers3d.payments.service.CheckoutExpiryService;
import com.armakers3d.users.AbstractNoDbRbacTest;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.Cookie;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;

/**
 * Scaffolding for the checkout / proof / verification HTTP tests (ADR-005): MockMvc only (no sockets), in-memory
 * adapters, full Spring Security chain. Each test creates its own products and accounts, so the shared context never
 * interferes. Includes generators of tiny valid JPEG/PNG/WebP images (seeded, so equal seeds give identical bytes).
 */
public abstract class AbstractCheckoutApiTest extends AbstractNoDbRbacTest {

    @Autowired protected OrderRepository orderRepository;
    @Autowired protected CheckoutExpiryService expiryService;

    private Cookie admin;

    protected Cookie admin() throws Exception {
        if (admin == null) {
            admin = signInAs(Rol.ADMINISTRADOR);
        }
        return admin;
    }

    // ---------- catalog fixtures ----------

    protected static Map<String, Object> productBody(String price) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("title", "Producto " + UUID.randomUUID().toString().substring(0, 8));
        m.put("category", "LLAVERO");
        m.put("subcategory", "Subcategoria");
        m.put("description", "Descripcion del producto");
        m.put("price", new BigDecimal(price));
        m.put("characteristics", List.of());
        return m;
    }

    protected long createProduct(String price) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/admin/products")
                        .cookie(admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(productBody(price))))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asLong();
    }

    protected void changePrice(long id, String price) throws Exception {
        mockMvc.perform(put("/api/admin/products/" + id)
                        .cookie(admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(productBody(price))))
                .andExpect(status().isOk());
    }

    protected void setAvailable(long id, boolean available) throws Exception {
        mockMvc.perform(patch("/api/admin/products/" + id + "/availability")
                        .cookie(admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("available", available))))
                .andExpect(status().isOk());
    }

    protected static Map<String, Object> item(Object productId, Object quantity) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("productId", productId);
        m.put("quantity", quantity);
        return m;
    }

    @SafeVarargs
    protected static Map<String, Object> checkoutBody(Map<String, Object>... items) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("items", List.of(items));
        m.put("delivery", new LinkedHashMap<>(Map.of("address", "Av. Siempre Viva 123", "district", "Miraflores", "notes", "Tocar el timbre")));
        m.put("contact", new LinkedHashMap<>(Map.of("fullName", "Ana Perez", "phone", "+51 999 888 777")));
        return m;
    }

    // ---------- customer endpoints ----------

    protected ResultActions submit(Cookie cookie, String idempotencyKey, Object body) throws Exception {
        var request = post("/api/checkout").contentType(MediaType.APPLICATION_JSON).content(json(body));
        if (cookie != null) {
            request.cookie(cookie);
        }
        if (idempotencyKey != null) {
            request.header("Idempotency-Key", idempotencyKey);
        }
        return mockMvc.perform(request);
    }

    protected ResultActions submit(Cookie cookie, Object body) throws Exception {
        return submit(cookie, null, body);
    }

    protected ResultActions poll(Cookie cookie, String checkoutId) throws Exception {
        var request = get("/api/checkout/" + checkoutId);
        if (cookie != null) {
            request.cookie(cookie);
        }
        return mockMvc.perform(request);
    }

    protected ResultActions cancel(Cookie cookie, String checkoutId) throws Exception {
        return mockMvc.perform(post("/api/checkout/" + checkoutId + "/cancel").cookie(cookie));
    }

    protected JsonNode read(ResultActions actions) throws Exception {
        return objectMapper.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    /** Creates a valid one-product checkout (201) and returns its id. */
    protected String startCheckout(Cookie customer, long productId, int quantity) throws Exception {
        return read(submit(customer, checkoutBody(item(productId, quantity))).andExpect(status().isCreated()))
                .get("checkoutId").asText();
    }

    /** Multipart proof upload exactly as a browser sends it: the declared file name and content type are the client's. */
    protected ResultActions upload(Cookie cookie, String checkoutId, byte[] content, String filename, String declaredType,
            String method, String operationCode) throws Exception {
        MockMultipartHttpServletRequestBuilder request = multipart("/api/checkout/" + checkoutId + "/proof")
                .file(new MockMultipartFile("file", filename, declaredType, content));
        if (method != null) {
            request.param("method", method);
        }
        if (operationCode != null) {
            request.param("operationCode", operationCode);
        }
        if (cookie != null) {
            request.cookie(cookie);
        }
        return mockMvc.perform(request);
    }

    protected ResultActions upload(Cookie cookie, String checkoutId, byte[] content) throws Exception {
        return upload(cookie, checkoutId, content, "captura.jpg", "image/jpeg", "YAPE", null);
    }

    protected JsonNode uploadOk(Cookie cookie, String checkoutId, byte[] content) throws Exception {
        return read(upload(cookie, checkoutId, content).andExpect(status().isOk()));
    }

    // ---------- admin endpoints ----------

    protected ResultActions adminGet(String path) throws Exception {
        return mockMvc.perform(get(path).cookie(admin()));
    }

    protected ResultActions approve(String checkoutId) throws Exception {
        return mockMvc.perform(post("/api/admin/payments/" + checkoutId + "/approve").cookie(admin()));
    }

    protected ResultActions reject(String checkoutId, String reason) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("reason", reason);
        return mockMvc.perform(post("/api/admin/payments/" + checkoutId + "/reject").cookie(admin())
                .contentType(MediaType.APPLICATION_JSON).content(json(body)));
    }

    /** Customer starts a checkout and uploads a (seeded) valid proof; returns the checkout id (status PROOF_SUBMITTED). */
    protected String checkoutWithProof(Cookie customer, long productId, int quantity, int seed) throws Exception {
        String id = startCheckout(customer, productId, quantity);
        uploadOk(customer, id, jpeg(64, 64, seed));
        return id;
    }

    protected String firstAttemptId(String checkoutId, Cookie customer) throws Exception {
        return read(poll(customer, checkoutId).andExpect(status().isOk())).get("attempts").get(0).get("attemptId").asText();
    }

    // ---------- image generators (see TestImages) ----------

    protected static byte[] jpeg(int width, int height, int seed) throws IOException {
        return TestImages.jpeg(width, height, seed);
    }

    protected static byte[] png(int width, int height, int seed) throws IOException {
        return TestImages.png(width, height, seed);
    }

    protected static byte[] webp(int width, int height) {
        return TestImages.webp(width, height);
    }

    protected static byte[] concat(byte[] a, byte[] b) {
        return TestImages.concat(a, b);
    }
}
