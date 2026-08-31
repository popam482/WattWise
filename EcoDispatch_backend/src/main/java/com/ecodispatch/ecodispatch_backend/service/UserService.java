package com.ecodispatch.ecodispatch_backend.service;

import com.ecodispatch.ecodispatch_backend.login.LoginRequestDTO;
import com.ecodispatch.ecodispatch_backend.login.LoginResponseDTO;
import com.ecodispatch.ecodispatch_backend.model.User;
import com.ecodispatch.ecodispatch_backend.model.UserRepository;
import com.ecodispatch.ecodispatch_backend.model.UserRequestDTO;
import com.ecodispatch.ecodispatch_backend.model.UserResponseDTO;
import com.ecodispatch.ecodispatch_backend.utils.JwtUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class UserService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    private UserResponseDTO toResponseDTO(User user) {
        UserResponseDTO dto = new UserResponseDTO();
        dto.setId(user.getUser_id());
        dto.setUsername(user.getUsername());
        return dto;
    }

    private User toEntity(UserRequestDTO dto) {
        User user = new User();
        user.setUsername(dto.getUsername());
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        user.setEmail(dto.getEmail());
        return user;
    }

    public UserResponseDTO getUserById(Integer id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFound(id));
        return toResponseDTO(user);
    }

    public UserResponseDTO createUser(UserRequestDTO dto) {
        User user = toEntity(dto);
        User savedUser = userRepository.save(user);
        return toResponseDTO(savedUser);
    }

    public LoginResponseDTO login(LoginRequestDTO loginRequestDTO) {
        User user = userRepository.findByUsername(loginRequestDTO.getUsername())
                .orElseThrow(InvalidCredentials::new);
        if(!passwordEncoder.matches(loginRequestDTO.getPassword(), user.getPassword())) {
            throw new InvalidCredentials();
        }
        String token = jwtUtil.generateToken(user.getUsername());
        UserResponseDTO userResponseDTO = toResponseDTO(user);
        return new LoginResponseDTO(token, userResponseDTO);
    }
}
