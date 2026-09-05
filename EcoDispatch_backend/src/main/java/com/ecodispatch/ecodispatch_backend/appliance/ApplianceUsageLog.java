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

    public ApplianceUsageLog() {}
}
