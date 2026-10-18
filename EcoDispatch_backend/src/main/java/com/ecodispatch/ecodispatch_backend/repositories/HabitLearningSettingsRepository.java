package com.ecodispatch.ecodispatch_backend.repositories;

import com.ecodispatch.ecodispatch_backend.privacy.HabitLearningSettings;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface HabitLearningSettingsRepository extends JpaRepository<HabitLearningSettings, Integer> {

    Optional<HabitLearningSettings> findByUserUser_id(Integer userId);
}
