package com.ecodispatch.ecodispatch_backend.analytics;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class EcoAnalyticsDTO {
    private Double totalSavedCo2Kg;
    private Double totalSavedMoneyRon;
    private Integer totalCompletedTasks;
    private Double equivalentCarKm;
    private Double equivalentTreesPlanted;
    private List dailyImpactHistory;

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class DailyImpactDTO {
        private String date;
        private Double baselineCo2Kg;
        private Double actualCo2Kg;
        private Double savedCo2Kg;
    }
}