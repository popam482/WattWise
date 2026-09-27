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

    @JsonProperty("recommended_carbon_intensity")
    private Double recommendedCarbonIntensity;

    @JsonProperty("baseline_carbon_intensity")
    private Double baselineCarbonIntensity;

    @JsonProperty("reason")
    private String reason;

    @JsonProperty("decision_factors")
    private Map decisionFactors;
}