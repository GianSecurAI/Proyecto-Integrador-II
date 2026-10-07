package com.armakers3d.catalog.dto;

import com.armakers3d.catalog.domain.ProductCategory;
import com.armakers3d.catalog.domain.ProductRules;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

/**
 * Contract review 4.4 {@code ProductWrite} (create and full-replace update). Limits come from
 * {@link ProductRules}, which the service applies again. No id, availability, cost or stock field:
 * unknown JSON properties are ignored and never reach the domain.
 */
public record ProductWriteRequestDto(
        @NotBlank @Size(max = ProductRules.TITLE_MAX) String title,
        @NotNull ProductCategory category,
        @NotBlank @Size(max = ProductRules.SUBCATEGORY_MAX) String subcategory,
        @NotBlank @Size(max = ProductRules.DESCRIPTION_MAX) String description,
        @NotNull
                @DecimalMin(value = "0.00", inclusive = false, message = "must be greater than 0")
                @DecimalMax(value = ProductRules.PRICE_MAX_TEXT)
                @Digits(integer = 5, fraction = 2, message = "must have at most 2 decimal places")
                BigDecimal price,
        @NotNull @Size(max = ProductRules.CHARACTERISTICS_MAX_ITEMS)
                List<@NotBlank @Size(max = ProductRules.CHARACTERISTIC_MAX) String> characteristics) {}
