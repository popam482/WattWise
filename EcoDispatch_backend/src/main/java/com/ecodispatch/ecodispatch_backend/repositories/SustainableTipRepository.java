package com.ecodispatch.ecodispatch_backend.repositories;

import com.ecodispatch.ecodispatch_backend.messages.SustainableTip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface SustainableTipRepository extends JpaRepository<SustainableTip, Long> {

    @Query(value = "SELECT * FROM sustainable_tips ORDER BY RANDOM() LIMIT 1", nativeQuery = true)
    Optional<SustainableTip> findRandomTip();
}