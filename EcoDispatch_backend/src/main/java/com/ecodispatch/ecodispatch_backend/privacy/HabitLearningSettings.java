package com.ecodispatch.ecodispatch_backend.privacy;

import com.ecodispatch.ecodispatch_backend.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "habit_learning_settings")
@Getter
@Setter
public class HabitLearningSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(nullable = false)
    private boolean enabled = false;

    private Instant consentedAt;

    @Column(nullable = false)
    private int retentionDays = 90;

    public HabitLearningSettings() {
    }
}
