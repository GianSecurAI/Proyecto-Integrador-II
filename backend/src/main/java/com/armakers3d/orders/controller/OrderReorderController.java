package com.armakers3d.orders.controller;

import com.armakers3d.auth.security.AuthenticatedUser;
import com.armakers3d.catalog.domain.ProductCategory;
import com.armakers3d.orders.service.OrderReorderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
@Tag(name = "Orders", description = "Orders of the authenticated customer.")
public class OrderReorderController {

    /** One product of the order with its current price and availability. */
    public record ReorderItemDto(
            Long productId,
            String title,
            ProductCategory category,
            String subcategory,
            BigDecimal unitPrice,
            int quantity,
            boolean available) {}

    public record ReorderDto(String orderId, List<ReorderItemDto> items, long availableCount) {}

    private final OrderReorderService service;

    public OrderReorderController(OrderReorderService service) {
        this.service = service;
    }

    @GetMapping("/{orderId}/reorder")
    @Operation(
            summary = "Products of one of my catalog orders with their current price and availability (buy again)",
            description = "Owner only (404 otherwise). A personalized order is 409 ORDER_NOT_REORDERABLE. Nothing is"
                    + " created: the client puts the available items in the cart and checks out as usual.")
    public ReorderDto reorder(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String orderId) {
        var result = service.reorder(user.id(), orderId);
        return new ReorderDto(
                result.orderId(),
                result.items().stream()
                        .map(i -> new ReorderItemDto(
                                i.productId(), i.title(), i.category(), i.subcategory(), i.unitPrice(), i.quantity(),
                                i.available()))
                        .toList(),
                result.availableCount());
    }
}
