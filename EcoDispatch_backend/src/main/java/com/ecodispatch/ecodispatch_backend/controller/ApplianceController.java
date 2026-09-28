package com.ecodispatch.ecodispatch_backend.controller;

import com.ecodispatch.ecodispatch_backend.analytics.EcoAnalyticsDTO;
import com.ecodispatch.ecodispatch_backend.appliance.*;
import com.ecodispatch.ecodispatch_backend.service.ApplianceService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@CrossOrigin(origins = "*")
public class ApplianceController {

    private final ApplianceService applianceService;

    public ApplianceController(ApplianceService applianceService) {
        this.applianceService = applianceService;
    }

    @GetMapping("users/{userId}/appliances")
    public List<ApplianceResponseDTO> getAppliancesByUserId(@PathVariable("userId") Integer userId) {
        return applianceService.getUserAppliance(userId);
    }

    @PostMapping("/users/{userId}/appliances")
    public ApplianceResponseDTO addAppliance(@PathVariable Integer userId, @RequestBody ApplianceRequestDTO dto) {
        return applianceService.addAppliance(userId, dto);
    }

    @PostMapping("/users/{userId}/appliances/log")
    public void logUsage(@PathVariable Integer userId, @RequestBody ApplianceUsageLogRequestDTO dto) {
        applianceService.logApplianceUsage(userId, dto);
    }

    @PostMapping("/users/{userId}/appliances/{applianceId}/recommendation")
    public ApplianceRecommendationResponseDTO getRecommendation(
            @PathVariable Integer userId,
            @PathVariable Integer applianceId,
            @RequestParam(defaultValue = "1") Integer durationHours) {

        return applianceService.getBestTimeForAppliance(userId, applianceId, durationHours);

    }

    @DeleteMapping("/users/{userId}/appliances/{applianceId}")
    public void deleteAppliance(@PathVariable Integer userId, @PathVariable Integer applianceId) {
        applianceService.deleteAppliance(userId, applianceId);
    }

    @PutMapping("/users/{userId}/appliances/{applianceId}")
    public ApplianceResponseDTO updateAppliance(
            @PathVariable Integer userId,
            @PathVariable Integer applianceId,
            @RequestBody ApplianceRequestDTO dto) {
        return applianceService.updateAppliance(userId, applianceId, dto);
    }

    @PostMapping("/users/{userId}/appliances/schedule")
    public void scheduleUsage(@PathVariable Integer userId, @RequestBody ApplianceUsageLogRequestDTO dto) {
        applianceService.scheduleApplianceUsage(userId, dto);
    }

    @GetMapping("/users/{userId}/appliances/scheduled")
    public List<ApplianceUsageLogResponseDTO> getScheduledTasks(
            @PathVariable Integer userId,
            @RequestParam(required = false) String date) {
        return applianceService.getUserScheduledTasks(userId, date);
    }

    @DeleteMapping("/users/{userId}/appliances/scheduled/{logId}")
    public void cancelScheduledTask(@PathVariable Integer userId, @PathVariable Integer logId) {
        applianceService.cancelScheduledTask(userId, logId);
    }

    @GetMapping("/users/{userId}/eco-analytics")
    public EcoAnalyticsDTO getEcoAnalytics(@PathVariable Integer userId) {
        return applianceService.getUserEcoAnalytics(userId);
    }
}
