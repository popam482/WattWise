package com.ecodispatch.ecodispatch_backend.controller;

import com.ecodispatch.ecodispatch_backend.national_grid.NationalGridResponseDTO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

@RestController
@RequestMapping("/api/national-grid")
@CrossOrigin(origins = "*")
public class NationalGridController {

    private final RestTemplate restTemplate;

    @Value("${PYTHON_API_URL:http://localhost:8000}")
    private String pythonApiBaseUrl;

    public NationalGridController(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @GetMapping("/current")
    public NationalGridResponseDTO getCurrentNationalGridStatus() {
        String baseUrl = pythonApiBaseUrl.endsWith("/") ? pythonApiBaseUrl : pythonApiBaseUrl + "/";
        String url = baseUrl + "api/grid/status";

        return restTemplate.getForObject(url, NationalGridResponseDTO.class);
    }
}
