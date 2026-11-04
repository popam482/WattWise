package com.ecodispatch.ecodispatch_backend.controller;

import com.ecodispatch.ecodispatch_backend.notification.NotificationSettingsRequestDTO;
import com.ecodispatch.ecodispatch_backend.notification.NotificationSettingsResponseDTO;
import com.ecodispatch.ecodispatch_backend.notification.NotificationSettingsService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users/me/notifications")
public class UserNotificationController {

    private final NotificationSettingsService settingsService;

    public UserNotificationController(NotificationSettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    public NotificationSettingsResponseDTO getMyNotificationSettings() {
        return settingsService.getMySettings();
    }

    @PutMapping
    public NotificationSettingsResponseDTO updateMyNotificationSettings(
            @Valid @RequestBody NotificationSettingsRequestDTO request) {
        return settingsService.updateMySettings(request);
    }
}
