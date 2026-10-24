package com.ecodispatch.ecodispatch_backend.repositories;

import com.ecodispatch.ecodispatch_backend.privacy.HabitLearningSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface HabitLearningSettingsRepository extends JpaRepository<HabitLearningSettings, Integer> {

    @Query("SELECT s FROM HabitLearningSettings s WHERE s.user.user_id = :userId")
    Optional<HabitLearningSettings> findByUserId(@Param("userId") Integer userId);
}
