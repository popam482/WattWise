package com.ecodispatch.ecodispatch_backend.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Service
public class TelegramNotificationService implements NotificationService {

    private static final Logger log = LoggerFactory.getLogger(TelegramNotificationService.class);

    private final RestTemplate restTemplate;
    private final NotificationProperties properties;

    public TelegramNotificationService(RestTemplate restTemplate, NotificationProperties properties) {
        this.restTemplate = restTemplate;
        this.properties = properties;
    }

    @Override
    public NotificationChannel channel() {
        return NotificationChannel.TELEGRAM;
    }

    @Override
    public boolean isConfigured() {
        String token = properties.getTelegram().getBotToken();
        return token != null && !token.isBlank();
    }

    @Override
    public void send(String chatId, String subject, String body) {
        if (!isConfigured()) {
            log.debug("Telegram bot token not configured — skipping send");
            return;
        }
        if (chatId == null || chatId.isBlank()) {
            log.warn("Telegram chatId missing — skipping send");
            return;
        }

        String token = properties.getTelegram().getBotToken().trim();
        String base = properties.getTelegram().getApiBaseUrl();
        if (base == null || base.isBlank()) {
            base = "https://api.telegram.org";
        }
        String url = base.replaceAll("/$", "") + "/bot" + token + "/sendMessage";

        Map<String, Object> payload = new HashMap<>();
        payload.put("chat_id", chatId.trim());
        payload.put("text", body);
        payload.put("disable_web_page_preview", true);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            restTemplate.postForEntity(url, new HttpEntity<>(payload, headers), String.class);
            log.info("Telegram notification sent to chatId={}", chatId);
        } catch (RestClientException ex) {
            log.error("Failed to send Telegram notification to chatId={}: {}", chatId, ex.getMessage());
        }
    }
}
