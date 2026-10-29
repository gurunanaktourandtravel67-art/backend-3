package com.rastaa.fare;

import com.rastaa.fare.model.FareRequest;
import com.rastaa.fare.model.FareResponse;
import org.springframework.stereotype.Service;

@Service
public class FareService {

    private static final double ROUND_TRIP_MULTIPLIER = 1.9; // return leg isn't quite 2x
    private static final double LOCAL_HOURLY_MULTIPLIER = 0.6; // hourly local packages price lower per km

    public FareResponse calculate(FareRequest request) {
        CabType cabType = CabType.fromId(request.getCabTypeId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Unknown cabTypeId: " + request.getCabTypeId()));

        // Admin-edited "meter rates" (base fare / per-km / included km) live
        // in MongoDB and are sent by Node on every request — that's the
        // actual source of truth. The CabType enum below is only the
        // fallback for when no override is provided.
        double baseFare = request.getBaseFare() != null ? request.getBaseFare() : cabType.getBaseFare();
        double perKmRate = request.getPerKm() != null ? request.getPerKm() : cabType.getPerKmRate();
        int includedKm = request.getIncludedKm() != null ? request.getIncludedKm() : cabType.getIncludedKm();

        double distanceKm = Math.max(0, request.getDistanceKm());
        double extraKm = Math.max(0, distanceKm - includedKm);
        double extraKmCharge = extraKm * perKmRate;

        double multiplier = tripMultiplier(request.getTripType());
        double subtotal = (baseFare + extraKmCharge) * multiplier;

        double total = Math.round(subtotal * 100.0) / 100.0;

        return new FareResponse(
                cabType.getId(),
                distanceKm,
                baseFare,
                Math.round(extraKmCharge * 100.0) / 100.0,
                multiplier,
                total
        );
    }

    private double tripMultiplier(String tripType) {
        if (tripType == null) return 1.0;
        return switch (tripType) {
            case "outstation-round" -> ROUND_TRIP_MULTIPLIER;
            case "local" -> LOCAL_HOURLY_MULTIPLIER;
            default -> 1.0; // outstation-oneway, airport
        };
    }
}
