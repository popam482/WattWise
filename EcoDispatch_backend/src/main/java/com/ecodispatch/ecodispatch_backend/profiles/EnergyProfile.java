package com.ecodispatch.ecodispatch_backend.profiles;

import com.ecodispatch.ecodispatch_backend.model.User;
import jakarta.persistence.*;

@Entity
public class EnergyProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    private Integer pvSystemKw;

    private Integer latitude;
    private Integer longitude;

    @OneToOne
    @JoinColumn(name = "user_id")
    private User user;

    public EnergyProfile() {
    }

    public EnergyProfile(Integer latitude, Integer pvSystemKw, Integer longitude) {
        this.latitude = latitude;
        this.pvSystemKw = pvSystemKw;
        this.longitude = longitude;
    }

    public Integer getPvSystemKw() {
        return pvSystemKw;
    }

    public Integer getLatitude() {
        return latitude;
    }

    public Integer getLongitude() {
        return longitude;
    }

    public void setPvSystemKw(Integer pvSystemKw) {
        this.pvSystemKw = pvSystemKw;
    }

    public void setLatitude(Integer latitude) {
        this.latitude = latitude;
    }

    public void setLongitude(Integer longitude) {
        this.longitude = longitude;
    }
}
