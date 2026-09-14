package com.ecodispatch.ecodispatch_backend.solar_forecast;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SolarForecastResponseDTO {

    @JsonProperty("Time")
    private String time;

    @JsonProperty("Irradiance_W_m2")
    private Double irradiance;

    @JsonProperty("Temp_C")
    private Double tempC;

    @JsonProperty("Estimated_PV_Power_kW")
    private Double estimatedPVPowerKW;

    @JsonProperty("Cloud_Cover_%")
    private double cloudCover;

    @JsonProperty("Weather_Code")
    private Integer weatherCode;


    public SolarForecastResponseDTO() {}
}
