package com.ecodispatch.ecodispatch_backend.profiles;

public class EnergyProfileRequestDTO {

    private Double latitude;
    private Double longitude;

    private Double pvSystemKw;

    public EnergyProfileRequestDTO() {
    }

    public Double getLatitude() {
        return latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public Double getPvSystemKw() {
        return pvSystemKw;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public void setPvSystemKw(Double pvSystemKw) {
        this.pvSystemKw = pvSystemKw;
    }
}
