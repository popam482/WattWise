package com.ecodispatch.ecodispatch_backend.consumption;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ConsumptionPredictionResponseDTO {

    @JsonProperty("prognosed_consumption_mw")
    private String prognosedConsumptionMW;

    public ConsumptionPredictionResponseDTO() {}

}
