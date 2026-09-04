package com.ecodispatch.ecodispatch_backend.model;

import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class UserResponseDTO {
    private Integer id;
    private String username;
    private UserType userType;

    public UserResponseDTO() {
    }

}
