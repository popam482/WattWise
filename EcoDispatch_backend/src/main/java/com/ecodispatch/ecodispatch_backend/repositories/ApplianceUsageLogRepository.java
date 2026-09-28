package com.ecodispatch.ecodispatch_backend.repositories;

import com.ecodispatch.ecodispatch_backend.appliance.ApplianceUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ApplianceUsageLogRepository extends JpaRepository<ApplianceUsageLog, Integer> {

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

    List<ApplianceUsageLog> findByApplianceUserId(Integer userId);
}