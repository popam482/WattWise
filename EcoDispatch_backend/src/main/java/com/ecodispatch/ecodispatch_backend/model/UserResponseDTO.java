package com.ecodispatch.ecodispatch_backend.model;

import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class UserResponseDTO {
    private Integer id;
    private String username;

    public UserResponseDTO() {
    }

    public UserResponseDTO(Integer id, String password, String username) {
        this.id = id;
        this.username = username;
    }

}
