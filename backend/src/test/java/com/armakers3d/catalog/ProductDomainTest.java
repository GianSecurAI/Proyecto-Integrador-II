package com.armakers3d.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.armakers3d.catalog.domain.Product;
import com.armakers3d.catalog.domain.ProductCategory;
import com.armakers3d.catalog.domain.ProductData;
import com.armakers3d.catalog.domain.ProductRules;
import com.armakers3d.catalog.domain.ProductSearchCriteria;
import com.armakers3d.catalog.domain.ProductSort;
import com.armakers3d.shared.error.MalformedRequestException;
import com.armakers3d.shared.error.ValidationFailedException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** Pure domain rules: normalization, price handling, search semantics, sort parsing, immutability. */
class ProductDomainTest {

    private static final Instant T0 = Instant.parse("2026-10-06T10:00:00Z");

    private static ProductData valid() {
        return ProductRules.normalize("  Llavero  ", ProductCategory.LLAVERO, " Sub ", " Desc ", new BigDecimal("9.9"), List.of(" a "));
    }

    @Test
    void normalizeTrimsTextAndForcesTwoDecimalScale() {
        ProductData d = valid();
        assertThat(d.title()).isEqualTo("Llavero");
        assertThat(d.subcategory()).isEqualTo("Sub");
        assertThat(d.description()).isEqualTo("Desc");
        assertThat(d.characteristics()).containsExactly("a");
        assertThat(d.price()).isEqualByComparingTo("9.90");
        assertThat(d.price().scale()).isEqualTo(2);
    }

    @Test
    void priceMustBePositiveAtMostTwoDecimalsAndBelowTheCap() {
        assertThatThrownBy(() -> ProductRules.normalizePrice(BigDecimal.ZERO)).isInstanceOf(ValidationFailedException.class);
        assertThatThrownBy(() -> ProductRules.normalizePrice(new BigDecimal("-1"))).isInstanceOf(ValidationFailedException.class);
        assertThatThrownBy(() -> ProductRules.normalizePrice(new BigDecimal("1.001"))).isInstanceOf(ValidationFailedException.class);
        assertThatThrownBy(() -> ProductRules.normalizePrice(new BigDecimal("100000.00"))).isInstanceOf(ValidationFailedException.class);
        assertThatThrownBy(() -> ProductRules.normalizePrice(null)).isInstanceOf(ValidationFailedException.class);
        assertThat(ProductRules.normalizePrice(new BigDecimal("1.500"))).isEqualByComparingTo("1.50");
        assertThat(ProductRules.normalizePrice(new BigDecimal("99999.99"))).isEqualByComparingTo("99999.99");
        assertThat(ProductRules.normalizePrice(new BigDecimal("0.01"))).isEqualByComparingTo("0.01");
    }

    @Test
    void textLimitsAndBlankChecksAreEnforced() {
        String longTitle = "x".repeat(ProductRules.TITLE_MAX + 1);
        assertThatThrownBy(() -> ProductRules.normalize(longTitle, ProductCategory.LLAVERO, "s", "d", BigDecimal.ONE, List.of()))
                .isInstanceOf(ValidationFailedException.class);
        assertThatThrownBy(() -> ProductRules.normalize("   ", ProductCategory.LLAVERO, "s", "d", BigDecimal.ONE, List.of()))
                .isInstanceOf(ValidationFailedException.class);
        assertThatThrownBy(() -> ProductRules.normalize("t", null, "s", "d", BigDecimal.ONE, List.of()))
                .isInstanceOf(ValidationFailedException.class);
        assertThatThrownBy(() -> ProductRules.normalize("t", ProductCategory.LLAVERO, "s", "d", BigDecimal.ONE, null))
                .isInstanceOf(ValidationFailedException.class);
        assertThatThrownBy(() -> ProductRules.normalize("t", ProductCategory.LLAVERO, "s", "d", BigDecimal.ONE, List.of(" ")))
                .isInstanceOf(ValidationFailedException.class);
        List<String> tooMany = new ArrayList<>();
        for (int i = 0; i <= ProductRules.CHARACTERISTICS_MAX_ITEMS; i++) {
            tooMany.add("c" + i);
        }
        assertThatThrownBy(() -> ProductRules.normalize("t", ProductCategory.LLAVERO, "s", "d", BigDecimal.ONE, tooMany))
                .isInstanceOf(ValidationFailedException.class);
    }

    @Test
    void productCreationAndUpdatesAreImmutableAndKeepAvailabilityAndCreationTime() {
        Product created = Product.create(valid(), T0);
        assertThat(created.id()).isNull();
        assertThat(created.available()).isTrue();

        Instant later = T0.plusSeconds(60);
        Product off = created.withId(7L).withAvailability(false, later);
        Product updated = off.updatedWith(
                ProductRules.normalize("Nuevo", ProductCategory.PEGATINAS, "s", "d", new BigDecimal("3"), List.of()), later.plusSeconds(1));

        assertThat(updated.id()).isEqualTo(7L);
        assertThat(updated.available()).isFalse();
        assertThat(updated.createdAt()).isEqualTo(T0);
        assertThat(updated.updatedAt()).isEqualTo(later.plusSeconds(1));
        assertThat(created.available()).isTrue();
        assertThat(created.title()).isEqualTo("Llavero");
    }

    @Test
    void characteristicsCannotBeMutatedThroughTheRecord() {
        List<String> source = new ArrayList<>(List.of("a"));
        Product p = Product.create(
                new ProductData("t", ProductCategory.LLAVERO, "s", "d", new BigDecimal("1.00"), source), T0);
        source.add("b");
        assertThat(p.characteristics()).containsExactly("a");
        assertThatThrownBy(() -> p.characteristics().add("c")).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void searchCriteriaMatchesCaseInsensitiveTitleCategoryPriceRangeIdsAndAvailability() {
        Product p = Product.create(valid(), T0).withId(5L);
        assertThat(new ProductSearchCriteria("LLAV", null, null, null, null, null).matches(p)).isTrue();
        assertThat(new ProductSearchCriteria("zzz", null, null, null, null, null).matches(p)).isFalse();
        assertThat(new ProductSearchCriteria(null, ProductCategory.PEGATINAS, null, null, null, null).matches(p)).isFalse();
        assertThat(new ProductSearchCriteria(null, null, new BigDecimal("9.90"), new BigDecimal("9.90"), null, null).matches(p)).isTrue();
        assertThat(new ProductSearchCriteria(null, null, new BigDecimal("10"), null, null, null).matches(p)).isFalse();
        assertThat(new ProductSearchCriteria(null, null, null, new BigDecimal("9"), null, null).matches(p)).isFalse();
        assertThat(new ProductSearchCriteria(null, null, null, null, Set.of(5L), null).matches(p)).isTrue();
        assertThat(new ProductSearchCriteria(null, null, null, null, Set.of(6L), null).matches(p)).isFalse();
        assertThat(new ProductSearchCriteria(null, null, null, null, null, false).matches(p)).isFalse();
    }

    @Test
    void sortParsingAcceptsOnlyTheWhitelistAndDefaultsToNewestFirst() {
        assertThat(ProductSort.parse(null)).isEqualTo(ProductSort.DEFAULT);
        assertThat(ProductSort.parse("price,asc")).isEqualTo(new ProductSort(ProductSort.Field.PRICE, false));
        assertThat(ProductSort.parse("title,DESC")).isEqualTo(new ProductSort(ProductSort.Field.TITLE, true));
        assertThat(ProductSort.parse("createdAt")).isEqualTo(new ProductSort(ProductSort.Field.CREATED_AT, false));
        assertThatThrownBy(() -> ProductSort.parse("cost,asc")).isInstanceOf(MalformedRequestException.class);
        assertThatThrownBy(() -> ProductSort.parse("price,sideways")).isInstanceOf(MalformedRequestException.class);
        assertThatThrownBy(() -> ProductSort.parse("price,asc,x")).isInstanceOf(MalformedRequestException.class);
    }
}
