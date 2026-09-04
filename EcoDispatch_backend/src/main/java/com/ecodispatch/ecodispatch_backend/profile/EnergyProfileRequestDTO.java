package com.ecodispatch.ecodispatch_backend.profile;

import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class EnergyProfileRequestDTO {

    private Double latitude;
    private Double longitude;

    private Double pvSystemKw;

    public EnergyProfileRequestDTO() {
    }

}
