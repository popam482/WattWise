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

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer user_id;

    @NotBlank
    private String name;

    @Column(nullable = false)
    private String password;

    @NotBlank
    @Email
    @Column(nullable = false, unique = true)
    private String email;

    @Enumerated(EnumType.STRING)
    private UserType userType;

    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL)
    private EnergyProfile energyProfile;

    public User(Integer user_id, String email, String password, String name, EnergyProfile energyProfile) {
        this.user_id = user_id;
        this.email = email;
        this.password = password;
        this.name = name;
        this.energyProfile = energyProfile;
    }

    public User() {}
}