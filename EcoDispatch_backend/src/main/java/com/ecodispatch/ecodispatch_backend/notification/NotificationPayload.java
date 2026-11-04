package com.ecodispatch.ecodispatch_backend.notification;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class NotificationPayload {
    private final String applianceName;
    private final ApplianceMode applianceMode;
    private final String action;
    private final String durationLabel;
    private final String reason;
    private final Integer userId;
}
