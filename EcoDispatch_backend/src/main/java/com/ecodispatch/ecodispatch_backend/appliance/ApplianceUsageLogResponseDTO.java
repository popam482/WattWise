package com.ecodispatch.ecodispatch_backend.appliance;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ApplianceUsageLogResponseDTO {

    private Integer id;
    private Integer applianceId;
    private String applianceName;
    private LocalDateTime startTime;
    private Integer durationMinutes;
    private String status;
    private Double savedCo2Grams;
    private Double savedMoneyRon;
    private Boolean recurring;
}