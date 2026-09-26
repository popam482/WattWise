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

    private String reason;

    @JsonProperty("decision_factors")
    private Map<String, Double> decisionFactors;

    public ApplianceRecommendationResponseDTO() {}
}
