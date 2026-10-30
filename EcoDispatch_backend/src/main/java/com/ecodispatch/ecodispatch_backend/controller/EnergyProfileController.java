package com.ecodispatch.ecodispatch_backend.controller;

import com.ecodispatch.ecodispatch_backend.consumption.ConsumptionPredictionResponseDTO;
import com.ecodispatch.ecodispatch_backend.consumption.ConsumptionScenarioRequestDTO;
import com.ecodispatch.ecodispatch_backend.profile.EnergyProfileRequestDTO;
import com.ecodispatch.ecodispatch_backend.profile.EnergyProfileResponseDTO;
import com.ecodispatch.ecodispatch_backend.service.EnergyProfileService;
import com.ecodispatch.ecodispatch_backend.solar_forecast.SolarForecastResponseDTO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class EnergyProfileController {

    private final EnergyProfileService energyService;

    public EnergyProfileController(EnergyProfileService energyService) {
        this.energyService = energyService;
    }

    @GetMapping("/users/{userId}/energy")
    public EnergyProfileResponseDTO getEnergyProfile(@PathVariable Integer userId) {
        return energyService.getProfileByUserId(userId);
    }

    @PostMapping("/users/{userId}/energy")
    public EnergyProfileResponseDTO createEnergyProfile(
            @PathVariable Integer userId,
            @Valid @RequestBody EnergyProfileRequestDTO energyProfileRequestDTO) {
        return energyService.createEnergyProfile(userId, energyProfileRequestDTO);
    }

    @PutMapping("/users/{userId}/energy")
    public EnergyProfileResponseDTO updateEnergyProfile(
            @PathVariable Integer userId,
            @Valid @RequestBody EnergyProfileRequestDTO energyProfileRequestDTO) {
        return energyService.updateEnergyProfile(userId, energyProfileRequestDTO);
    }

    @GetMapping("/users/{userId}/solar-forecast")
    public List<SolarForecastResponseDTO> getSolarForecast(@PathVariable Integer userId) {
        return energyService.getSolarForecastForUser(userId);
    }

    @PostMapping("/predict-consumption")
    public ConsumptionPredictionResponseDTO predict(@RequestBody ConsumptionScenarioRequestDTO scenario) {
        return energyService.predictNationalConsumption(scenario);
    }
}