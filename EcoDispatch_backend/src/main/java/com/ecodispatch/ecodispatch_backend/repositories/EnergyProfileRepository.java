package com.ecodispatch.ecodispatch_backend.repositories;

import com.ecodispatch.ecodispatch_backend.profiles.EnergyProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EnergyProfileRepository extends JpaRepository<EnergyProfile, Integer> {

    public EnergyProfile save(EnergyProfile energyProfile);

    public Optional<EnergyProfile> findById(Integer id);
}
