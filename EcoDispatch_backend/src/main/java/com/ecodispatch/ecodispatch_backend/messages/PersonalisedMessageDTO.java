package com.ecodispatch.ecodispatch_backend.messages;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class PersonalisedMessageDTO {
    private String welcomeMessage;
    private String content;
}