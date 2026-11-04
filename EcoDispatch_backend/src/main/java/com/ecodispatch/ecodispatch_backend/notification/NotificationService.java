package com.ecodispatch.ecodispatch_backend.notification;

/**
 * Channel-specific sender. Implementations must never throw to callers of
 * {@link NotificationDispatcher}; failures are logged and swallowed.
 */
public interface NotificationService {

    NotificationChannel channel();

    boolean isConfigured();

    void send(String destination, String subject, String body);
}
