package com.ecodispatch.ecodispatch_backend.profiles;

import com.ecodispatch.ecodispatch_backend.model.User;
import jakarta.persistence.*;

@Entity
public class EnergyProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    private Double pvSystemKw;

    private Double latitude;
    private Double longitude;

    @OneToOne
    @JoinColumn(name = "user_id")
    private User user;

    public EnergyProfile() {
    }

    public EnergyProfile(Double latitude, Double pvSystemKw, Double longitude) {
        this.latitude = latitude;
        this.pvSystemKw = pvSystemKw;
        this.longitude = longitude;
    }

    public Double getPvSystemKw() {
        return pvSystemKw;
    }

    public Double getLatitude() {
        return latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setPvSystemKw(Double pvSystemKw) {
        this.pvSystemKw = pvSystemKw;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }
}
