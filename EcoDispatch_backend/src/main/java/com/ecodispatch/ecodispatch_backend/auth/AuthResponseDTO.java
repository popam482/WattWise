package com.ecodispatch.ecodispatch_backend.auth;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class AuthResponseDTO {
    private String token;
    private Integer userId;
    private String name;
    private String userType;
}