package com.armakers3d.shared.pagination;

/** Persistence-neutral paging input (backend-foundation.md section 10); 0-based page. */
public record PageRequest(int page, int size) {

    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 100;

    public PageRequest {
        if (page < 0 || size < 1 || size > MAX_SIZE) {
            throw new IllegalArgumentException("page must be >= 0 and size within 1.." + MAX_SIZE);
        }
    }

    /** Long on purpose: {@code page * size} overflows int for a hostile page number (a 500 instead of an empty page). */
    public long offset() {
        return (long) page * size;
    }
}
