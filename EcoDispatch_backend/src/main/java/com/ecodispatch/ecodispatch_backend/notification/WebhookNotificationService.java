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

/**
 * Optional extensibility hook for Web Push / WhatsApp sandbox integrations.
 */
@Service
public class WebhookNotificationService implements NotificationService {

    private static final Logger log = LoggerFactory.getLogger(WebhookNotificationService.class);

    private final RestTemplate restTemplate;
    private final NotificationProperties properties;

    public WebhookNotificationService(RestTemplate restTemplate, NotificationProperties properties) {
        this.restTemplate = restTemplate;
        this.properties = properties;
    }

    @Override
    public NotificationChannel channel() {
        return NotificationChannel.WEBHOOK;
    }

    @Override
    public boolean isConfigured() {
        String url = properties.getWebhook().getUrl();
        return url != null && !url.isBlank();
    }

    @Override
    public void send(String destination, String subject, String body) {
        if (!isConfigured()) {
            log.debug("Webhook URL not configured — skipping send");
            return;
        }

        String url = properties.getWebhook().getUrl().trim();
        Map<String, Object> payload = new HashMap<>();
        payload.put("destination", destination);
        payload.put("subject", subject);
        payload.put("body", body);
        payload.put("source", "wattwise");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String auth = properties.getWebhook().getAuthHeader();
        if (auth != null && !auth.isBlank()) {
            headers.set("Authorization", auth.trim());
        }

        try {
            restTemplate.postForEntity(url, new HttpEntity<>(payload, headers), String.class);
            log.info("Webhook notification posted to {}", url);
        } catch (RestClientException ex) {
            log.error("Failed to post webhook notification: {}", ex.getMessage());
        }
    }
}
