package com.ecodispatch.ecodispatch_backend.controller;

import com.ecodispatch.ecodispatch_backend.messages.PersonalisedMessageDTO;
import com.ecodispatch.ecodispatch_backend.messages.SustainableTip;
import com.ecodispatch.ecodispatch_backend.messages.WelcomeMessage;
import com.ecodispatch.ecodispatch_backend.repositories.SustainableTipRepository;
import com.ecodispatch.ecodispatch_backend.repositories.WelcomeMessageRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/messages")
@CrossOrigin(origins = "*")
public class PersonalisedMessageController {

    private final WelcomeMessageRepository welcomeMessageRepository;
    private final SustainableTipRepository sustainableTipRepository;

    public PersonalisedMessageController(WelcomeMessageRepository welcomeMessageRepository,
                                         SustainableTipRepository sustainableTipRepository) {
        this.welcomeMessageRepository = welcomeMessageRepository;
        this.sustainableTipRepository = sustainableTipRepository;
    }

    @GetMapping("/random")
    public ResponseEntity<PersonalisedMessageDTO> getRandomMessage() {
        String welcome = welcomeMessageRepository.findRandomWelcomeMessage()
                .map(WelcomeMessage::getText)
                .orElse("Bine ai venit");

        String content = sustainableTipRepository.findRandomTip()
                .map(SustainableTip::getContent)
                .orElse("Consumul inteligent ajută mediul înconjurător!");

        return ResponseEntity.ok(new PersonalisedMessageDTO(welcome, content));
    }
}