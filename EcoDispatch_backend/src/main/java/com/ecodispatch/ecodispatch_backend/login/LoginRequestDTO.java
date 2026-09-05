package com.ecodispatch.ecodispatch_backend.login;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LoginRequestDTO {
    @NotBlank
    private String username;
    @NotBlank
    private String password;

    public LoginRequestDTO() {
    }

}
