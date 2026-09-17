package com.ecodispatch.ecodispatch_backend.messages;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "personalised_messages")
@Getter
@Setter
public class PersonalisedMessage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String welcomeMessage;

    @Column(nullable = false, length = 200)
    private String content;

    public PersonalisedMessage() {
    }

    public PersonalisedMessage(String content, String message, Long id) {
        this.content = content;
        this.welcomeMessage = message;
        this.id = id;
    }
}
