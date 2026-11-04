package com.ecodispatch.ecodispatch_backend.notification;

import com.ecodispatch.ecodispatch_backend.repositories.UserRepository;
import com.ecodispatch.ecodispatch_backend.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Component
public class NotificationDispatcher {

    private static final Logger log = LoggerFactory.getLogger(NotificationDispatcher.class);

    private final UserRepository userRepository;
    private final NotificationMessageFormatter formatter;
    private final NotificationProperties properties;
    private final Map<NotificationChannel, NotificationService> servicesByChannel;

    public NotificationDispatcher(
            UserRepository userRepository,
            NotificationMessageFormatter formatter,
            NotificationProperties properties,
            List<NotificationService> services) {
        this.userRepository = userRepository;
        this.formatter = formatter;
        this.properties = properties;
        this.servicesByChannel = new EnumMap<>(NotificationChannel.class);
        for (NotificationService service : services) {
            this.servicesByChannel.put(service.channel(), service);
        }
    }

    /**
     * Fire-and-forget dispatch based on consent + per-channel toggles.
     */
    @Async
    public void dispatch(NotificationPayload payload) {
        if (payload == null || payload.getUserId() == null) {
            return;
        }
        if (!properties.isEnabled()) {
            log.debug("Notifications globally disabled — skipping");
            return;
        }

        User user = userRepository.findById(payload.getUserId()).orElse(null);
        if (user == null) {
            log.warn("Cannot notify: user {} not found", payload.getUserId());
            return;
        }
        if (!Boolean.TRUE.equals(user.getConsentGiven()) || !Boolean.TRUE.equals(user.getNotificationsEnabled())) {
            log.debug("Notifications not consented/enabled for user {}", user.getUser_id());
            return;
        }

        String subject = formatter.formatSubject(payload);
        String body = formatter.formatBody(payload);

        try {
            boolean emailOn = user.getEmailNotificationsEnabled() == null || user.getEmailNotificationsEnabled();
            boolean telegramOn = Boolean.TRUE.equals(user.getTelegramNotificationsEnabled());

            // Legacy fallback when both toggles are null and preferred channel is set
            if (user.getEmailNotificationsEnabled() == null && user.getTelegramNotificationsEnabled() == null) {
                NotificationChannel preferred = user.getPreferredNotificationChannel() != null
                        ? user.getPreferredNotificationChannel()
                        : NotificationChannel.EMAIL;
                switch (preferred) {
                    case EMAIL -> emailOn = true;
                    case TELEGRAM -> {
                        emailOn = false;
                        telegramOn = true;
                    }
                    case BOTH -> {
                        emailOn = true;
                        telegramOn = true;
                    }
                    case WEBHOOK -> sendWebhook(user, subject, body);
                    case NONE -> {
                        return;
                    }
                }
            }

            if (emailOn) {
                sendEmail(user, subject, body);
            }
            if (telegramOn) {
                sendTelegram(user, subject, body);
            }
        } catch (Exception ex) {
            log.error("Unexpected error dispatching notification for user {}: {}",
                    user.getUser_id(), ex.getMessage());
        }
    }

    public Map<String, Object> dispatchTest(Integer userId, NotificationChannel overrideChannel) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        NotificationPayload payload = NotificationPayload.builder()
                .userId(userId)
                .applianceName("Washing Machine")
                .applianceMode(ApplianceMode.MANUAL)
                .action("Start")
                .durationLabel("2 Hours")
                .reason("Solar production peak + Grid Voltage reached 252V (Preventing inverter shutdown and saving ~12 RON from peak grid rates).")
                .build();

        String subject = formatter.formatSubject(payload);
        String body = formatter.formatBody(payload);

        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("subject", subject);
        result.put("preview", body);

        if (!properties.isEnabled()) {
            result.put("status", "DISABLED");
            result.put("message", "wattwise.notifications.enabled=false");
            return result;
        }

        boolean sent = false;
        if (overrideChannel != null) {
            result.put("channel", overrideChannel.name());
            sent = switch (overrideChannel) {
                case EMAIL -> sendEmail(user, subject, body);
                case TELEGRAM -> sendTelegram(user, subject, body);
                case WEBHOOK -> sendWebhook(user, subject, body);
                case BOTH -> sendEmail(user, subject, body) | sendTelegram(user, subject, body);
                case NONE -> false;
            };
        } else {
            boolean emailOn = user.getEmailNotificationsEnabled() == null || user.getEmailNotificationsEnabled();
            boolean telegramOn = Boolean.TRUE.equals(user.getTelegramNotificationsEnabled());
            result.put("channel", emailOn && telegramOn ? "BOTH" : (telegramOn ? "TELEGRAM" : "EMAIL"));
            if (emailOn) {
                sent = sendEmail(user, subject, body) || sent;
            }
            if (telegramOn) {
                sent = sendTelegram(user, subject, body) || sent;
            }
        }

        result.put("status", sent ? "SENT" : "FAILED_OR_NOT_CONFIGURED");
        return result;
    }

    private boolean sendEmail(User user, String subject, String body) {
        NotificationService email = servicesByChannel.get(NotificationChannel.EMAIL);
        if (email == null || !email.isConfigured()) {
            log.warn("Email channel not configured");
            return false;
        }
        String to = resolveEmail(user);
        if (to == null) {
            log.warn("No email destination for user {}", user.getUser_id());
            return false;
        }
        email.send(to, subject, body);
        return true;
    }

    private boolean sendTelegram(User user, String subject, String body) {
        NotificationService telegram = servicesByChannel.get(NotificationChannel.TELEGRAM);
        if (telegram == null || !telegram.isConfigured()) {
            log.warn("Telegram channel not configured");
            return false;
        }
        String chatId = user.getTelegramChatId();
        if (chatId == null || chatId.isBlank()) {
            log.warn("No telegramChatId for user {}", user.getUser_id());
            return false;
        }
        telegram.send(chatId, subject, body);
        return true;
    }

    private boolean sendWebhook(User user, String subject, String body) {
        NotificationService webhook = servicesByChannel.get(NotificationChannel.WEBHOOK);
        if (webhook == null || !webhook.isConfigured()) {
            log.warn("Webhook channel not configured");
            return false;
        }
        String dest = user.getPhoneNumber() != null ? user.getPhoneNumber()
                : (user.getTelegramChatId() != null ? user.getTelegramChatId() : resolveEmail(user));
        webhook.send(dest != null ? dest : String.valueOf(user.getUser_id()), subject, body);
        return true;
    }

    private static String resolveEmail(User user) {
        if (user.getNotificationEmail() != null && !user.getNotificationEmail().isBlank()) {
            return user.getNotificationEmail().trim();
        }
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            return user.getEmail().trim();
        }
        return null;
    }
}
