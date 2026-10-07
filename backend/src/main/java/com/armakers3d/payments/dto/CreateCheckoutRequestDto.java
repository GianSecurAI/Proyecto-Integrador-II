package com.armakers3d.payments.dto;

import com.armakers3d.orders.domain.OrderRules;
import com.armakers3d.orders.dto.StrictIntegerDeserializer;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Request of {@code POST /api/checkout} (ADR-004 2.2, ADR-cart-state). The ONLY inputs are the cart lines (product id
 * and quantity), the delivery data and the contact data of the checkout form. There is deliberately no field for
 * price, subtotal, total, status, currency, role, customer id, email or any payment data: unknown JSON properties
 * are ignored (project convention), so a forged value is never bound and has no effect. Structural limits here
 * mirror {@link OrderRules}, which re-validates everything server-side.
 */
public record CreateCheckoutRequestDto(
        @NotNull @Size(min = 1, max = OrderRules.ITEMS_MAX, message = "must contain between 1 and 50 items")
                List<@NotNull @Valid Item> items,
        @NotNull @Valid Delivery delivery,
        @NotNull @Valid Contact contact) {

    public record Item(
            @NotNull @Positive Long productId,
            // Strict: 2.5 or "2" are rejected (400 MALFORMED_REQUEST) instead of being coerced to 2.
            @NotNull
                    @Min(value = OrderRules.QUANTITY_MIN, message = "must be between 1 and 99")
                    @Max(value = OrderRules.QUANTITY_MAX, message = "must be between 1 and 99")
                    @JsonDeserialize(using = StrictIntegerDeserializer.class)
                    Integer quantity) {}

    public record Delivery(
            @NotBlank @Size(max = OrderRules.ADDRESS_MAX, message = "must be at most 200 characters") String address,
            @NotBlank @Size(max = OrderRules.DISTRICT_MAX, message = "must be at most 80 characters") String district,
            @Size(max = OrderRules.NOTES_MAX, message = "must be at most 300 characters") String notes) {}

    public record Contact(
            @NotBlank @Size(max = OrderRules.FULL_NAME_MAX, message = "must be at most 160 characters") String fullName,
            @NotBlank
                    @Pattern(
                            regexp = OrderRules.PHONE_REGEX,
                            message = "must be 6-20 characters: digits, +, -, spaces or parentheses")
                    String phone) {}
}
