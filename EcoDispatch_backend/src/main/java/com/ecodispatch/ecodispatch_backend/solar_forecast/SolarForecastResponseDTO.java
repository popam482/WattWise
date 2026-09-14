package com.ecodispatch.ecodispatch_backend.solar_forecast;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonAlias;
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

    @JsonProperty("Cloud_Cover")
    @JsonAlias("Cloud_Cover_%")
    private Double cloudCover;

    @JsonProperty("Weather_Code")
    private Integer weatherCode;


    public SolarForecastResponseDTO() {}
}
