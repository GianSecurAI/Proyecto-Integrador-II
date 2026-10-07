package com.armakers3d.orders.domain;

/**
 * Contact snapshot taken from the checkout form (full name and phone). The email is NOT here: it is
 * the account email and comes from the authenticated principal only.
 */
public record ContactInfo(String fullName, String phone) {}
