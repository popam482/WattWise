package com.ecodispatch.ecodispatch_backend.service;

import com.ecodispatch.ecodispatch_backend.appliance.ApplianceUsageLog;
import com.ecodispatch.ecodispatch_backend.privacy.*;
import com.ecodispatch.ecodispatch_backend.repositories.ApplianceUsageLogRepository;
import com.ecodispatch.ecodispatch_backend.repositories.HabitLearningSettingsRepository;
import com.ecodispatch.ecodispatch_backend.repositories.UserRepository;
import com.ecodispatch.ecodispatch_backend.user.User;
import com.ecodispatch.ecodispatch_backend.errors.UserNotFound;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class HabitLearningService {

    private static final ZoneId USER_ZONE = ZoneId.of("Europe/Bucharest");

    private final HabitLearningSettingsRepository settingsRepository;
    private final ApplianceUsageLogRepository usageLogRepository;
    private final UserRepository userRepository;

    public HabitLearningService(HabitLearningSettingsRepository settingsRepository,
                                ApplianceUsageLogRepository usageLogRepository,
                                UserRepository userRepository) {
        this.settingsRepository = settingsRepository;
        this.usageLogRepository = usageLogRepository;
        this.userRepository = userRepository;
    }

    public HabitLearningSettingsResponseDTO getSettings(Integer userId) {
        validateOwnership(userId);
        return toResponse(getOrCreateSettings(userId));
    }

    @Transactional
    public HabitLearningSettingsResponseDTO updateSettings(
            Integer userId, HabitLearningSettingsRequestDTO request) {
        validateOwnership(userId);
        HabitLearningSettings settings = getOrCreateSettings(userId);
        settings.setRetentionDays(request.getRetentionDays() == null
                ? settings.getRetentionDays() : request.getRetentionDays());
        settings.setEnabled(request.getEnabled());
        settings.setConsentedAt(request.getEnabled() ? Instant.now() : null);
        settingsRepository.save(settings);
        if (!settings.isEnabled()) {
            usageLogRepository.deleteHabitLearningDataByUserId(userId);
        }
        return toResponse(settings);
    }

    @Transactional
    public void deleteHistory(Integer userId) {
        validateOwnership(userId);
        usageLogRepository.deleteHabitLearningDataByUserId(userId);
    }

    public List<HabitLearningAggregateDTO> getAggregates(Integer userId) {
        validateOwnership(userId);
        HabitLearningSettings settings = getOrCreateSettings(userId);
        if (!settings.isEnabled()) {
            return List.of();
        }

        return usageLogRepository.findHabitLearningDataByUserId(userId).stream()
                .filter(log -> log.getStartTime() != null)
                .collect(Collectors.groupingBy(log -> new AggregateKey(
                        log.getAppliance().getName(),
                        log.getStartTime().getDayOfWeek().getValue(),
                        log.getStartTime().getHour())))
                .entrySet().stream()
                .filter(entry -> entry.getValue().size() >= 2)
                .map(entry -> new HabitLearningAggregateDTO(
                        entry.getKey().applianceType(),
                        entry.getKey().dayOfWeek(),
                        entry.getKey().hourOfDay(),
                        entry.getValue().size(),
                        entry.getValue().stream()
                                .map(ApplianceUsageLog::getDurationMinutes)
                                .filter(java.util.Objects::nonNull)
                                .mapToLong(Integer::longValue)
                                .sum()))
                .toList();
    }

    public boolean isEnabled(Integer userId) {
        return settingsRepository.findByUserUser_id(userId)
                .map(HabitLearningSettings::isEnabled)
                .orElse(false);
    }

    @Scheduled(cron = "${app.habit-learning.cleanup-cron:0 15 3 * * *}")
    @Transactional
    public void deleteExpiredHistory() {
        settingsRepository.findAll().forEach(settings -> {
            LocalDateTime cutoff = LocalDateTime.now(USER_ZONE).minusDays(settings.getRetentionDays());
            usageLogRepository.deleteExpiredHabitLearningData(settings.getUser().getUser_id(), cutoff);
        });
    }

    private HabitLearningSettings getOrCreateSettings(Integer userId) {
        return settingsRepository.findByUserUser_id(userId).orElseGet(() -> {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new UserNotFound("User not found " + userId));
            HabitLearningSettings settings = new HabitLearningSettings();
            settings.setUser(user);
            return settingsRepository.save(settings);
        });
    }

    private HabitLearningSettingsResponseDTO toResponse(HabitLearningSettings settings) {
        HabitLearningSettingsResponseDTO response = new HabitLearningSettingsResponseDTO();
        response.setEnabled(settings.isEnabled());
        response.setConsentedAt(settings.getConsentedAt());
        response.setRetentionDays(settings.getRetentionDays());
        return response;
    }

    private void validateOwnership(Integer userId) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof Integer authenticatedUserId)
                || !authenticatedUserId.equals(userId)) {
            throw new SecurityException("Access denied");
        }
    }

    private record AggregateKey(String applianceType, int dayOfWeek, int hourOfDay) {
    }
}
