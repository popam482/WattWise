package com.ecodispatch.ecodispatch_backend.controller;

import com.ecodispatch.ecodispatch_backend.messages.PersonalisedMessage;
import com.ecodispatch.ecodispatch_backend.repositories.PersonalisedMessageRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/messages")
@CrossOrigin(origins = "*")
public class PersonalisedMessageController {

    private final PersonalisedMessageRepository personalisedMessageRepository;

    public PersonalisedMessageController(PersonalisedMessageRepository personalisedMessageRepository) {
        this.personalisedMessageRepository = personalisedMessageRepository;
    }

    @GetMapping("/random")
    public ResponseEntity<PersonalisedMessage> getRandomMessage() {
        return personalisedMessageRepository.findRandomMessage()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}