package com.ecodispatch.ecodispatch_backend.notification;

import org.springframework.stereotype.Component;

@Component
public class NotificationMessageFormatter {

    public String formatBody(NotificationPayload payload) {
        String modeLabel = payload.getApplianceMode() == ApplianceMode.AUTOMATIC ? "Automatic" : "Manual";
        String headlineAction = payload.getAction() != null ? payload.getAction() : defaultAction(payload.getApplianceMode());
        String cta = payload.getApplianceMode() == ApplianceMode.AUTOMATIC
                ? "Your smart schedule has been started — no action needed."
                : "Please start your cycle now or set the delay timer!";

        return """
                ⚡ [WattWise Alert] %s your %s now!
                --------------------------------------------------
                • Mode: %s
                • Suggested Duration: %s
                • Reason: %s

                👉 %s
                """.formatted(
                headlineAction,
                safe(payload.getApplianceName(), "appliance"),
                modeLabel,
                safe(payload.getDurationLabel(), "—"),
                safe(payload.getReason(), "Optimal energy window detected."),
                cta
        ).stripTrailing();
    }

    public String formatSubject(NotificationPayload payload) {
        String name = safe(payload.getApplianceName(), "appliance");
        if (payload.getApplianceMode() == ApplianceMode.AUTOMATIC) {
            return "WattWise: automatic cycle started — " + name;
        }
        return "WattWise Alert: start your " + name + " now";
    }

    private static String defaultAction(ApplianceMode mode) {
        return mode == ApplianceMode.AUTOMATIC ? "Started" : "Start";
    }

    private static String safe(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
