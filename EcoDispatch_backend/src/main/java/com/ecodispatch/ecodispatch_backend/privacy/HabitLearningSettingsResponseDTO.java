package com.ecodispatch.ecodispatch_backend.privacy;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
public class HabitLearningSettingsResponseDTO {

    private boolean enabled;
    private Instant consentedAt;
    private int retentionDays;
    private String dataExplanation = "We use only the time, day of the week, device type, and duration "
            + "to calculate aggregated patterns. We do not send raw history to the ML service.";
}
