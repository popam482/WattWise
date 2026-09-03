package com.ecodispatch.ecodispatch_backend.model;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
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

    public UserRequestDTO() {
    }

    public UserRequestDTO(String email, String username, String password) {
        this.email = email;
        this.username = username;
        this.password = password;
    }

}
