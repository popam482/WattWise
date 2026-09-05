package com.ecodispatch.ecodispatch_backend.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class UserRequestDTO {
    @NotBlank(message = "Username cannot be blank")
    private String username;

    @NotBlank(message = "Password cannot be blank")
    private String password;

    @NotBlank(message = "Email cannot be blank")
    @Email(message = "Invalid mail format")
    private String email;

    @NotNull(message = "User type is required(Consumer/Prosumer)")
    private UserType userType;

    public UserRequestDTO() {
    }

}
