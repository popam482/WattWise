package com.ecodispatch.ecodispatch_backend.appliance;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RecommendationResponseDTO {

    @JsonProperty("best_start_time")
    private String bestStartTime;

    @JsonProperty("best_end_time")
    private String bestEndTime;

    @JsonProperty("total_green_energy_score")
    private Double totalGreenEnergyScore;

    private String reason;

    public RecommendationResponseDTO() {}
}
