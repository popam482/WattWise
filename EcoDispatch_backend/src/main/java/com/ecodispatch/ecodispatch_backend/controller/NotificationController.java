package com.ecodispatch.ecodispatch_backend.controller;

import com.ecodispatch.ecodispatch_backend.notification.NotificationSettingsRequestDTO;
import com.ecodispatch.ecodispatch_backend.notification.NotificationSettingsResponseDTO;
import com.ecodispatch.ecodispatch_backend.notification.NotificationSettingsService;
import com.ecodispatch.ecodispatch_backend.notification.NotificationTestRequestDTO;
import com.ecodispatch.ecodispatch_backend.security.OwnershipGuard;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationSettingsService settingsService;
    private final OwnershipGuard ownershipGuard;

    public NotificationController(NotificationSettingsService settingsService, OwnershipGuard ownershipGuard) {
        this.settingsService = settingsService;
        this.ownershipGuard = ownershipGuard;
    }

    @GetMapping("/settings")
    public NotificationSettingsResponseDTO getMySettings() {
        Integer userId = ownershipGuard.requireAuthenticatedUserId();
        return settingsService.getSettings(userId);
    }

    @PutMapping("/settings")
    public NotificationSettingsResponseDTO updateMySettings(
            @Valid @RequestBody NotificationSettingsRequestDTO request) {
        Integer userId = ownershipGuard.requireAuthenticatedUserId();
        return settingsService.updateSettings(userId, request);
    }

    @GetMapping("/users/{userId}/settings")
    public NotificationSettingsResponseDTO getSettings(@PathVariable Integer userId) {
        return settingsService.getSettings(userId);
    }

    @PutMapping("/users/{userId}/settings")
    public NotificationSettingsResponseDTO updateSettings(
            @PathVariable Integer userId,
            @Valid @RequestBody NotificationSettingsRequestDTO request) {
        return settingsService.updateSettings(userId, request);
    }

    @PostMapping("/test")
    public Map<String, Object> sendTest(@RequestBody(required = false) NotificationTestRequestDTO request) {
        Integer userId = ownershipGuard.requireAuthenticatedUserId();
        return settingsService.sendTest(userId, request != null ? request : new NotificationTestRequestDTO());
    }
}
