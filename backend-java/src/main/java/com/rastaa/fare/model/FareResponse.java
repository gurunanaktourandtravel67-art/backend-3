package com.rastaa.fare.model;

public class FareResponse {

    private String cabTypeId;
    private double distanceKm;
    private double baseFare;
    private double extraKmCharge;
    private double roundTripMultiplierApplied;
    private double total;

    public FareResponse(String cabTypeId, double distanceKm, double baseFare,
                         double extraKmCharge, double roundTripMultiplierApplied, double total) {
        this.cabTypeId = cabTypeId;
        this.distanceKm = distanceKm;
        this.baseFare = baseFare;
        this.extraKmCharge = extraKmCharge;
        this.roundTripMultiplierApplied = roundTripMultiplierApplied;
        this.total = total;
    }

    public String getCabTypeId() {
        return cabTypeId;
    }

    public double getDistanceKm() {
        return distanceKm;
    }

    public double getBaseFare() {
        return baseFare;
    }

    public double getExtraKmCharge() {
        return extraKmCharge;
    }

    public double getRoundTripMultiplierApplied() {
        return roundTripMultiplierApplied;
    }

    public double getTotal() {
        return total;
    }
}
