package com.ecodispatch.ecodispatch_backend.privacy;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class HabitLearningAggregateDTO {

    private String applianceType;
    private int dayOfWeek;
    private int hourOfDay;
    private long occurrenceCount;
    private long totalDurationMinutes;
}
