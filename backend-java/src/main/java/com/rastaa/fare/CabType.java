package com.rastaa.fare;

import java.util.Arrays;
import java.util.Optional;

/**
 * Pricing rules per cab type. Kept in sync with frontend/lib/data.js and
 * backend-node/data/cabTypes.js — this copy is the source of truth used for
 * actual fare calculation.
 */
public enum CabType {
    HATCHBACK("hatchback", 50, 700.0, 17.5),
    SEDAN("sedan", 50, 875.0, 13.0),
    SUV("suv", 50, 1400.0, 15.0),
    PRIME_SEDAN("prime-sedan", 50, 1540.0, 18.5),
    PRIME_SUV("prime-suv", 50, 1925.0, 21.0);

    private final String id;
    private final int includedKm;
    private final double baseFare;
    private final double perKmRate;

    CabType(String id, int includedKm, double baseFare, double perKmRate) {
        this.id = id;
        this.includedKm = includedKm;
        this.baseFare = baseFare;
        this.perKmRate = perKmRate;
    }

    public String getId() {
        return id;
    }

    public int getIncludedKm() {
        return includedKm;
    }

    public double getBaseFare() {
        return baseFare;
    }

    public double getPerKmRate() {
        return perKmRate;
    }

    public static Optional<CabType> fromId(String id) {
        return Arrays.stream(values()).filter(c -> c.id.equalsIgnoreCase(id)).findFirst();
    }
}
