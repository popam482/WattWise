package com.ecodispatch.ecodispatch_backend.controller;

import com.ecodispatch.ecodispatch_backend.profiles.EnergyProfileRequestDTO;
import com.ecodispatch.ecodispatch_backend.profiles.EnergyProfileResponseDTO;
import com.ecodispatch.ecodispatch_backend.service.EnergyProfileService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

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
}