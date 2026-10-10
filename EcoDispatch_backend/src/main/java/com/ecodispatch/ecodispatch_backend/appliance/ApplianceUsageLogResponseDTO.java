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

    public ApplianceUsageLogResponseDTO(Integer id, Integer id1, String name, LocalDateTime startTime, Integer durationMinutes, String status, Double savedCo2Grams, Double savedMoneyRon) {
        this.id = id;
        this.applianceId = id1;
        this.applianceName = name;
        this.startTime = startTime;
        this.durationMinutes = durationMinutes;
        this.status = status;
        this.savedCo2Grams = savedCo2Grams;
        this.savedMoneyRon = savedMoneyRon;
    }
}