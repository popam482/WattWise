package com.ecodispatch.ecodispatch_backend.appliance;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
public class ApplianceUsageLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "appliance_id", nullable = false)
    private Appliance appliance;

    private LocalDateTime startTime;

    private Integer durationMinutes;

    private String status = "COMPLETED";

    private Double recommendedCarbonIntensity;
    private Double baselineCarbonIntensity;

    private Double recommendedEnergyPrice;
    private Double baselineEnergyPrice;

    private Double savedCo2Grams;
    private Double savedMoneyRon;

    public ApplianceUsageLog() {}
}
