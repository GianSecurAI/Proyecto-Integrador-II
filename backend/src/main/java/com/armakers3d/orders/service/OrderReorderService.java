package com.armakers3d.orders.service;

import com.armakers3d.catalog.domain.Product;
import com.armakers3d.catalog.domain.ProductCategory;
import com.armakers3d.catalog.repository.ProductRepository;
import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderLine;
import com.armakers3d.shared.error.ConflictException;
import com.armakers3d.shared.error.NotFoundException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * RF14 / RN10: "buy again" from the order history. Takes the products of one of the customer's own catalog orders and
 * returns them with their CURRENT price and availability, ready to be put in the cart. Nothing is created here: the
 * purchase still goes through the normal cart and checkout (a price is never taken from an old order).
 */
@Service
public class OrderReorderService {

    public record Item(
            Long productId,
            String title,
            ProductCategory category,
            String subcategory,
            BigDecimal unitPrice,
            int quantity,
            boolean available) {}

    public record Reorder(String orderId, List<Item> items) {
        public long availableCount() {
            return items.stream().filter(Item::available).count();
        }
    }

    private final OrderQueryService queries;
    private final ProductRepository products;

    public OrderReorderService(OrderQueryService queries, ProductRepository products) {
        this.queries = queries;
        this.products = products;
    }

    public Reorder reorder(Long customerId, String orderId) {
        Order order = queries.getForCustomer(customerId, orderId);
        if (order.kind() != OrderKind.ESTANDAR) {
            throw new OrderNotReorderableException();
        }
        List<Item> items = new ArrayList<>();
        for (OrderLine line : order.lines()) {
            if (line.productId() == null) {
                continue;
            }
            Product current = products.findById(line.productId()).orElse(null);
            if (current == null) {
                items.add(new Item(line.productId(), line.title(), null, null, line.unitPrice(), line.quantity(), false));
            } else {
                items.add(new Item(
                        current.id(), current.title(), current.category(), current.subcategory(), current.price(),
                        line.quantity(), current.available()));
            }
        }
        if (items.isEmpty()) {
            throw new NotFoundException("Order not found.");
        }
        return new Reorder(order.id(), items);
    }

    /** 409: only orders made from the catalog can be bought again; a personalized order was a one-off agreement. */
    public static class OrderNotReorderableException extends ConflictException {
        public OrderNotReorderableException() {
            super("ORDER_NOT_REORDERABLE", "Only orders made from the catalog can be bought again.");
        }
    }
}
