package com.ecodispatch.ecodispatch_backend.profiles;

public class EnergyProfileRequestDTO {

    private Integer latitude;
    private Integer longitude;

    private Integer pvSystemKw;

    public EnergyProfileRequestDTO() {
    }

    public Integer getLatitude() {
        return latitude;
    }

    public Integer getLongitude() {
        return longitude;
    }

    public Integer getPvSystemKw() {
        return pvSystemKw;
    }

    public void setLatitude(Integer latitude) {
        this.latitude = latitude;
    }

    public void setLongitude(Integer longitude) {
        this.longitude = longitude;
    }

    public void setPvSystemKw(Integer pvSystemKw) {
        this.pvSystemKw = pvSystemKw;
    }
}
