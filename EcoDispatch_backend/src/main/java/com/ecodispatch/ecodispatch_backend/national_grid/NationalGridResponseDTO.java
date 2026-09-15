package com.ecodispatch.ecodispatch_backend.national_grid;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class NationalGridResponseDTO {
    @JsonProperty("Total_Green_MW")
    private Double totalGreenMW;

    @JsonProperty("Total_Fossil")
    private Double totalFossil;

    @JsonProperty("Nuclear_MW")
    private Double nuclearMW;

    @JsonProperty("Green_Share_Percent")
    private Double greenSharePercent;

    @JsonProperty("Predicted_Consumption_MW")
    private Double predictedConsumptionMW;

    @JsonProperty("Production_MW")
    private Double productionMW;

    @JsonProperty("Balance_MW")
    private Double balanceMW;

    @JsonProperty("Timestamp")
    private String timestamp;

    public NationalGridResponseDTO() {}
}