package com.ecodispatch.ecodispatch_backend.repositories;

import com.ecodispatch.ecodispatch_backend.appliance.ApplianceUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ApplianceUsageLogRepository extends JpaRepository<ApplianceUsageLog, Integer> {

    @Query("SELECT l FROM ApplianceUsageLog l JOIN FETCH l.appliance " +
            "WHERE l.appliance.user.user_id = :userId AND l.habitLearningData = true")
    List<ApplianceUsageLog> findHabitLearningDataByUserId(@Param("userId") Integer userId);

    @Modifying
    @Query("DELETE FROM ApplianceUsageLog l WHERE l.appliance.user.user_id = :userId " +
            "AND l.habitLearningData = true")
    void deleteHabitLearningDataByUserId(@Param("userId") Integer userId);

    @Modifying
    @Query("DELETE FROM ApplianceUsageLog l WHERE l.appliance.user.user_id = :userId " +
            "AND l.habitLearningData = true AND l.startTime < :cutoff")
    void deleteExpiredHabitLearningData(@Param("userId") Integer userId,
                                        @Param("cutoff") LocalDateTime cutoff);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM ApplianceUsageLog l WHERE l.appliance.id = :applianceId")
    void deleteByApplianceId(@Param("applianceId") Integer applianceId);

    @Query("SELECT l FROM ApplianceUsageLog l WHERE l.appliance.user.user_id = :userId")
    List<ApplianceUsageLog> findAllByUserId(@Param("userId") Integer userId);

        @Query("SELECT l FROM ApplianceUsageLog l WHERE l.appliance.user.user_id = :userId " +
            "AND l.status = :status AND l.startTime >= :dayStart AND l.startTime < :dayEnd " +
            "ORDER BY l.startTime")
        List<ApplianceUsageLog> findByApplianceUserIdAndStatusAndStartTimeBetween(
            @Param("userId") Integer userId,
            @Param("status") String status,
            @Param("dayStart") LocalDateTime dayStart,
            @Param("dayEnd") LocalDateTime dayEnd);

    @Query("SELECT l FROM ApplianceUsageLog l WHERE l.appliance.user.user_id = :userId " +
            "AND l.status IN :statuses AND l.startTime >= :dayStart AND l.startTime < :dayEnd " +
            "ORDER BY l.startTime")
    List<ApplianceUsageLog> findByApplianceUserIdAndStatusInAndStartTimeBetween(
            @Param("userId") Integer userId,
            @Param("statuses") List<String> statuses,
            @Param("dayStart") LocalDateTime dayStart,
            @Param("dayEnd") LocalDateTime dayEnd);

    @Query("SELECT l FROM ApplianceUsageLog l WHERE l.appliance.id = :applianceId " +
            "AND l.status = 'SCHEDULED' AND l.startTime >= :from")
    List<ApplianceUsageLog> findScheduledFromByApplianceId(
            @Param("applianceId") Integer applianceId,
            @Param("from") LocalDateTime from);

}