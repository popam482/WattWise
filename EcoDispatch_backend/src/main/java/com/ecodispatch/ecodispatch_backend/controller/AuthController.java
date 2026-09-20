package com.ecodispatch.ecodispatch_backend.controller;

import com.ecodispatch.ecodispatch_backend.auth.AuthRequestDTO;
import com.ecodispatch.ecodispatch_backend.auth.AuthResponseDTO;
import com.ecodispatch.ecodispatch_backend.security.JwtTokenProvider;
import com.ecodispatch.ecodispatch_backend.user.User;
import com.ecodispatch.ecodispatch_backend.repositories.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtTokenProvider tokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequestDTO request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword()) &&
                !request.getPassword().equals(user.getPassword())) {
            return ResponseEntity.status(401).body("Invalid credentials");
        }

        String token = tokenProvider.generateToken(user.getUser_id(), user.getEmail());

        return ResponseEntity.ok(new AuthResponseDTO(
                token,
                user.getUser_id(),
                user.getName(),
                user.getUserType().toString()
        ));
    }
}