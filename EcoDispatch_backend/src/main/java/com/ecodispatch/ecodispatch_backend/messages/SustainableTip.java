package com.ecodispatch.ecodispatch_backend.messages;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "sustainable_tips")
@Getter
@Setter
public class SustainableTip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 300)
    private String content;

    public SustainableTip() {}

    public SustainableTip(String content) {
        this.content = content;
    }
}