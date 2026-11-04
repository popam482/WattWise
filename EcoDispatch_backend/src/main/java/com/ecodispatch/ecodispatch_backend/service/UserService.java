package com.ecodispatch.ecodispatch_backend.service;

import com.ecodispatch.ecodispatch_backend.errors.InvalidCredentials;
import com.ecodispatch.ecodispatch_backend.errors.UserNotFound;
import com.ecodispatch.ecodispatch_backend.login.LoginRequestDTO;
import com.ecodispatch.ecodispatch_backend.login.LoginResponseDTO;
import com.ecodispatch.ecodispatch_backend.user.User;
import com.ecodispatch.ecodispatch_backend.repositories.UserRepository;
import com.ecodispatch.ecodispatch_backend.user.UserRequestDTO;
import com.ecodispatch.ecodispatch_backend.user.UserResponseDTO;
import com.ecodispatch.ecodispatch_backend.security.JwtTokenProvider;
import com.ecodispatch.ecodispatch_backend.security.OwnershipGuard;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final OwnershipGuard ownershipGuard;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                       JwtTokenProvider tokenProvider, OwnershipGuard ownershipGuard) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
        this.ownershipGuard = ownershipGuard;
    }

    private UserResponseDTO toResponseDTO(User user) {
        UserResponseDTO dto = new UserResponseDTO();
        dto.setId(user.getUser_id());
        dto.setName(user.getName());
        dto.setUserType(user.getUserType());
        return dto;
    }

    private static String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }

    private User toEntity(UserRequestDTO dto) {
        User user = new User();
        user.setName(dto.getName() != null ? dto.getName().trim() : null);
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        user.setEmail(normalizeEmail(dto.getEmail()));
        user.setUserType(dto.getUserType());
        user.setNotificationsEnabled(false);
        user.setEmailNotificationsEnabled(true);
        user.setTelegramNotificationsEnabled(false);
        user.setConsentGiven(false);
        user.setConsentTimestamp(null);
        user.setPreferredNotificationChannel(
                com.ecodispatch.ecodispatch_backend.notification.NotificationChannel.EMAIL);
        return user;
    }

    public UserResponseDTO getUserById(Integer id) {
        ownershipGuard.requireOwnership(id);
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFound(id));
        return toResponseDTO(user);
    }

    public UserResponseDTO createUser(UserRequestDTO dto) {
        String email = normalizeEmail(dto.getEmail());
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email cannot be blank");
        }
        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already in use!");
        }

        User user = toEntity(dto);
        User savedUser = userRepository.save(user);
        return toResponseDTO(savedUser);
    }

    public LoginResponseDTO login(LoginRequestDTO loginRequest) {
        String email = normalizeEmail(loginRequest.getEmail());
        String password = loginRequest.getPassword() != null ? loginRequest.getPassword() : "";

        User user = userRepository.findByEmail(email)
                .orElseThrow(InvalidCredentials::new);

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new InvalidCredentials();
        }

        String token = tokenProvider.generateToken(user.getUser_id(), user.getEmail());

        UserResponseDTO userResponse = new UserResponseDTO();
        userResponse.setId(user.getUser_id());
        userResponse.setName(user.getName());
        userResponse.setUserType(user.getUserType());

        return new LoginResponseDTO(token, userResponse);
    }
}
