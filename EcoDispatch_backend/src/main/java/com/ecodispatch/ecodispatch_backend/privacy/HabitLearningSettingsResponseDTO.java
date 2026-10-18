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
    private String dataExplanation = "Folosim doar ora, ziua săptămânii, tipul aparatului și durata "
            + "pentru a calcula tipare agregate. Nu trimitem istoricul brut către serviciul ML.";
}
