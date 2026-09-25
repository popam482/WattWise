package com.ecodispatch.ecodispatch_backend.national_grid;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
public class PredictionExplanationDTO {
    @JsonProperty("Predicted_Consumption_MW")
    private Double predictedConsumptionMW;

    @JsonProperty("Shap_Contributions")
    private Map<String, Double> shapContributions;

    public PredictionExplanationDTO() {}
}