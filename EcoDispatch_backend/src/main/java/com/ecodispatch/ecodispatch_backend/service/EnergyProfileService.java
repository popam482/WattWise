package com.ecodispatch.ecodispatch_backend.service;

import com.ecodispatch.ecodispatch_backend.model.User;
import com.ecodispatch.ecodispatch_backend.model.UserResponseDTO;
import com.ecodispatch.ecodispatch_backend.profiles.EnergyProfile;
import com.ecodispatch.ecodispatch_backend.profiles.EnergyProfileRequestDTO;
import com.ecodispatch.ecodispatch_backend.profiles.EnergyProfileResponseDTO;
import com.ecodispatch.ecodispatch_backend.repositories.EnergyProfileRepository;
import com.ecodispatch.ecodispatch_backend.repositories.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class EnergyProfileService {

    private final UserRepository userRepository;
    private final EnergyProfileRepository energyRepository;

    public EnergyProfileService(UserRepository userRepository, EnergyProfileRepository energyRepository) {
        this.userRepository = userRepository;
        this.energyRepository = energyRepository;
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

        EnergyProfile profile = new EnergyProfile();
        profile.setLatitude(dto.getLatitude());
        profile.setLongitude(dto.getLongitude());
        profile.setPvSystemKw(dto.getPvSystemKw());
        profile.setUser(user);

        EnergyProfile savedProfile = energyRepository.save(profile);
        return toResponseDTO(savedProfile);
    }
}