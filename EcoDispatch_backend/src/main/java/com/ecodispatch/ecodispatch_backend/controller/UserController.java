package com.ecodispatch.ecodispatch_backend.controller;

import com.ecodispatch.ecodispatch_backend.login.LoginRequestDTO;
import com.ecodispatch.ecodispatch_backend.login.LoginResponseDTO;
import com.ecodispatch.ecodispatch_backend.user.UserRequestDTO;
import com.ecodispatch.ecodispatch_backend.user.UserResponseDTO;
import com.ecodispatch.ecodispatch_backend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/users/{id}")
    public UserResponseDTO getUsers(@PathVariable Integer id) {
        return userService.getUserById(id);
    }

    @PostMapping("/users")
    public UserResponseDTO createUser(@Valid @RequestBody UserRequestDTO userRequestDTO) {
        return userService.createUser(userRequestDTO);
    }

    @PostMapping("/users/login")
    public LoginResponseDTO login(@Valid @RequestBody LoginRequestDTO loginRequest) {
        return userService.login(loginRequest);
    }

}

