package com.ecodispatch.ecodispatch_backend.repositories;

import com.ecodispatch.ecodispatch_backend.appliance.Appliance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ApplianceRepository extends JpaRepository<Appliance, Integer>{

    @Query("SELECT a FROM Appliance a WHERE a.user.user_id = :userId")
    List<Appliance> findByUserId(@Param("userId") long userId);
}
