package com.armakers3d.quotations.domain;

import java.util.List;

/**
 * Life cycle of a quotation agreed with a customer over WhatsApp (RF08, RF09). A registered quotation is either
 * accepted (and may then generate the personalized order, RN08), rejected or left to expire; the three outcomes are
 * final.
 */
public enum QuotationStatus {
    REGISTRADA,
    ACEPTADA,
    RECHAZADA,
    VENCIDA;

    public List<QuotationStatus> allowedNext() {
        return this == REGISTRADA ? List.of(ACEPTADA, RECHAZADA, VENCIDA) : List.of();
    }

    public boolean canTransitionTo(QuotationStatus target) {
        return target != null && allowedNext().contains(target);
    }
}
