package com.ecodispatch.ecodispatch_backend.repositories;

import com.ecodispatch.ecodispatch_backend.messages.PersonalisedMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface PersonalisedMessageRepository extends JpaRepository<PersonalisedMessage, Long> {

    @Query(value = "SELECT * FROM personalised_messages ORDER BY RANDOM() LIMIT 1", nativeQuery = true)
    Optional<PersonalisedMessage> findRandomMessage();
}