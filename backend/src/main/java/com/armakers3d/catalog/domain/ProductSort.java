package com.armakers3d.catalog.domain;

import com.armakers3d.shared.error.MalformedRequestException;
import java.util.Comparator;
import java.util.Locale;

/** Whitelisted sort ({@code price | title | createdAt}, optional {@code ,asc|desc}); default createdAt desc. */
public record ProductSort(Field field, boolean descending) {

    public enum Field {
        PRICE("price", Comparator.comparing(Product::price)),
        TITLE("title", Comparator.comparing((Product p) -> p.title().toLowerCase(Locale.ROOT))),
        CREATED_AT("createdAt", Comparator.comparing(Product::createdAt));

        private final String wireName;
        private final Comparator<Product> comparator;

        Field(String wireName, Comparator<Product> comparator) {
            this.wireName = wireName;
            this.comparator = comparator;
        }
    }

    public static final ProductSort DEFAULT = new ProductSort(Field.CREATED_AT, true);

    public static ProductSort parse(String sort) {
        if (sort == null || sort.isBlank()) {
            return DEFAULT;
        }
        String[] parts = sort.split(",", -1);
        Field field = null;
        for (Field f : Field.values()) {
            if (f.wireName.equals(parts[0].trim())) {
                field = f;
            }
        }
        boolean directionOk = parts.length == 1
                || (parts.length == 2
                        && ("asc".equalsIgnoreCase(parts[1].trim()) || "desc".equalsIgnoreCase(parts[1].trim())));
        if (field == null || !directionOk) {
            throw new MalformedRequestException(
                    "sort must be one of price, title, createdAt optionally followed by ,asc or ,desc.");
        }
        return new ProductSort(field, parts.length == 2 && "desc".equalsIgnoreCase(parts[1].trim()));
    }

    /** Stable total order: the chosen field, then id in the same direction. */
    public Comparator<Product> comparator() {
        Comparator<Product> c = field.comparator.thenComparing(Product::id);
        return descending ? c.reversed() : c;
    }
}
