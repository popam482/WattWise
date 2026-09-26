package com.ecodispatch.ecodispatch_backend.controller;

import com.ecodispatch.ecodispatch_backend.national_grid.NationalGridResponseDTO;
import com.ecodispatch.ecodispatch_backend.service.NationalGridCacheService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/national-grid")
@CrossOrigin(origins = "*")
public class NationalGridController {

    private final NationalGridCacheService gridCacheService;

    public NationalGridController(NationalGridCacheService gridCacheService) {
        this.gridCacheService = gridCacheService;
    }

    @GetMapping("/current")
    public NationalGridResponseDTO getCurrentNationalGridStatus() {
        return gridCacheService.getLatestNationalGridStatus();
    }
}