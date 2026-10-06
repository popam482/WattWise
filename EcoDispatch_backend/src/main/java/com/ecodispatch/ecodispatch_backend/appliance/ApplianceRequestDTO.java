package com.ecodispatch.ecodispatch_backend.appliance;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ApplianceRequestDTO {
    private String name;
    private double powerConsumptionKw;
    private Boolean isRecurring;
    private String recurringDays;
    private String preferredDuration;
    private String timeWindowStart;
    private String timeWindowEnd;

    public ApplianceRequestDTO() {}
}
