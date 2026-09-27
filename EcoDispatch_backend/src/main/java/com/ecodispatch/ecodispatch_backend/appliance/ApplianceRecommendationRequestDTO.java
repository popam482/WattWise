package com.ecodispatch.ecodispatch_backend.appliance;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;
import java.util.Map;

@Getter
@Setter
public class ApplianceRecommendationRequestDTO {

    @JsonProperty("user_type")
    private String userType;

    @JsonProperty("duration_hours")
    private Integer durationHours;

    @JsonProperty("power_kw")
    private Double powerKw;

    private Double lat;
    private Double lon;

    @JsonProperty("system_kwp")
    private Double systemKwp;

    private Double tilt;
    private Double azimuth;


    @JsonProperty("committed_power_per_hour")
    private Map<Integer, Double> committedPowerPerHour;

    public ApplianceRecommendationRequestDTO() {}
}