package com.armakers3d.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.armakers3d.catalog.domain.Product;
import com.armakers3d.catalog.domain.ProductCategory;
import com.armakers3d.catalog.infrastructure.inmemory.InMemoryProductRepository;
import com.armakers3d.catalog.service.CatalogService;
import com.armakers3d.catalog.service.ProductAdminService;
import com.armakers3d.shared.error.MalformedRequestException;
import com.armakers3d.shared.error.NotFoundException;
import com.armakers3d.shared.error.ValidationFailedException;
import com.armakers3d.shared.pagination.PageRequest;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Service rules with the real in-memory adapter and a fixed clock (no Spring context). */
class CatalogServicesTest {

    private static final PageRequest PAGE = new PageRequest(0, 50);
    private static final CatalogService.Filter NO_FILTER = new CatalogService.Filter(null, null, null, null, null);

    private InMemoryProductRepository repository;
    private CatalogService catalog;
    private ProductAdminService admin;

    @BeforeEach
    void setUp() {
        repository = new InMemoryProductRepository();
        Clock clock = Clock.fixed(Instant.parse("2026-10-06T10:00:00Z"), ZoneOffset.UTC);
        catalog = new CatalogService(repository);
        admin = new ProductAdminService(repository, clock);
    }

    private ProductAdminService.WriteCommand cmd(String title, String price) {
        return new ProductAdminService.WriteCommand(
                title, ProductCategory.LLAVERO, "Sub", "Descripcion", new BigDecimal(price), List.of("x"));
    }

    @Test
    void createIsAvailableWithServerGeneratedIdAndNormalizedPrice() {
        Product p = admin.create(1L, cmd("  Llavero  ", "12.5"));

        assertThat(p.id()).isNotNull();
        assertThat(p.available()).isTrue();
        assertThat(p.title()).isEqualTo("Llavero");
        assertThat(p.price().toPlainString()).isEqualTo("12.50");
    }

    @Test
    void createRejectsInvalidInputEvenWhenTheDtoLayerIsBypassed() {
        assertThatThrownBy(() -> admin.create(1L, cmd("T", "0"))).isInstanceOf(ValidationFailedException.class);
        assertThatThrownBy(() -> admin.create(1L, cmd(" ", "5"))).isInstanceOf(ValidationFailedException.class);
        assertThatThrownBy(() -> admin.create(1L, cmd("T", "1.005"))).isInstanceOf(ValidationFailedException.class);
        assertThat(admin.list(new ProductAdminService.AdminFilter(null, null, null), PAGE, null).totalElements()).isZero();
    }

    @Test
    void updateReplacesFieldsButKeepsAvailabilityAndCreationTime() {
        Product created = admin.create(1L, cmd("Old", "5"));
        admin.setAvailability(1L, created.id(), false);

        Product updated = admin.update(1L, created.id(), cmd("New", "7"));

        assertThat(updated.title()).isEqualTo("New");
        assertThat(updated.available()).isFalse();
        assertThat(updated.createdAt()).isEqualTo(created.createdAt());
    }

    @Test
    void unknownIdIsNotFoundForGetUpdateAndAvailability() {
        assertThatThrownBy(() -> admin.get(99L)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> admin.update(1L, 99L, cmd("T", "5"))).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> admin.setAvailability(1L, 99L, true)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> catalog.getAvailable(99L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void publicReadHidesUnavailableProductsButAdminSeesThem() {
        Product visible = admin.create(1L, cmd("Visible", "5"));
        Product hidden = admin.create(1L, cmd("Hidden", "5"));
        admin.setAvailability(1L, hidden.id(), false);

        assertThat(catalog.listAvailable(NO_FILTER, PAGE, null).content()).extracting(Product::id).containsExactly(visible.id());
        assertThatThrownBy(() -> catalog.getAvailable(hidden.id())).isInstanceOf(NotFoundException.class);
        assertThat(admin.list(new ProductAdminService.AdminFilter(null, null, null), PAGE, null).totalElements()).isEqualTo(2);
        assertThat(admin.list(new ProductAdminService.AdminFilter(null, null, false), PAGE, null).content())
                .extracting(Product::id).containsExactly(hidden.id());
    }

    @Test
    void idsFilterOmitsUnavailableAndUnknownIdsAndIsBoundedTo50() {
        Product a = admin.create(1L, cmd("A", "5"));
        Product b = admin.create(1L, cmd("B", "5"));
        admin.setAvailability(1L, b.id(), false);

        var page = catalog.listAvailable(new CatalogService.Filter(null, null, null, null, List.of(a.id(), b.id(), 777L)), PAGE, null);
        assertThat(page.content()).extracting(Product::id).containsExactly(a.id());

        List<Long> tooMany = new ArrayList<>();
        for (long i = 1; i <= 51; i++) {
            tooMany.add(i);
        }
        assertThatThrownBy(() -> catalog.listAvailable(new CatalogService.Filter(null, null, null, null, tooMany), PAGE, null))
                .isInstanceOf(ValidationFailedException.class);
    }

    @Test
    void priceRangeAndSearchValidation() {
        assertThatThrownBy(() -> catalog.listAvailable(
                        new CatalogService.Filter(null, null, new BigDecimal("10"), new BigDecimal("5"), null), PAGE, null))
                .isInstanceOf(ValidationFailedException.class);
        assertThatThrownBy(() -> catalog.listAvailable(
                        new CatalogService.Filter(null, null, new BigDecimal("-1"), null, null), PAGE, null))
                .isInstanceOf(ValidationFailedException.class);
        assertThatThrownBy(() -> catalog.listAvailable(new CatalogService.Filter("x".repeat(101), null, null, null, null), PAGE, null))
                .isInstanceOf(ValidationFailedException.class);
        assertThatThrownBy(() -> catalog.listAvailable(NO_FILTER, PAGE, "cost,asc")).isInstanceOf(MalformedRequestException.class);
    }

    @Test
    void settingTheSameAvailabilityIsANoOp() {
        Product p = admin.create(1L, cmd("A", "5"));
        Product same = admin.setAvailability(1L, p.id(), true);
        assertThat(same.updatedAt()).isEqualTo(p.updatedAt());
    }
}
