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
    private Double longitude;

    /** Human-readable locality resolved from coordinates (e.g. "Sibiu, Romania"). */
    @Column(length = 128)
    private String locationName;

    private Double tilt;
    private Double azimuth;

    /** Whether the site has behind-the-meter battery storage. */
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean hasBattery = false;

    /** Usable battery capacity in kWh. */
    private Double batteryCapacityKwh;

    /** Maximum continuous charge rate in kW. */
    private Double batteryMaxChargeKw;

    /** Maximum continuous discharge rate in kW. */
    private Double batteryMaxDischargeKw;

    @Enumerated(EnumType.STRING)
    private BatteryType batteryType;

    @OneToOne
    @JoinColumn(name = "user_id")
    private User user;

    public EnergyProfile() {
    }

    public EnergyProfile(Double latitude, Double pvSystemKw, Double longitude, Double tilt, Double azimuth) {
        this.latitude = latitude;
        this.pvSystemKw = pvSystemKw;
        this.longitude = longitude;
        this.tilt = tilt;
        this.azimuth = azimuth;
    }
}
