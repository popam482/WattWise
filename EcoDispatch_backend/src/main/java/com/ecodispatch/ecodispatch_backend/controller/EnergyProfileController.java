package com.ecodispatch.ecodispatch_backend.controller;

import com.ecodispatch.ecodispatch_backend.profiles.EnergyProfileRequestDTO;
import com.ecodispatch.ecodispatch_backend.profiles.EnergyProfileResponseDTO;
import com.ecodispatch.ecodispatch_backend.service.EnergyProfileService;
import com.ecodispatch.ecodispatch_backend.solar_forecast.SolarForecastResponseDTO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@CrossOrigin("*")
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

    @GetMapping("/users/{userId}/solar-forecast")
    public List<SolarForecastResponseDTO> getSolarForecast(@PathVariable Integer userId) {
        return energyService.getSolarForecastForUser(userId);
    }
}