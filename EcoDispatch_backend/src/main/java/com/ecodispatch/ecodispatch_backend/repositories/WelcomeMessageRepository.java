package com.ecodispatch.ecodispatch_backend.repositories;

import com.ecodispatch.ecodispatch_backend.messages.WelcomeMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface WelcomeMessageRepository extends JpaRepository<WelcomeMessage, Long> {

    @Query(value = "SELECT * FROM welcome_messages ORDER BY RANDOM() LIMIT 1", nativeQuery = true)
    Optional<WelcomeMessage> findRandomWelcomeMessage();
}