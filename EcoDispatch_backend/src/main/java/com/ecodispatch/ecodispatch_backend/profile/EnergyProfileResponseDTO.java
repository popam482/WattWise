package com.ecodispatch.ecodispatch_backend.profile;

import com.ecodispatch.ecodispatch_backend.user.UserResponseDTO;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class EnergyProfileResponseDTO {
    private Integer id;
    private Double pvSystemKw;
    private Double latitude;
    private Double longitude;
    private Double tilt;
    private Double azimuth;
    private boolean hasBattery;
    private Double batteryCapacityKwh;
    private Double batteryMaxChargeKw;
    private Double batteryMaxDischargeKw;
    private BatteryType batteryType;
    private UserResponseDTO user;

    public EnergyProfileResponseDTO() {
    }
}
