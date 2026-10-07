package com.armakers3d.orders.domain;

/** Delivery snapshot (contract review E18, D-04): address, district, optional notes (null when blank). */
public record DeliveryInfo(String address, String district, String notes) {}
