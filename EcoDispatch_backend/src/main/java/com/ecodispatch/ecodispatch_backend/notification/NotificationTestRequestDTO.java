package com.ecodispatch.ecodispatch_backend.notification;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class NotificationTestRequestDTO {
    /** Optional override; defaults to the user's preferred channel. */
    private NotificationChannel channel;
}
