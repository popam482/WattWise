package com.ecodispatch.ecodispatch_backend.notification;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class NotificationSettingsRequestDTO {

    private Boolean notificationsEnabled;

    private Boolean emailNotificationsEnabled;

    private Boolean telegramNotificationsEnabled;

    /** When true, records consent + timestamp and enables the master switch. */
    private Boolean consentGiven;

    @Size(max = 64)
    private String telegramChatId;

    @Size(max = 32)
    private String phoneNumber;

    @Email
    @Size(max = 255)
    private String notificationEmail;

    /** Kept for backward compatibility with older clients. */
    private NotificationChannel preferredChannel;
}
