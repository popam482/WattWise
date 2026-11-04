package com.ecodispatch.ecodispatch_backend.user;

import com.ecodispatch.ecodispatch_backend.notification.NotificationChannel;
import com.ecodispatch.ecodispatch_backend.profile.EnergyProfile;
import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

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

    /** Telegram chat id from the WattWise bot (/start). */
    @Column(length = 64)
    private String telegramChatId;

    /** Optional phone for future SMS / WhatsApp sandbox. */
    @Column(length = 32)
    private String phoneNumber;

    /** Optional override; falls back to account email when null. */
    @Email
    @Column(length = 255)
    private String notificationEmail;

    /** Legacy preferred channel; new channel toggles take precedence when set. */
    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private NotificationChannel preferredNotificationChannel = NotificationChannel.EMAIL;

    /** Master switch — requires consent before alerts are dispatched. Default off. */
    @Column
    private Boolean notificationsEnabled = false;

    @Column
    private Boolean emailNotificationsEnabled = true;

    @Column
    private Boolean telegramNotificationsEnabled = false;

    @Column
    private Boolean consentGiven = false;

    private LocalDateTime consentTimestamp;

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
