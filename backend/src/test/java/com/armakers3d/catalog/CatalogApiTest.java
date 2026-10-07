package com.armakers3d.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.users.AbstractNoDbRbacTest;
import jakarta.servlet.http.Cookie;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Catalog over HTTP (MockMvc, nodb profile, full Spring Security chain): public read, filters,
 * validation, 404, role enforcement on admin writes and visibility of unavailable products. Every
 * test tags its own products so the shared context and the dev seed never interfere.
 */
class CatalogApiTest extends AbstractNoDbRbacTest {

    private static String tag() {
        return "zz" + Long.toString(System.nanoTime(), 36);
    }

    private static Map<String, Object> body(String title, String category, Object price) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("title", title);
        m.put("category", category);
        m.put("subcategory", "Subcategoria");
        m.put("description", "Descripcion del producto");
        m.put("price", price);
        m.put("characteristics", List.of("Material: PLA"));
        return m;
    }

    private ResultActions create(Cookie admin, Map<String, Object> body) throws Exception {
        return mockMvc.perform(post("/api/admin/products")
                .cookie(admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body)));
    }

    private long createId(Cookie admin, Map<String, Object> body) throws Exception {
        MvcResult r = create(admin, body).andExpect(status().isCreated()).andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asLong();
    }

    private void setAvailable(Cookie admin, long id, boolean available) throws Exception {
        mockMvc.perform(patch("/api/admin/products/" + id + "/availability")
                        .cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("available", available))))
                .andExpect(status().isOk());
    }

    // ---------- public read ----------

    @Test
    void anonymousCanListSeededProductsWithTheContractEnvelopeAndNoInternalFields() throws Exception {
        mockMvc.perform(get("/api/catalog/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalElements").isNumber())
                .andExpect(jsonPath("$.totalPages").isNumber())
                .andExpect(jsonPath("$.content[0].id").isNumber())
                .andExpect(jsonPath("$.content[0].title").isString())
                .andExpect(jsonPath("$.content[0].category").isString())
                .andExpect(jsonPath("$.content[0].subcategory").isString())
                .andExpect(jsonPath("$.content[0].price").isNumber())
                .andExpect(jsonPath("$.content[0].description").doesNotExist())
                .andExpect(jsonPath("$.content[0].available").doesNotExist())
                .andExpect(jsonPath("$.content[0].cost").doesNotExist());
    }

    @Test
    void devSeedProductsExistAndTheUnavailableOnesAreHiddenFromThePublic() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        mockMvc.perform(get("/api/admin/products").cookie(admin).param("available", "false").param("q", "geometrico"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
        mockMvc.perform(get("/api/catalog/products").param("q", "geometrico"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void detailReturnsDescriptionCharacteristicsAndEmptyImagesAndPriceAsNumberWithTwoDecimals() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        long id = createId(admin, body(tag(), "LLAVERO", 12.5));

        MvcResult result = mockMvc.perform(get("/api/catalog/products/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.description").value("Descripcion del producto"))
                .andExpect(jsonPath("$.characteristics[0]").value("Material: PLA"))
                .andExpect(jsonPath("$.images.length()").value(0))
                .andExpect(jsonPath("$.available").doesNotExist())
                .andExpect(jsonPath("$.createdAt").doesNotExist())
                .andReturn();
        assertThat(result.getResponse().getContentAsString()).contains("\"price\":12.50");
    }

    @Test
    void unknownNonNumericAndUnavailableProductsAre404WithTheEnvelope() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        long id = createId(admin, body(tag(), "LLAVERO", 5));
        setAvailable(admin, id, false);

        mockMvc.perform(get("/api/catalog/products/999999")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND")).andExpect(jsonPath("$.timestamp").exists());
        mockMvc.perform(get("/api/catalog/products/abc")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(get("/api/catalog/products/" + id)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/catalog/products/" + id).cookie(admin)).andExpect(status().isNotFound());
    }

    @Test
    void filtersSearchCategorySortAndPaginationWork() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        String t = tag();
        createId(admin, body(t + " Cheap Key", "LLAVERO", 5));
        createId(admin, body(t + " Mid Key", "LLAVERO", 15.5));
        createId(admin, body(t + " Pricey Sticker", "PEGATINAS", 40));

        mockMvc.perform(get("/api/catalog/products").param("q", t.toUpperCase()))
                .andExpect(jsonPath("$.totalElements").value(3));
        mockMvc.perform(get("/api/catalog/products").param("q", t).param("category", "PEGATINAS"))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].category").value("PEGATINAS"));
        mockMvc.perform(get("/api/catalog/products").param("q", t).param("minPrice", "10").param("maxPrice", "20"))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].price").value(15.5));
        mockMvc.perform(get("/api/catalog/products").param("q", t).param("sort", "price,desc").param("size", "2"))
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.content[0].price").value(40))
                .andExpect(jsonPath("$.content[1].price").value(15.5));
        mockMvc.perform(get("/api/catalog/products").param("q", t).param("sort", "price").param("page", "1").param("size", "2"))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].price").value(40));
        mockMvc.perform(get("/api/catalog/products").param("q", t).param("sort", "title,asc"))
                .andExpect(jsonPath("$.content[0].title").value(t + " Cheap Key"));
    }

    @Test
    void idsFilterReturnsOnlyKnownAvailableIds() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        long a = createId(admin, body(tag(), "LLAVERO", 5));
        long b = createId(admin, body(tag(), "LLAVERO", 6));
        setAvailable(admin, b, false);

        mockMvc.perform(get("/api/catalog/products").param("ids", a + "," + b + ",999999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(a));
        List<String> many = new ArrayList<>();
        for (int i = 1; i <= 51; i++) {
            many.add(String.valueOf(i));
        }
        mockMvc.perform(get("/api/catalog/products").param("ids", String.join(",", many)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void badQueryParametersAreRejectedWithTheEnvelope() throws Exception {
        mockMvc.perform(get("/api/catalog/products").param("sort", "cost,asc"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        mockMvc.perform(get("/api/catalog/products").param("category", "DESCARGA_DIGITAL"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        mockMvc.perform(get("/api/catalog/products").param("minPrice", "abc"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        mockMvc.perform(get("/api/catalog/products").param("minPrice", "10").param("maxPrice", "5"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mockMvc.perform(get("/api/catalog/products").param("size", "101"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mockMvc.perform(get("/api/catalog/products").param("page", "-1"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void publicCatalogHasNoWriteEndpoints() throws Exception {
        mockMvc.perform(post("/api/catalog/products").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isMethodNotAllowed());
        mockMvc.perform(delete("/api/catalog/products/1")).andExpect(result ->
                assertThat(result.getResponse().getStatus()).isIn(404, 405));
    }

    // ---------- admin: authorization ----------

    @Test
    void anonymousGets401OnEveryAdminProductEndpoint() throws Exception {
        mockMvc.perform(get("/api/admin/products")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/admin/products/1")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/admin/products").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(put("/api/admin/products/1").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(patch("/api/admin/products/1/availability").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void clienteAndAsesorGet403OnEveryAdminProductEndpointAndNothingIsChanged() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        String t = tag();
        long id = createId(admin, body(t, "LLAVERO", 5));

        for (Rol rol : List.of(Rol.CLIENTE, Rol.ASESOR)) {
            Cookie c = signInAs(rol);
            mockMvc.perform(get("/api/admin/products").cookie(c)).andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("FORBIDDEN"));
            mockMvc.perform(get("/api/admin/products/" + id).cookie(c)).andExpect(status().isForbidden());
            create(c, body(t + "-x", "LLAVERO", 5)).andExpect(status().isForbidden());
            mockMvc.perform(put("/api/admin/products/" + id).cookie(c)
                            .contentType(MediaType.APPLICATION_JSON).content(json(body("hacked", "LLAVERO", 1))))
                    .andExpect(status().isForbidden());
            mockMvc.perform(patch("/api/admin/products/" + id + "/availability").cookie(c)
                            .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("available", false))))
                    .andExpect(status().isForbidden());
        }
        mockMvc.perform(get("/api/catalog/products/" + id))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value(t));
        mockMvc.perform(get("/api/catalog/products").param("q", t + "-x"))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    // ---------- admin: behavior ----------

    @Test
    void adminCreatesWithLocationAvailableTrueAndTimestamps() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        String t = tag();
        MvcResult r = create(admin, body("  " + t + "  ", "PEGATINAS", 19.9))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", org.hamcrest.Matchers.startsWith("/api/admin/products/")))
                .andExpect(jsonPath("$.title").value(t))
                .andExpect(jsonPath("$.category").value("PEGATINAS"))
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.createdAt").isString())
                .andExpect(jsonPath("$.updatedAt").isString())
                .andExpect(jsonPath("$.images.length()").value(0))
                .andReturn();
        assertThat(r.getResponse().getContentAsString()).contains("\"price\":19.90");
    }

    @Test
    void createIgnoresClientSuppliedIdAvailabilityAndCost() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        Map<String, Object> b = body(tag(), "LLAVERO", 5);
        b.put("id", 1);
        b.put("available", false);
        b.put("cost", 1);
        create(admin, b)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.not(1)))
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.cost").doesNotExist());
    }

    @Test
    void adminUpdatesFullyAndAvailabilityIsUntouched() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        long id = createId(admin, body(tag(), "LLAVERO", 5));
        setAvailable(admin, id, false);
        String t = tag();

        mockMvc.perform(put("/api/admin/products/" + id).cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON).content(json(body(t, "PEGATINAS", 33.25))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value(t))
                .andExpect(jsonPath("$.category").value("PEGATINAS"))
                .andExpect(jsonPath("$.price").value(33.25))
                .andExpect(jsonPath("$.available").value(false));
        mockMvc.perform(get("/api/admin/products/" + id).cookie(admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value(t));
    }

    @Test
    void availabilityChangeHidesAndRestoresTheProductForThePublic() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        String t = tag();
        long id = createId(admin, body(t, "LLAVERO", 5));

        setAvailable(admin, id, false);
        mockMvc.perform(get("/api/catalog/products/" + id)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/catalog/products").param("q", t)).andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get("/api/admin/products").cookie(admin).param("q", t))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].available").value(false));

        setAvailable(admin, id, true);
        mockMvc.perform(get("/api/catalog/products/" + id)).andExpect(status().isOk());
    }

    @Test
    void adminListFiltersByAvailabilityCategoryAndTitle() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        String t = tag();
        long a = createId(admin, body(t + "a", "LLAVERO", 5));
        long b = createId(admin, body(t + "b", "PEGATINAS", 6));
        setAvailable(admin, b, false);

        mockMvc.perform(get("/api/admin/products").cookie(admin).param("q", t))
                .andExpect(jsonPath("$.totalElements").value(2));
        mockMvc.perform(get("/api/admin/products").cookie(admin).param("q", t).param("available", "true"))
                .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.content[0].id").value(a));
        mockMvc.perform(get("/api/admin/products").cookie(admin).param("q", t).param("category", "PEGATINAS"))
                .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.content[0].id").value(b));
        mockMvc.perform(get("/api/admin/products").cookie(admin).param("sort", "bogus"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
    }

    @Test
    void adminUnknownIdIs404ForGetPutAndPatch() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        mockMvc.perform(get("/api/admin/products/999999").cookie(admin)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(put("/api/admin/products/999999").cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON).content(json(body("t", "LLAVERO", 5))))
                .andExpect(status().isNotFound());
        mockMvc.perform(patch("/api/admin/products/999999/availability").cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("available", true))))
                .andExpect(status().isNotFound());
    }

    // ---------- admin: validation ----------

    @Test
    void validationErrorsReportFieldsAndCreateNothing() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        String t = tag();
        Map<String, Object> bad = new LinkedHashMap<>();
        bad.put("title", "   ");
        bad.put("category", null);
        bad.put("subcategory", "");
        bad.put("description", "x".repeat(2001));
        bad.put("price", 0);
        bad.put("characteristics", null);

        create(admin, bad)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='title')]").exists())
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='category')]").exists())
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='subcategory')]").exists())
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='description')]").exists())
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='price')]").exists())
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='characteristics')]").exists());
        mockMvc.perform(get("/api/admin/products").cookie(admin).param("q", t))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void priceRulesAreEnforcedOverHttp() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        for (Object badPrice : new Object[] {0, -5, 1.005, 100000, "abc", null}) {
            Map<String, Object> b = body(tag(), "LLAVERO", badPrice);
            create(admin, b).andExpect(status().isBadRequest());
        }
        create(admin, body(tag(), "LLAVERO", 99999.99)).andExpect(status().isCreated());
        create(admin, body(tag(), "LLAVERO", 0.01)).andExpect(status().isCreated());
    }

    @Test
    void lengthLimitsCategorySetAndCharacteristicsAreEnforced() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        create(admin, body("x".repeat(121), "LLAVERO", 5)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("title"));
        create(admin, body(tag(), "DESCARGA_DIGITAL", 5)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        Map<String, Object> many = body(tag(), "LLAVERO", 5);
        List<String> chars = new ArrayList<>();
        for (int i = 0; i < 21; i++) {
            chars.add("c" + i);
        }
        many.put("characteristics", chars);
        create(admin, many).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        Map<String, Object> blankItem = body(tag(), "LLAVERO", 5);
        blankItem.put("characteristics", List.of("ok", " "));
        create(admin, blankItem).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void malformedJsonAndMissingAvailabilityUseTheEnvelope() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        long id = createId(admin, body(tag(), "LLAVERO", 5));
        mockMvc.perform(post("/api/admin/products").cookie(admin).contentType(MediaType.APPLICATION_JSON).content("{nope"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        mockMvc.perform(patch("/api/admin/products/" + id + "/availability").cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mockMvc.perform(post("/api/admin/products").cookie(admin).contentType(MediaType.TEXT_PLAIN).content("x"))
                .andExpect(status().isUnsupportedMediaType()).andExpect(jsonPath("$.code").value("UNSUPPORTED_MEDIA_TYPE"));
    }
}
