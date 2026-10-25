package com.ecodispatch.ecodispatch_backend.controller;

import com.ecodispatch.ecodispatch_backend.national_grid.NationalGridResponseDTO;
import com.ecodispatch.ecodispatch_backend.service.NationalGridCacheService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;

@RestController
@RequestMapping("/api/national-grid")
public class NationalGridController {

    private final NationalGridCacheService gridCacheService;

    public NationalGridController(NationalGridCacheService gridCacheService) {
        this.gridCacheService = gridCacheService;
    }

    @GetMapping("/current")
    public ResponseEntity<NationalGridResponseDTO> getCurrentNationalGridStatus() {
        NationalGridResponseDTO status = gridCacheService.getLatestNationalGridStatus();
        if (status == null) {
            return ResponseEntity.status(503).build();
        }
        return ResponseEntity.ok(status);
    }
}