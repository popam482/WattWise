package com.ecodispatch.ecodispatch_backend.messages;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "welcome_messages")
@Getter
@Setter
public class WelcomeMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String text;

    public WelcomeMessage() {}

    public WelcomeMessage(String text) {
        this.text = text;
    }
}