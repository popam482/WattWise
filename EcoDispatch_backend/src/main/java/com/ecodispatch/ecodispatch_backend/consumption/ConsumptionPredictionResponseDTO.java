package com.ecodispatch.ecodispatch_backend.consumption;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
public class ConsumptionPredictionResponseDTO {

    @JsonProperty("prognosed_consumption_mw")
    private String prognosedConsumptionMW;

    @JsonProperty("feature_importance")
    private Map featureImportance;

    @JsonProperty("shap_contributions")
    private Map shapContributions;

    public ConsumptionPredictionResponseDTO() {}

}
