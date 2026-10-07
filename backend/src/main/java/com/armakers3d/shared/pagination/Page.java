package com.armakers3d.shared.pagination;

import java.util.List;
import java.util.function.Function;

/**
 * Persistence-neutral page, also the wire shape of every collection endpoint (contract review
 * section 4.0): {@code {content, page, size, totalElements, totalPages}}.
 */
public record Page<T>(List<T> content, int page, int size, long totalElements, int totalPages) {

    public static <T> Page<T> of(List<T> all, PageRequest request) {
        int from = (int) Math.min(request.offset(), all.size());
        int to = Math.min(from + request.size(), all.size());
        int totalPages = (int) ((all.size() + request.size() - 1L) / request.size());
        return new Page<>(List.copyOf(all.subList(from, to)), request.page(), request.size(), all.size(), totalPages);
    }

    public <R> Page<R> map(Function<T, R> mapper) {
        return new Page<>(content.stream().map(mapper).toList(), page, size, totalElements, totalPages);
    }
}
