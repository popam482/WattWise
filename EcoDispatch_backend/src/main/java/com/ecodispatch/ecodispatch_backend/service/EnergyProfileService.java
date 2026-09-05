package com.ecodispatch.ecodispatch_backend.service;

import com.ecodispatch.ecodispatch_backend.consumption.ConsumptionPredictionResponseDTO;
import com.ecodispatch.ecodispatch_backend.consumption.ConsumptionScenarioRequestDTO;
import com.ecodispatch.ecodispatch_backend.user.User;
import com.ecodispatch.ecodispatch_backend.user.UserType;
import com.ecodispatch.ecodispatch_backend.repositories.UserRepository;
import com.ecodispatch.ecodispatch_backend.user.UserResponseDTO;
import com.ecodispatch.ecodispatch_backend.profile.EnergyProfile;
import com.ecodispatch.ecodispatch_backend.profile.EnergyProfileRequestDTO;
import com.ecodispatch.ecodispatch_backend.profile.EnergyProfileResponseDTO;
import com.ecodispatch.ecodispatch_backend.solar_forecast.SolarForecastResponseDTO;
import com.ecodispatch.ecodispatch_backend.repositories.EnergyProfileRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class EnergyProfileService {

    private final UserRepository userRepository;
    private final EnergyProfileRepository energyRepository;
    private final RestTemplate restTemplate;

    public EnergyProfileService(UserRepository userRepository,
                                EnergyProfileRepository energyRepository,
                                RestTemplate restTemplate) {
        this.userRepository = userRepository;
        this.energyRepository = energyRepository;
        this.restTemplate = restTemplate;
    }

    private EnergyProfileResponseDTO toResponseDTO(EnergyProfile energyProfile) {
        EnergyProfileResponseDTO dto = new EnergyProfileResponseDTO();
        dto.setId(energyProfile.getId());
        dto.setLatitude(energyProfile.getLatitude());
        dto.setLongitude(energyProfile.getLongitude());
        dto.setPvSystemKw(energyProfile.getPvSystemKw());

        if (energyProfile.getUser() != null) {
            UserResponseDTO userDto = new UserResponseDTO();
            userDto.setId(energyProfile.getUser().getUser_id());
            userDto.setUsername(energyProfile.getUser().getUsername());
            dto.setUser(userDto);
        }
        return dto;
    }

    public EnergyProfileResponseDTO getProfileByUserId(Integer userId) {
        EnergyProfile profile = energyRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Energy profile not found for user id: " + userId));
        return toResponseDTO(profile);
    }

    public EnergyProfileResponseDTO createEnergyProfile(Integer userId, EnergyProfileRequestDTO dto) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + userId));

        if(user.getUserType() == UserType.CONSUMER){
            throw new RuntimeException("Consumers don't have photovoltaics");
        }
        EnergyProfile profile = new EnergyProfile();
        profile.setLatitude(dto.getLatitude());
        profile.setLongitude(dto.getLongitude());
        profile.setPvSystemKw(dto.getPvSystemKw());
        profile.setUser(user);

        EnergyProfile savedProfile = energyRepository.save(profile);
        return toResponseDTO(savedProfile);
    }

    public List<SolarForecastResponseDTO> getSolarForecastForUser(Integer userId) {
        EnergyProfile profile = energyRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Profilul energetic nu exista pentru userul: " + userId));

        String pythonApiUrl = "http://localhost:8000/api/solar-forecast";

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

        return Arrays.asList(response);
    }

    public ConsumptionPredictionResponseDTO predictNationalConsumption(ConsumptionScenarioRequestDTO scenario) {
        String pythonApiUrl = "http://localhost:8000/api/predict-consumption";

        return restTemplate.postForObject(
                pythonApiUrl,
                scenario,
                ConsumptionPredictionResponseDTO.class
        );
    }
}