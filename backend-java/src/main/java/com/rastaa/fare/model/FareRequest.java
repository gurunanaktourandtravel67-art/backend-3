package com.rastaa.fare.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

public class FareRequest {

    @NotBlank
    private String cabTypeId;

    @PositiveOrZero
    private double distanceKm;

    /** e.g. "outstation-oneway", "outstation-round", "local", "airport" */
    private String tripType;

    // Optional overrides for this cab type's rates — sent by Node, sourced
    // from MongoDB (admin-editable "meter rates"), so an admin price change
    // takes effect on the actual charged fare, not just the displayed one.
    // Null means "not provided" — falls back to this service's own
    // CabType enum defaults, so the service still works standalone (e.g.
    // if Node's DB lookup fails) or against an older client.
    private Double baseFare;
    private Double perKm;
    private Integer includedKm;

    public String getCabTypeId() {
        return cabTypeId;
    }

    public void setCabTypeId(String cabTypeId) {
        this.cabTypeId = cabTypeId;
    }

    public double getDistanceKm() {
        return distanceKm;
    }

    public void setDistanceKm(double distanceKm) {
        this.distanceKm = distanceKm;
    }

    public String getTripType() {
        return tripType;
    }

    public void setTripType(String tripType) {
        this.tripType = tripType;
    }

    public Double getBaseFare() {
        return baseFare;
    }

    public void setBaseFare(Double baseFare) {
        this.baseFare = baseFare;
    }

    public Double getPerKm() {
        return perKm;
    }

    public void setPerKm(Double perKm) {
        this.perKm = perKm;
    }

    public Integer getIncludedKm() {
        return includedKm;
    }

    public void setIncludedKm(Integer includedKm) {
        this.includedKm = includedKm;
    }
}
