package com.ecodispatch.ecodispatch_backend.privacy;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class HabitLearningSettingsRequestDTO {

    @NotNull
    private Boolean enabled;

    @Min(7)
    @Max(365)
    private Integer retentionDays;
}
