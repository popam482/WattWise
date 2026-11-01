package com.ecodispatch.ecodispatch_backend.appliance;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class ApplianceUsageLogRequestDTO {

    private Integer id;
    private LocalDateTime startTime;
    private Integer durationMinutes;
    private Double recommendedCarbonIntensity;
    private Double baselineCarbonIntensity;
    private Double baselineEnergyPrice;
    private Double recommendedEnergyPrice;
    /** Rigorous single-run savings from ML RunCost delta (optional). */
    private Double savedMoneyRon;
    /** Rigorous CO₂ avoided in kg from ML grid-carbon delta (optional). */
    private Double savedCo2Kg;
}
