package com.ecodispatch.ecodispatch_backend.profile;

import com.ecodispatch.ecodispatch_backend.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
public class EnergyProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    private Double pvSystemKw;

    private Double latitude;
    @Getter
    private Double longitude;

    private Double tilt;
    private Double azimuth;

    @OneToOne
    @JoinColumn(name = "user_id")
    private User user;

    public EnergyProfile() {
    }

    public EnergyProfile(Double latitude, Double pvSystemKw, Double longitude,  Double tilt, Double azimuth) {
        this.latitude = latitude;
        this.pvSystemKw = pvSystemKw;
        this.longitude = longitude;
        this.tilt = tilt;
        this.azimuth = azimuth;
    }

}
