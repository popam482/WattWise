package com.ecodispatch.ecodispatch_backend.appliance;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ApplianceRequestDTO {
    private String name;
    private double powerConsumptionKw;

    public ApplianceRequestDTO() {}
}
