package com.ecodispatch.ecodispatch_backend.user;

import com.ecodispatch.ecodispatch_backend.profile.EnergyProfile;
import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@Setter
public class User {

    @Getter
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer user_id;

    @NotBlank
    private String username;

    @NotBlank
    private String password;

    @NotBlank
    @Email
    private String email;

    @Enumerated(EnumType.STRING)
    private UserType userType;

    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL)
    private EnergyProfile energyProfile;

    public User(Integer user_id, String email, String password, String username, EnergyProfile energyProfile) {
        this.user_id = user_id;
        this.email = email;
        this.password = password;
        this.username = username;
        this.energyProfile = energyProfile;
    }

    public User() {

    }

}