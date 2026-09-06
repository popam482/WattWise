package com.ecodispatch.ecodispatch_backend.controller;

import com.ecodispatch.ecodispatch_backend.appliance.ApplianceRecommendationResponseDTO;
import com.ecodispatch.ecodispatch_backend.appliance.ApplianceRequestDTO;
import com.ecodispatch.ecodispatch_backend.appliance.ApplianceResponseDTO;
import com.ecodispatch.ecodispatch_backend.appliance.ApplianceUsageLogRequestDTO;
import com.ecodispatch.ecodispatch_backend.service.ApplianceService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@CrossOrigin("*")
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
    public void logUsage(@PathVariable Integer userId, @RequestBody ApplianceUsageLogRequestDTO dto){
        applianceService.logApplianceUsage(userId, dto);
    }

    @PostMapping("users/{userId}/appliances/{applianceId}/recommendation")
    public ApplianceRecommendationResponseDTO getRecommendation(
            @PathVariable Integer userId,
            @PathVariable Integer applianceId,
            @RequestParam(defaultValue = "1") Integer durationHours){

        return applianceService.getBestTimeForAppliance(userId, applianceId, durationHours);

    }

}
