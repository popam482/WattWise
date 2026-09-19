package com.ecodispatch.ecodispatch_backend.repositories;

import com.ecodispatch.ecodispatch_backend.appliance.ApplianceUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ApplianceUsageLogRepository extends JpaRepository<ApplianceUsageLog, Integer> {

    @Query("SELECT l FROM ApplianceUsageLog l WHERE l.appliance.user.user_id = :userId")
    List<ApplianceUsageLog> findAllByUserId(@Param("userId") Integer userId);

    @Query("SELECT l FROM ApplianceUsageLog l WHERE l.appliance.user.user_id = :userId AND l.status = :status")
    List<ApplianceUsageLog> findByApplianceUserIdAndStatus(@Param("userId") Integer userId, @Param("status") String status);
}