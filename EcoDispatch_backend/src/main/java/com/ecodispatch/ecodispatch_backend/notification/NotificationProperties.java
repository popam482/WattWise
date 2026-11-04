package com.ecodispatch.ecodispatch_backend.notification;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "wattwise.notifications")
public class NotificationProperties {

    private boolean enabled = true;
    private Telegram telegram = new Telegram();
    private Webhook webhook = new Webhook();

    @Getter
    @Setter
    public static class Telegram {
        /** Bot token from @BotFather. Empty = Telegram channel disabled. */
        private String botToken = "";
        private String apiBaseUrl = "https://api.telegram.org";
    }

    @Getter
    @Setter
    public static class Webhook {
        /** Optional Web Push / WhatsApp sandbox URL. Empty = disabled. */
        private String url = "";
        private String authHeader = "";
    }
}
