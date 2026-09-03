package com.ecodispatch.ecodispatch_backend.profiles;

import com.ecodispatch.ecodispatch_backend.model.UserResponseDTO;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class EnergyProfileResponseDTO {
    private Integer id;
    private Double pvSystemKw;
    private Double latitude;
    private Double longitude;
    private UserResponseDTO user;

    public EnergyProfileResponseDTO() {
    }

}
