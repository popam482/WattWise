package com.ecodispatch.ecodispatch_backend.notification;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class NotificationSettingsResponseDTO {
    private Integer userId;
    private String accountEmail;
    private String notificationEmail;
    private String telegramChatId;
    private String phoneNumber;

    private Boolean notificationsEnabled;
    private Boolean emailNotificationsEnabled;
    private Boolean telegramNotificationsEnabled;

    private Boolean consentGiven;
    private LocalDateTime consentTimestamp;

    private NotificationChannel preferredChannel;

    private boolean telegramConfigured;
    private boolean emailConfigured;
    private boolean webhookConfigured;
}
