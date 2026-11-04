package com.ecodispatch.ecodispatch_backend.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailNotificationService implements NotificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailNotificationService.class);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String fromAddress;
    private final String mailHost;

    public EmailNotificationService(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @org.springframework.beans.factory.annotation.Value("${spring.mail.host:}") String mailHost,
            @org.springframework.beans.factory.annotation.Value("${spring.mail.username:}") String mailUsername,
            @org.springframework.beans.factory.annotation.Value("${wattwise.notifications.email.from:}") String configuredFrom) {
        this.mailSenderProvider = mailSenderProvider;
        this.mailHost = mailHost != null ? mailHost.trim() : "";
        this.fromAddress = (configuredFrom != null && !configuredFrom.isBlank())
                ? configuredFrom.trim()
                : (mailUsername != null ? mailUsername.trim() : "");
    }

    @Override
    public NotificationChannel channel() {
        return NotificationChannel.EMAIL;
    }

    @Override
    public boolean isConfigured() {
        return mailSenderProvider.getIfAvailable() != null
                && !mailHost.isBlank()
                && fromAddress != null
                && !fromAddress.isBlank();
    }

    @Override
    public void send(String to, String subject, String body) {
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.debug("JavaMailSender not available — skipping email");
            return;
        }
        if (to == null || to.isBlank()) {
            log.warn("Email destination missing — skipping send");
            return;
        }
        if (fromAddress == null || fromAddress.isBlank()) {
            log.warn("Email from address not configured — skipping send");
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(to.trim());
            message.setSubject(subject != null ? subject : "WattWise Alert");
            message.setText(body);
            mailSender.send(message);
            log.info("Email notification sent to {}", to);
        } catch (Exception ex) {
            log.error("Failed to send email notification to {}: {}", to, ex.getMessage());
        }
    }
}
