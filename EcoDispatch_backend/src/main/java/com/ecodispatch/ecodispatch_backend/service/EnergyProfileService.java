package com.ecodispatch.ecodispatch_backend.service;

import com.ecodispatch.ecodispatch_backend.consumption.ConsumptionPredictionResponseDTO;
import com.ecodispatch.ecodispatch_backend.consumption.ConsumptionScenarioRequestDTO;
import com.ecodispatch.ecodispatch_backend.errors.ConsumerPhotovoltaics;
import com.ecodispatch.ecodispatch_backend.errors.EnergyProfileNotFound;
import com.ecodispatch.ecodispatch_backend.errors.UserNotFound;
import com.ecodispatch.ecodispatch_backend.user.User;
import com.ecodispatch.ecodispatch_backend.user.UserType;
import com.ecodispatch.ecodispatch_backend.repositories.UserRepository;
import com.ecodispatch.ecodispatch_backend.user.UserResponseDTO;
import com.ecodispatch.ecodispatch_backend.profile.EnergyProfile;
import com.ecodispatch.ecodispatch_backend.profile.EnergyProfileRequestDTO;
import com.ecodispatch.ecodispatch_backend.profile.EnergyProfileResponseDTO;
import com.ecodispatch.ecodispatch_backend.solar_forecast.SolarForecastResponseDTO;
import com.ecodispatch.ecodispatch_backend.repositories.EnergyProfileRepository;
import com.ecodispatch.ecodispatch_backend.security.OwnershipGuard;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class EnergyProfileService {

    private final UserRepository userRepository;
    private final EnergyProfileRepository energyRepository;
    private final RestTemplate restTemplate;
    private final OwnershipGuard ownershipGuard;

    @Value("${PYTHON_API_URL:http://localhost:8000}")
    private String pythonApiBaseUrl;

    public EnergyProfileService(UserRepository userRepository,
                                EnergyProfileRepository energyRepository,
                                RestTemplate restTemplate,
                                OwnershipGuard ownershipGuard) {
        this.userRepository = userRepository;
        this.energyRepository = energyRepository;
        this.restTemplate = restTemplate;
        this.ownershipGuard = ownershipGuard;
    }

    private EnergyProfileResponseDTO toResponseDTO(EnergyProfile energyProfile) {
        EnergyProfileResponseDTO dto = new EnergyProfileResponseDTO();
        dto.setId(energyProfile.getId());
        dto.setLatitude(energyProfile.getLatitude());
        dto.setLongitude(energyProfile.getLongitude());
        dto.setPvSystemKw(energyProfile.getPvSystemKw());
        dto.setAzimuth(energyProfile.getAzimuth());
        dto.setTilt(energyProfile.getTilt());

        if (energyProfile.getUser() != null) {
            UserResponseDTO userDto = new UserResponseDTO();
            userDto.setId(energyProfile.getUser().getUser_id());
            userDto.setName(energyProfile.getUser().getName());
            dto.setUser(userDto);
        }
        return dto;
    }

    private String pythonApiUrl(String endpoint) {
        String baseUrl = pythonApiBaseUrl.endsWith("/")
                ? pythonApiBaseUrl
                : pythonApiBaseUrl + "/";
        return baseUrl + endpoint;
    }

    public EnergyProfileResponseDTO getProfileByUserId(Integer userId) {
        ownershipGuard.requireOwnership(userId);
        EnergyProfile profile = energyRepository.findByUserId(userId)
                .orElseThrow(() -> new EnergyProfileNotFound("Energy profile not found for user id: " + userId));
        return toResponseDTO(profile);
    }

    public EnergyProfileResponseDTO createEnergyProfile(Integer userId, EnergyProfileRequestDTO dto) {
        ownershipGuard.requireOwnership(userId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFound("User not found with id: " + userId));

        if (user.getUserType() == UserType.CONSUMER) {
            throw new ConsumerPhotovoltaics("Consumers don't have photovoltaics");
        }
        if (energyRepository.findByUserId(userId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Energy profile already exists for this user");
        }
        EnergyProfile profile = new EnergyProfile();
        profile.setLatitude(dto.getLatitude());
        profile.setLongitude(dto.getLongitude());
        profile.setPvSystemKw(dto.getPvSystemKw());
        profile.setAzimuth(dto.getAzimuth());
        profile.setTilt(dto.getTilt());
        profile.setUser(user);

        EnergyProfile savedProfile = energyRepository.save(profile);
        return toResponseDTO(savedProfile);
    }

    public List<SolarForecastResponseDTO> getSolarForecastForUser(Integer userId) {
        ownershipGuard.requireOwnership(userId);
        EnergyProfile profile = energyRepository.findByUserId(userId)
                .orElseThrow(() -> new EnergyProfileNotFound("Energy profile not found for user: " + userId));

        String pythonApiUrl = pythonApiUrl("api/solar-forecast");

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("lat", profile.getLatitude());
        requestBody.put("lon", profile.getLongitude());
        requestBody.put("system_kwp", profile.getPvSystemKw());
        requestBody.put("performance_factor", 0.8);

        SolarForecastResponseDTO[] response = restTemplate.postForObject(
                pythonApiUrl,
                requestBody,
                SolarForecastResponseDTO[].class
        );

        if (response == null) {
            throw new IllegalStateException("Solar forecast service returned an empty response");
        }
        return Arrays.asList(response);
    }

    public ConsumptionPredictionResponseDTO predictNationalConsumption(ConsumptionScenarioRequestDTO scenario) {
        String pythonApiUrl = pythonApiUrl("api/predict-consumption");

        return restTemplate.postForObject(
                pythonApiUrl,
                scenario,
                ConsumptionPredictionResponseDTO.class
        );
    }
}