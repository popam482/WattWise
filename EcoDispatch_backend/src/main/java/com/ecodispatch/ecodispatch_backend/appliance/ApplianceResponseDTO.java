package com.ecodispatch.ecodispatch_backend.appliance;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ApplianceResponseDTO {
    private Integer id;
    private String name;
    private Double powerConsumptionKw;
    private Boolean isRecurring;
    private String recurringDays;
    private String preferredDuration;
    private String timeWindowStart;
    private String timeWindowEnd;

    public ApplianceResponseDTO(){}
}
