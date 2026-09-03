package com.ecodispatch.ecodispatch_backend.login;

import com.ecodispatch.ecodispatch_backend.model.UserResponseDTO;
import lombok.Getter;
import lombok.Setter;


@Setter
@Getter
public class LoginResponseDTO {

    private String token;
    private UserResponseDTO user;

    public LoginResponseDTO() {

    }

    public LoginResponseDTO(String token, UserResponseDTO user) {
        this.token = token;
        this.user = user;
    }

}