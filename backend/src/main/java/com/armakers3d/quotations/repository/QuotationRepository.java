package com.armakers3d.quotations.repository;

import com.armakers3d.quotations.domain.Quotation;
import com.armakers3d.quotations.domain.QuotationSearchCriteria;
import com.armakers3d.quotations.domain.QuotationStatus;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

/** Port of the quotation store. Adapters: in-memory (nodb profile and tests) and PostgreSQL (table cotizacion). */
public interface QuotationRepository {

    /** Inserts when {@code quotation.id()} is null (assigning the id), otherwise overwrites the stored one. */
    Quotation save(Quotation quotation);

    Optional<Quotation> findById(Long id);

    /** Newest first (quotedAt desc, id desc). */
    Page<Quotation> search(QuotationSearchCriteria criteria, PageRequest pageRequest);

    /** Compare-and-set: stores {@code updated} only if the stored quotation is still in {@code expected}. */
    boolean replaceIfStatus(Quotation updated, QuotationStatus expected);

    record Aggregate(Map<QuotationStatus, Long> countByStatus, Map<QuotationStatus, BigDecimal> amountByStatus) {}

    /** Counts and agreed amounts per status for quotations registered in [from, toExclusive). */
    Aggregate aggregate(Instant from, Instant toExclusive);
}
