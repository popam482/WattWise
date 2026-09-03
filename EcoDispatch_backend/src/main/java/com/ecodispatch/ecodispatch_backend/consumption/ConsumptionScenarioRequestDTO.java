package com.ecodispatch.ecodispatch_backend.consumption;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ConsumptionScenarioRequestDTO {

    @JsonProperty("Total_Green")
    private Double totalGreen;

    @JsonProperty("Nuclear")
    private Double nuclear;

    @JsonProperty("Total_Fossil")
    private Double totalFossil;

    @JsonProperty("Hour")
    private Integer hour;

    @JsonProperty("Day")
    private Integer day;

    @JsonProperty("Month")
    private Integer month;

    @JsonProperty("Consumption_Lag_1h")
    private Integer consumptionLag1h;

    @JsonProperty("Consumption_Lag_24h")
    private Integer consumptionLag24h;

    @JsonProperty("Consumption_Rolling_24h")
    private Double consumptionRolling24h;

    public ConsumptionScenarioRequestDTO() {
    }
}
