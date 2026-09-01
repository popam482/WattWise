package com.ecodispatch.ecodispatch_backend.profiles;

import com.ecodispatch.ecodispatch_backend.model.UserResponseDTO;

public class EnergyProfileResponseDTO {
    private Integer id;
    private Double pvSystemKw;
    private Double latitude;
    private Double longitude;
    private UserResponseDTO user;

    public EnergyProfileResponseDTO() {
    }

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public Double getPvSystemKw() { return pvSystemKw; }
    public void setPvSystemKw(Double pvSystemKw) { this.pvSystemKw = pvSystemKw; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public UserResponseDTO getUser() { return user; }
    public void setUser(UserResponseDTO user) { this.user = user; }

}
