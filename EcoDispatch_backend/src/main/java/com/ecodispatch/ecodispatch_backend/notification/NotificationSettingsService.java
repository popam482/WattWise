package com.ecodispatch.ecodispatch_backend.notification;

import com.ecodispatch.ecodispatch_backend.errors.UserNotFound;
import com.ecodispatch.ecodispatch_backend.repositories.UserRepository;
import com.ecodispatch.ecodispatch_backend.security.OwnershipGuard;
import com.ecodispatch.ecodispatch_backend.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class NotificationSettingsService {

    private final UserRepository userRepository;
    private final OwnershipGuard ownershipGuard;
    private final NotificationDispatcher dispatcher;
    private final NotificationProperties properties;
    private final List<NotificationService> channelServices;

    public NotificationSettingsService(
            UserRepository userRepository,
            OwnershipGuard ownershipGuard,
            NotificationDispatcher dispatcher,
            NotificationProperties properties,
            List<NotificationService> channelServices) {
        this.userRepository = userRepository;
        this.ownershipGuard = ownershipGuard;
        this.dispatcher = dispatcher;
        this.properties = properties;
        this.channelServices = channelServices;
    }

    public NotificationSettingsResponseDTO getMySettings() {
        Integer userId = ownershipGuard.requireAuthenticatedUserId();
        return getSettings(userId);
    }

    public NotificationSettingsResponseDTO getSettings(Integer userId) {
        ownershipGuard.requireOwnership(userId);
        User user = userRepository.findById(userId).orElseThrow(() -> new UserNotFound(userId));
        return toResponse(user);
    }

    @Transactional
    public NotificationSettingsResponseDTO updateMySettings(NotificationSettingsRequestDTO request) {
        Integer userId = ownershipGuard.requireAuthenticatedUserId();
        return updateSettings(userId, request);
    }

    @Transactional
    public NotificationSettingsResponseDTO updateSettings(Integer userId, NotificationSettingsRequestDTO request) {
        ownershipGuard.requireOwnership(userId);
        User user = userRepository.findById(userId).orElseThrow(() -> new UserNotFound(userId));

        if (request.getTelegramChatId() != null) {
            String chatId = request.getTelegramChatId().trim();
            user.setTelegramChatId(chatId.isEmpty() ? null : chatId);
        }
        if (request.getPhoneNumber() != null) {
            String phone = request.getPhoneNumber().trim();
            user.setPhoneNumber(phone.isEmpty() ? null : phone);
        }
        if (request.getNotificationEmail() != null) {
            String email = request.getNotificationEmail().trim();
            user.setNotificationEmail(email.isEmpty() ? null : email);
        }

        if (Boolean.TRUE.equals(request.getConsentGiven())) {
            user.setConsentGiven(true);
            user.setConsentTimestamp(LocalDateTime.now());
            user.setNotificationsEnabled(true);
        } else if (Boolean.FALSE.equals(request.getConsentGiven())) {
            user.setConsentGiven(false);
            user.setConsentTimestamp(null);
            user.setNotificationsEnabled(false);
        }

        if (request.getNotificationsEnabled() != null) {
            if (Boolean.TRUE.equals(request.getNotificationsEnabled()) && !Boolean.TRUE.equals(user.getConsentGiven())) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Consent is required before enabling automated notifications");
            }
            user.setNotificationsEnabled(request.getNotificationsEnabled());
        }

        if (request.getEmailNotificationsEnabled() != null) {
            user.setEmailNotificationsEnabled(request.getEmailNotificationsEnabled());
        }
        if (request.getTelegramNotificationsEnabled() != null) {
            user.setTelegramNotificationsEnabled(request.getTelegramNotificationsEnabled());
        }

        // Keep legacy preferredChannel in sync with toggles when provided or derived
        if (request.getPreferredChannel() != null) {
            user.setPreferredNotificationChannel(request.getPreferredChannel());
            syncTogglesFromPreferred(user, request.getPreferredChannel());
        } else {
            user.setPreferredNotificationChannel(derivePreferredChannel(user));
        }

        if (Boolean.TRUE.equals(user.getTelegramNotificationsEnabled())
                && (user.getTelegramChatId() == null || user.getTelegramChatId().isBlank())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Telegram Chat ID is required when Telegram notifications are enabled");
        }

        return toResponse(userRepository.save(user));
    }

    public Map<String, Object> sendTest(Integer userId, NotificationTestRequestDTO request) {
        ownershipGuard.requireOwnership(userId);
        NotificationChannel channel = request != null ? request.getChannel() : null;
        return dispatcher.dispatchTest(userId, channel);
    }

    private static void syncTogglesFromPreferred(User user, NotificationChannel channel) {
        switch (channel) {
            case EMAIL -> {
                user.setEmailNotificationsEnabled(true);
                user.setTelegramNotificationsEnabled(false);
            }
            case TELEGRAM -> {
                user.setEmailNotificationsEnabled(false);
                user.setTelegramNotificationsEnabled(true);
            }
            case BOTH -> {
                user.setEmailNotificationsEnabled(true);
                user.setTelegramNotificationsEnabled(true);
            }
            case NONE, WEBHOOK -> {
                user.setEmailNotificationsEnabled(false);
                user.setTelegramNotificationsEnabled(false);
            }
        }
    }

    private static NotificationChannel derivePreferredChannel(User user) {
        boolean email = user.getEmailNotificationsEnabled() == null || user.getEmailNotificationsEnabled();
        boolean telegram = Boolean.TRUE.equals(user.getTelegramNotificationsEnabled());
        if (email && telegram) return NotificationChannel.BOTH;
        if (telegram) return NotificationChannel.TELEGRAM;
        if (email) return NotificationChannel.EMAIL;
        return NotificationChannel.NONE;
    }

    private NotificationSettingsResponseDTO toResponse(User user) {
        NotificationSettingsResponseDTO dto = new NotificationSettingsResponseDTO();
        dto.setUserId(user.getUser_id());
        dto.setAccountEmail(user.getEmail());
        dto.setNotificationEmail(
                user.getNotificationEmail() != null ? user.getNotificationEmail() : user.getEmail());
        dto.setTelegramChatId(user.getTelegramChatId());
        dto.setPhoneNumber(user.getPhoneNumber());
        boolean consented = Boolean.TRUE.equals(user.getConsentGiven());
        dto.setConsentGiven(consented);
        dto.setConsentTimestamp(user.getConsentTimestamp());
        // Master switch is only meaningful after consent
        dto.setNotificationsEnabled(consented && Boolean.TRUE.equals(user.getNotificationsEnabled()));
        dto.setEmailNotificationsEnabled(
                user.getEmailNotificationsEnabled() == null || user.getEmailNotificationsEnabled());
        dto.setTelegramNotificationsEnabled(Boolean.TRUE.equals(user.getTelegramNotificationsEnabled()));
        dto.setPreferredChannel(
                user.getPreferredNotificationChannel() != null
                        ? user.getPreferredNotificationChannel()
                        : derivePreferredChannel(user));
        dto.setTelegramConfigured(isChannelConfigured(NotificationChannel.TELEGRAM) && properties.isEnabled());
        dto.setEmailConfigured(isChannelConfigured(NotificationChannel.EMAIL) && properties.isEnabled());
        dto.setWebhookConfigured(isChannelConfigured(NotificationChannel.WEBHOOK) && properties.isEnabled());
        return dto;
    }

    private boolean isChannelConfigured(NotificationChannel channel) {
        return channelServices.stream()
                .filter(s -> s.channel() == channel)
                .findFirst()
                .map(NotificationService::isConfigured)
                .orElse(false);
    }
}
