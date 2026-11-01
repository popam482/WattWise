package com.ecodispatch.ecodispatch_backend.appliance;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
public class ApplianceRecommendationResponseDTO {

    @JsonProperty("best_start_time")
    private String bestStartTime;

    @JsonProperty("best_end_time")
    private String bestEndTime;

    @JsonProperty("total_green_energy_score")
    private Double totalGreenEnergyScore;

    @JsonProperty("recommended_carbon_intensity")
    private Double recommendedCarbonIntensity;

    @JsonProperty("baseline_carbon_intensity")
    private Double baselineCarbonIntensity;

    @JsonProperty("reason")
    private String reason;

    @JsonProperty("decision_factors")
    private Map<String, Double> decisionFactors;

    @JsonProperty("recommended_energy_price")
    private Double recommendedEnergyPrice;

    @JsonProperty("baseline_energy_price")
    private Double baselineEnergyPrice;

    @JsonProperty("single_run_savings_ron")
    private Double singleRunSavingsRon;

    @JsonProperty("co2_avoided_kg")
    private Double co2AvoidedKg;

    @JsonProperty("renewable_share_percent")
    private Double renewableSharePercent;

    @JsonProperty("is_fixed_tariff")
    private Boolean isFixedTariff;

    @JsonProperty("baseline_run_cost_ron")
    private Double baselineRunCostRon;

    @JsonProperty("optimal_run_cost_ron")
    private Double optimalRunCostRon;

    @JsonProperty("run_co2_kg")
    private Double runCo2Kg;

    @JsonProperty("co2_comparison_basis")
    private String co2ComparisonBasis;

    @JsonProperty("is_already_optimal")
    private Boolean isAlreadyOptimal;

    @JsonProperty("peak_run_co2_kg")
    private Double peakRunCo2Kg;
}