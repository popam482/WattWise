package com.ecodispatch.ecodispatch_backend.repositories;

import com.ecodispatch.ecodispatch_backend.profile.EnergyProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface EnergyProfileRepository extends JpaRepository<EnergyProfile, Integer> {

    public EnergyProfile save(EnergyProfile energyProfile);

    public Optional<EnergyProfile> findById(Integer id);

    @Query("SELECT e FROM EnergyProfile e WHERE e.user.user_id = :userId")
    Optional<EnergyProfile> findByUserId(@Param("userId") Integer userId);

}