package com.ecodispatch.ecodispatch_backend.service;

import com.ecodispatch.ecodispatch_backend.national_grid.NationalGridResponseDTO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.logging.Logger;

@Service
public class NationalGridCacheService {

    private static final Logger logger = Logger.getLogger(NationalGridCacheService.class.getName());

    private final RestTemplate restTemplate;

    @Value("${PYTHON_API_URL:http://localhost:8000}")
    private String pythonApiBaseUrl;

    private volatile NationalGridResponseDTO cachedGridStatus;

    public NationalGridCacheService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    private String pythonApiUrl(String endpoint) {
        String baseUrl = pythonApiBaseUrl.endsWith("/") ? pythonApiBaseUrl : pythonApiBaseUrl + "/";
        return baseUrl + endpoint;
    }

    // Give the ML API a short warmup window, then refresh every 5 minutes
    @Scheduled(fixedRate = 300000, initialDelay = 15000)
    public void refreshNationalGridCache() {
        try {
            String url = pythonApiUrl("api/grid/status");
            NationalGridResponseDTO freshData = restTemplate.getForObject(url, NationalGridResponseDTO.class);
            if (freshData != null) {
                this.cachedGridStatus = freshData;
                logger.info("SEN Grid Data refreshed successfully in cache.");
            }
        } catch (Exception e) {
            logger.warning("Failed to refresh SEN grid cache: " + e.getMessage());
            // keep old cache in case of failure
        }
    }

    public NationalGridResponseDTO getLatestNationalGridStatus() {
        if (cachedGridStatus == null) {
            refreshNationalGridCache();
        }
        return cachedGridStatus;
    }
}
