package com.ecodispatch.ecodispatch_backend.service;

import com.ecodispatch.ecodispatch_backend.appliance.*;
import com.ecodispatch.ecodispatch_backend.errors.ApplianceNotFound;
import com.ecodispatch.ecodispatch_backend.errors.UserNotFound;
import com.ecodispatch.ecodispatch_backend.repositories.ApplianceUsageLogRepository;
import com.ecodispatch.ecodispatch_backend.user.User;
import com.ecodispatch.ecodispatch_backend.repositories.ApplianceRepository;
import com.ecodispatch.ecodispatch_backend.repositories.UserRepository;
import com.ecodispatch.ecodispatch_backend.user.UserType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ApplianceService {

    private final ApplianceRepository applianceRepository;
    private final UserRepository userRepository;
    private final ApplianceUsageLogRepository applianceUsageLogRepository;
    private final RestTemplate restTemplate;

    @Value("${PYTHON_API_URL:http://localhost:8000}")
    private String pythonApiBaseUrl;

    public ApplianceService(ApplianceRepository applianceRepository, UserRepository userRepository,
                            ApplianceUsageLogRepository applianceUsageLogRepository, RestTemplate restTemplate) {
        this.applianceRepository = applianceRepository;
        this.userRepository = userRepository;
        this.applianceUsageLogRepository = applianceUsageLogRepository;
        this.restTemplate = restTemplate;
    }

    private ApplianceResponseDTO toResponseDTO(Appliance appliance) {
        ApplianceResponseDTO dto = new ApplianceResponseDTO();
        dto.setId(appliance.getId());
        dto.setName(appliance.getName());
        dto.setPowerConsumptionKw(appliance.getPowerConsumptionKw());
        return dto;
    }

    public List<ApplianceResponseDTO> getUserAppliance(Integer userId) {
        return applianceRepository.findByUserId(userId)
                .stream()
                .map(this::toResponseDTO)
                .collect(Collectors.toList());
    }

    public ApplianceResponseDTO addAppliance(Integer userId, ApplianceRequestDTO dto) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFound("User not found " + userId));

        Appliance appliance = new Appliance();
        appliance.setName(dto.getName());
        appliance.setPowerConsumptionKw(dto.getPowerConsumptionKw());
        appliance.setUser(user);

        Appliance savedAppliance = applianceRepository.save(appliance);
        return toResponseDTO(savedAppliance);
    }

    public void logApplianceUsage(Integer userId, ApplianceUsageLogRequestDTO dto) {
        Appliance appliance = applianceRepository.findById(dto.getId())
                .orElseThrow(() -> new ApplianceNotFound("Appliance not found."));

        if(!appliance.getUser().getUser_id().equals(userId)) {
            throw new ApplianceNotFound("The appliance does not belong to the user");
        }

        ApplianceUsageLog log = new ApplianceUsageLog();
        log.setAppliance(appliance);
        log.setStartTime(dto.getStartTime());
        log.setDurationMinutes(dto.getDurationMinutes());

        applianceUsageLogRepository.save(log);
    }

    public ApplianceRecommendationResponseDTO getBestTimeForAppliance(Integer userId, Integer applianceId, Integer durationHours) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFound("User not found " + userId));

        Appliance appliance = applianceRepository.findById(applianceId)
                .orElseThrow(() -> new ApplianceNotFound("Appliance not found."));

        ApplianceRecommendationRequestDTO request = new ApplianceRecommendationRequestDTO();
        request.setUserType(user.getUserType().toString());
        request.setDurationHours(durationHours);
        request.setPowerKw(appliance.getPowerConsumptionKw());

        if(user.getUserType() == UserType.PROSUMER && user.getEnergyProfile() != null) {
            request.setLat(user.getEnergyProfile().getLatitude());
            request.setLon(user.getEnergyProfile().getLongitude());
            request.setSystemKwp(user.getEnergyProfile().getPvSystemKw());
            request.setTilt(user.getEnergyProfile().getTilt());
            request.setAzimuth(user.getEnergyProfile().getAzimuth());
        }

        String baseUrl = pythonApiBaseUrl.endsWith("/") ? pythonApiBaseUrl : pythonApiBaseUrl + "/";
        String pythonApiUrl = baseUrl + "api/recommendations/best-time";

        return restTemplate.postForObject(
                pythonApiUrl,
                request,
                ApplianceRecommendationResponseDTO.class
        );
    }

    public void deleteAppliance(Integer userId, Integer applianceId) {
        Appliance appliance = applianceRepository.findById(applianceId)
                .orElseThrow(() -> new ApplianceNotFound("Appliance not found"));

        if (!appliance.getUser().getUser_id().equals(userId)) {
            throw new ApplianceNotFound("Appliance does not belong to user");
        }

        applianceRepository.delete(appliance);
    }

    public ApplianceResponseDTO updateAppliance(Integer userId, Integer applianceId, ApplianceRequestDTO dto) {
        Appliance appliance = applianceRepository.findById(applianceId)
                .orElseThrow(() -> new ApplianceNotFound("Appliance not found"));

        if (!appliance.getUser().getUser_id().equals(userId)) {
            throw new ApplianceNotFound("Appliance does not belong to user");
        }

        appliance.setName(dto.getName());
        appliance.setPowerConsumptionKw(dto.getPowerConsumptionKw());

        Appliance updated = applianceRepository.save(appliance);
        return toResponseDTO(updated);
    }

    public void scheduleApplianceUsage(Integer userId, ApplianceUsageLogRequestDTO dto) {
        Appliance appliance = applianceRepository.findById(dto.getId())
                .orElseThrow(() -> new ApplianceNotFound("Appliance not found."));

        if (!appliance.getUser().getUser_id().equals(userId)) {
            throw new ApplianceNotFound("The appliance does not belong to the user");
        }

        ApplianceUsageLog log = new ApplianceUsageLog();
        log.setAppliance(appliance);
        log.setStartTime(dto.getStartTime());
        log.setDurationMinutes(dto.getDurationMinutes());
        log.setStatus("SCHEDULED");

        applianceUsageLogRepository.save(log);
    }

    public List<ApplianceUsageLogResponseDTO> getUserScheduledTasks(Integer userId, String dateStr) {
        LocalDate targetDate;
        if (dateStr != null && !dateStr.isBlank()) {
            targetDate = LocalDate.parse(dateStr);
        } else {
            targetDate = LocalDate.now(ZoneId.of("Europe/Bucharest"));
        }

        return applianceUsageLogRepository.findByApplianceUserIdAndStatusAndStartTimeBetween(
                        userId,
                        "SCHEDULED",
                        targetDate.atStartOfDay(),
                        targetDate.plusDays(1).atStartOfDay())
                .stream()
                .map(log -> new ApplianceUsageLogResponseDTO(
                        log.getId(),
                        log.getAppliance().getId(),
                        log.getAppliance().getName(),
                        log.getStartTime(),
                        log.getDurationMinutes(),
                        log.getStatus()
                ))
                .collect(Collectors.toList());
    }

    public void cancelScheduledTask(Integer userId, Integer logId) {
        ApplianceUsageLog log = applianceUsageLogRepository.findById(logId)
                .orElseThrow(() -> new ApplianceNotFound("Scheduled task not found"));

        if (!log.getAppliance().getUser().getUser_id().equals(userId)) {
            throw new ApplianceNotFound("Task does not belong to user");
        }

        applianceUsageLogRepository.delete(log);
    }

}
