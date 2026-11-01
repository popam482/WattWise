package com.ecodispatch.ecodispatch_backend.service;

import com.ecodispatch.ecodispatch_backend.appliance.*;
import com.ecodispatch.ecodispatch_backend.errors.ApplianceNotFound;
import com.ecodispatch.ecodispatch_backend.errors.UserNotFound;
import com.ecodispatch.ecodispatch_backend.repositories.ApplianceUsageLogRepository;
import com.ecodispatch.ecodispatch_backend.analytics.EcoAnalyticsDTO;
import com.ecodispatch.ecodispatch_backend.user.User;
import com.ecodispatch.ecodispatch_backend.repositories.ApplianceRepository;
import com.ecodispatch.ecodispatch_backend.appliance.ApplianceUsageLog;
import com.ecodispatch.ecodispatch_backend.repositories.UserRepository;
import com.ecodispatch.ecodispatch_backend.security.OwnershipGuard;
import com.ecodispatch.ecodispatch_backend.user.UserType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Comparator;
import java.util.DoubleSummaryStatistics;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ApplianceService {

    private final ApplianceRepository applianceRepository;
    private final UserRepository userRepository;
    private final ApplianceUsageLogRepository applianceUsageLogRepository;
    private final RestTemplate restTemplate;
    private final HabitLearningService habitLearningService;
    private final OwnershipGuard ownershipGuard;

    @Value("${PYTHON_API_URL:http://localhost:8000}")
    private String pythonApiBaseUrl;

    public ApplianceService(ApplianceRepository applianceRepository, UserRepository userRepository,
                            ApplianceUsageLogRepository applianceUsageLogRepository, RestTemplate restTemplate,
                            HabitLearningService habitLearningService, OwnershipGuard ownershipGuard) {
        this.applianceRepository = applianceRepository;
        this.userRepository = userRepository;
        this.applianceUsageLogRepository = applianceUsageLogRepository;
        this.restTemplate = restTemplate;
        this.habitLearningService = habitLearningService;
        this.ownershipGuard = ownershipGuard;
    }

    private void validateUserOwnership(Integer pathUserId) {
        ownershipGuard.requireOwnership(pathUserId);
    }

    private ApplianceResponseDTO toResponseDTO(Appliance appliance) {
        ApplianceResponseDTO dto = new ApplianceResponseDTO();
        dto.setId(appliance.getId());
        dto.setName(appliance.getName());
        dto.setPowerConsumptionKw(appliance.getPowerConsumptionKw());
        dto.setIsRecurring(appliance.getIsRecurring());
        dto.setRecurringDays(appliance.getRecurringDays());

        if (appliance.getPreferredDuration() != null) {
            dto.setPreferredDuration(String.valueOf(appliance.getPreferredDuration()));
        }

        dto.setTimeWindowStart(appliance.getTimeWindowStart());
        dto.setTimeWindowEnd(appliance.getTimeWindowEnd());
        return dto;
    }

    public List<ApplianceResponseDTO> getUserAppliance(Integer userId) {

        validateUserOwnership(userId);

        return applianceRepository.findByUserId(userId)
                .stream()
                .map(this::toResponseDTO)
                .collect(Collectors.toList());
    }

    public ApplianceResponseDTO addAppliance(Integer userId, ApplianceRequestDTO dto) {

        validateUserOwnership(userId);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFound("User not found " + userId));

        Appliance appliance = new Appliance();
        appliance.setName(dto.getName());
        appliance.setPowerConsumptionKw(dto.getPowerConsumptionKw());
        appliance.setIsRecurring(dto.getIsRecurring() != null ? dto.getIsRecurring() : false);
        appliance.setRecurringDays(dto.getRecurringDays());
        appliance.setPreferredDuration(parsePreferredDuration(dto.getPreferredDuration()));
        appliance.setTimeWindowStart(dto.getTimeWindowStart());
        appliance.setTimeWindowEnd(dto.getTimeWindowEnd());
        appliance.setUser(user);

        Appliance savedAppliance = applianceRepository.save(appliance);
        return toResponseDTO(savedAppliance);
    }

    public void logApplianceUsage(Integer userId, ApplianceUsageLogRequestDTO dto) {

        validateUserOwnership(userId);

        Appliance appliance = applianceRepository.findById(dto.getId())
                .orElseThrow(() -> new ApplianceNotFound("Appliance not found."));

        if (!appliance.getUser().getUser_id().equals(userId)) {
            throw new ApplianceNotFound("The appliance does not belong to the user");
        }

        ApplianceUsageLog log = new ApplianceUsageLog();
        log.setAppliance(appliance);
        log.setStartTime(dto.getStartTime());
        log.setDurationMinutes(dto.getDurationMinutes());
        log.setHabitLearningData(habitLearningService.isEnabled(userId));

        applianceUsageLogRepository.save(log);
    }

    public ApplianceRecommendationResponseDTO getBestTimeForAppliance(Integer userId, Integer applianceId, Integer durationHours) {

        validateUserOwnership(userId);

        return getBestTimeForAppliance(userId, applianceId, durationHours, null, null);
    }

    public ApplianceRecommendationResponseDTO getBestTimeForAppliance(
            Integer userId, Integer applianceId, Integer durationHours,
            String earliestStart, String latestEnd) {

        validateUserOwnership(userId);

        if (durationHours == null || durationHours < 1 || durationHours > 24) {
            throw new IllegalArgumentException("Duration must be between 1 and 24 hours");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFound("User not found " + userId));

        Appliance appliance = applianceRepository.findById(applianceId)
                .orElseThrow(() -> new ApplianceNotFound("Appliance not found."));

        if (!appliance.getUser().getUser_id().equals(userId)) {
            throw new ApplianceNotFound("Appliance does not belong to user");
        }

        // Hard deadline: T_start >= earliest AND (T_start + D) <= mustFinishBy — never expand the deadline
        ZoneId bucharest = ZoneId.of("Europe/Bucharest");
        LocalDateTime now = LocalDateTime.now(bucharest).withSecond(0).withNano(0);
        DateTimeFormatter isoMinute = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm");

        LocalDateTime effectiveEarliest = parseFlexibleDateTime(earliestStart, now);
        if (effectiveEarliest.isBefore(now)) {
            effectiveEarliest = now;
        }
        effectiveEarliest = snapToNext15Min(effectiveEarliest);

        // Deadline snaps DOWN so we never push mustFinishBy past the user's hard limit
        boolean latestProvided = latestEnd != null && !latestEnd.isBlank();
        LocalDateTime effectiveLatest = latestProvided
                ? snapToPrevious15Min(parseFlexibleDateTime(latestEnd, now.plusHours(24)))
                : snapToNext15Min(now.plusHours(24));

        if (!effectiveLatest.isAfter(effectiveEarliest)) {
            throw new IllegalArgumentException(
                    "Must finish by must be after earliest start (after applying the current-time boundary)."
            );
        }

        LocalDateTime latestAllowedStart = effectiveLatest.minusHours(durationHours);
        if (latestAllowedStart.isBefore(effectiveEarliest)) {
            double availableHours = Math.max(
                    0.0,
                    java.time.Duration.between(effectiveEarliest, effectiveLatest).toMinutes() / 60.0
            );
            String availableLabel = availableHours == Math.rint(availableHours)
                    ? String.format("%.0fh", availableHours)
                    : String.format("%.1fh", availableHours);
            throw new IllegalArgumentException(String.format(
                    "Requested runtime (%dh) exceeds the available time window (%s). Please expand 'Must finish by' deadline.",
                    durationHours,
                    availableLabel
            ));
        }

        ApplianceRecommendationRequestDTO request = new ApplianceRecommendationRequestDTO();
        request.setUserType(user.getUserType().name());
        request.setDurationHours(durationHours);
        request.setPowerKw(appliance.getPowerConsumptionKw());
        request.setEarliestStart(effectiveEarliest.format(isoMinute));
        request.setLatestEnd(effectiveLatest.format(isoMinute));

        Map<Integer, Double> committedPower = new HashMap<>();

        if (user.getUserType() == UserType.PROSUMER) {
            LocalDateTime tomorrow = now.plusHours(24);

            List<ApplianceUsageLog> activeTasks = applianceUsageLogRepository
                    .findByApplianceUserIdAndStatusAndStartTimeBetween(userId, "SCHEDULED", now, tomorrow);

            for (ApplianceUsageLog task : activeTasks) {
                int startHour = task.getStartTime().getHour();
                int taskDurationHours = (int) Math.ceil(task.getDurationMinutes() / 60.0);
                double taskPower = task.getAppliance().getPowerConsumptionKw() != null ? task.getAppliance().getPowerConsumptionKw() : 1.0;

                for (int i = 0; i < taskDurationHours; i++) {
                    int hour = (startHour + i) % 24;
                    committedPower.put(hour, committedPower.getOrDefault(hour, 0.0) + taskPower);
                }
            }
        }

        request.setCommittedPowerPerHour(committedPower);

        if (user.getUserType() == UserType.PROSUMER && user.getEnergyProfile() != null) {
            var profile = user.getEnergyProfile();
            request.setLat(profile.getLatitude());
            request.setLon(profile.getLongitude());
            request.setSystemKwp(profile.getPvSystemKw());
            request.setTilt(profile.getTilt());
            request.setAzimuth(profile.getAzimuth());
            request.setHasBattery(profile.isHasBattery());
            request.setBatteryCapacityKwh(profile.getBatteryCapacityKwh());
            request.setBatteryMaxChargeKw(profile.getBatteryMaxChargeKw());
            request.setBatteryMaxDischargeKw(profile.getBatteryMaxDischargeKw());
            if (profile.getBatteryType() != null) {
                request.setBatteryType(profile.getBatteryType().name());
            }
        }

        String baseUrl = pythonApiBaseUrl.endsWith("/") ? pythonApiBaseUrl : pythonApiBaseUrl + "/";
        String pythonApiUrl = baseUrl + "api/recommendations/best-time";

        ApplianceRecommendationResponseDTO response = restTemplate.postForObject(
                pythonApiUrl,
                request,
                ApplianceRecommendationResponseDTO.class
        );
        if (response == null) {
            throw new IllegalStateException("Optimization service returned an empty response");
        }
        return response;
    }

    @Transactional
    public void deleteAppliance(Integer userId, Integer applianceId) {

        validateUserOwnership(userId);

        Appliance appliance = applianceRepository.findById(applianceId)
                .orElseThrow(() -> new ApplianceNotFound("Appliance not found"));

        if (!appliance.getUser().getUser_id().equals(userId)) {
            throw new ApplianceNotFound("Appliance does not belong to user");
        }

        applianceUsageLogRepository.deleteByApplianceId(applianceId);
        applianceRepository.delete(appliance);
    }

    @Transactional
    public ApplianceResponseDTO updateAppliance(Integer userId, Integer applianceId, ApplianceRequestDTO dto) {

        validateUserOwnership(userId);

        Appliance appliance = applianceRepository.findById(applianceId)
                .orElseThrow(() -> new ApplianceNotFound("Appliance not found"));

        if (!appliance.getUser().getUser_id().equals(userId)) {
            throw new ApplianceNotFound("Appliance does not belong to user");
        }

        boolean wasRecurring = Boolean.TRUE.equals(appliance.getIsRecurring());
        boolean nowRecurring = dto.getIsRecurring() != null && dto.getIsRecurring();

        if (dto.getName() != null && !dto.getName().isBlank()) {
            appliance.setName(dto.getName());
        }
        if (dto.getPowerConsumptionKw() != null) {
            appliance.setPowerConsumptionKw(dto.getPowerConsumptionKw());
        }

        appliance.setIsRecurring(nowRecurring);

        if (nowRecurring) {
            appliance.setRecurringDays(dto.getRecurringDays() != null ? dto.getRecurringDays() : "DAILY");
            Integer duration = parsePreferredDuration(dto.getPreferredDuration());
            appliance.setPreferredDuration(duration != null ? duration : 2);
            appliance.setTimeWindowStart(
                    dto.getTimeWindowStart() != null && !dto.getTimeWindowStart().isBlank()
                            ? dto.getTimeWindowStart() : "08:00"
            );
            appliance.setTimeWindowEnd(
                    dto.getTimeWindowEnd() != null && !dto.getTimeWindowEnd().isBlank()
                            ? dto.getTimeWindowEnd() : "22:00"
            );
        } else {
            // Manual flexible mode — clear recurring template fields
            appliance.setRecurringDays(null);
            appliance.setPreferredDuration(null);
            appliance.setTimeWindowStart(null);
            appliance.setTimeWindowEnd(null);

            // Deactivate any future auto-generated runs for this appliance
            if (wasRecurring) {
                LocalDateTime now = LocalDateTime.now(ZoneId.of("Europe/Bucharest")).minusHours(1);
                List<ApplianceUsageLog> futureLogs =
                        applianceUsageLogRepository.findScheduledFromByApplianceId(applianceId, now);
                for (ApplianceUsageLog future : futureLogs) {
                    future.setStatus("CANCELLED");
                    future.setDecisionReason("Switched from automatic to manual mode");
                    applianceUsageLogRepository.save(future);
                }
            }
        }

        Appliance updated = applianceRepository.save(appliance);
        return toResponseDTO(updated);
    }

    public void scheduleApplianceUsage(Integer userId, ApplianceUsageLogRequestDTO dto) {

        validateUserOwnership(userId);

        Appliance appliance = applianceRepository.findById(dto.getId())
                .orElseThrow(() -> new ApplianceNotFound("Appliance not found."));

        if (!appliance.getUser().getUser_id().equals(userId)) {
            throw new ApplianceNotFound("The appliance does not belong to the user");
        }

        if (dto.getStartTime() == null) {
            throw new IllegalArgumentException("startTime is required");
        }
        if (dto.getDurationMinutes() == null || dto.getDurationMinutes() < 1) {
            throw new IllegalArgumentException("durationMinutes must be at least 1");
        }

        ApplianceUsageLog log = new ApplianceUsageLog();
        log.setAppliance(appliance);
        log.setStartTime(dto.getStartTime());
        log.setDurationMinutes(dto.getDurationMinutes());
        log.setStatus("SCHEDULED");

        double powerKw = appliance.getPowerConsumptionKw() != null ? appliance.getPowerConsumptionKw() : 1.0;
        double durationHours = dto.getDurationMinutes() / 60.0;
        double totalKwh = powerKw * durationHours;
        double recommendedCarbon = dto.getRecommendedCarbonIntensity() != null
                ? dto.getRecommendedCarbonIntensity() : 90.0;
        double baselineCarbon = dto.getBaselineCarbonIntensity() != null
                ? dto.getBaselineCarbonIntensity() : 450.0;

        log.setRecommendedCarbonIntensity(recommendedCarbon);
        log.setBaselineCarbonIntensity(baselineCarbon);

        // Prefer rigorous ML deltas when provided; else intensity × energy fallback
        if (dto.getSavedCo2Kg() != null) {
            log.setSavedCo2Grams(Math.max(0.0, dto.getSavedCo2Kg() * 1000.0));
        } else {
            double emissionsRecommended = totalKwh * recommendedCarbon;
            double emissionsBaseline = totalKwh * baselineCarbon;
            log.setSavedCo2Grams(Math.max(0.0, emissionsBaseline - emissionsRecommended));
        }

        double basePrice = dto.getBaselineEnergyPrice() != null ? dto.getBaselineEnergyPrice() : 1.30;
        double recPrice = dto.getRecommendedEnergyPrice() != null ? dto.getRecommendedEnergyPrice() : 0.45;

        log.setRecommendedEnergyPrice(recPrice);
        log.setBaselineEnergyPrice(basePrice);

        if (dto.getSavedMoneyRon() != null) {
            log.setSavedMoneyRon(Math.max(0.0, dto.getSavedMoneyRon()));
        } else {
            double costBaseline = totalKwh * basePrice;
            double costRecommended = totalKwh * recPrice;
            log.setSavedMoneyRon(Math.max(0.0, costBaseline - costRecommended));
        }

        applianceUsageLogRepository.save(log);
    }

    private boolean matchesRecurrence(String recurringDays, LocalDate targetDate) {
        if (recurringDays == null) return false;
        DayOfWeek day = targetDate.getDayOfWeek();
        switch (recurringDays.toUpperCase()) {
            case "DAILY":
                return true;
            case "WEEKDAYS":
                return day.getValue() >= 1 && day.getValue() <= 5;
            case "WEEKENDS":
                return day.getValue() >= 6 && day.getValue() <= 7;
            default:
                return false;
        }
    }

    public List<ApplianceUsageLogResponseDTO> getUserScheduledTasks(Integer userId, String dateStr) {

        validateUserOwnership(userId);

        LocalDate targetDate;
        if (dateStr != null && !dateStr.isBlank()) {
            targetDate = LocalDate.parse(dateStr);
        } else {
            targetDate = LocalDate.now(ZoneId.of("Europe/Bucharest"));
        }

        List<ApplianceUsageLog> recentLogs = applianceUsageLogRepository
                .findByApplianceUserIdAndStatusInAndStartTimeBetween(
                        userId,
                        Arrays.asList("SCHEDULED", "CANCELLED"),
                        targetDate.minusDays(1).atStartOfDay(),
                        targetDate.plusDays(2).atStartOfDay()
                );

        List<Appliance> recurringAppliances = applianceRepository.findByUserId(userId).stream()
                .filter(a -> a.getIsRecurring() != null && a.getIsRecurring())
                .collect(Collectors.toList());

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm");

        for (Appliance app : recurringAppliances) {
            if (!matchesRecurrence(app.getRecurringDays(), targetDate)) {
                continue;
            }

            String startStr = app.getTimeWindowStart() != null ? app.getTimeWindowStart() : "00:00";
            String endStr = app.getTimeWindowEnd() != null ? app.getTimeWindowEnd() : "23:59";
            LocalTime startTime = LocalTime.parse(startStr);
            LocalTime endTime = LocalTime.parse(endStr);

            LocalDateTime earliestStart = targetDate.atTime(startTime);
            LocalDateTime latestEnd = targetDate.atTime(endTime);

            if (endTime.isBefore(startTime)) {
                latestEnd = latestEnd.plusDays(1);
            }

            // Never optimize into the past; snap to next :00/:15/:30/:45
            LocalDateTime nowBucharest = LocalDateTime.now(ZoneId.of("Europe/Bucharest")).withSecond(0).withNano(0);
            if (earliestStart.isBefore(nowBucharest)) {
                earliestStart = nowBucharest;
            }
            earliestStart = snapToNext15Min(earliestStart);
            latestEnd = snapToPrevious15Min(latestEnd);
            if (!latestEnd.isAfter(earliestStart)) {
                continue;
            }
            int durationHours = app.getPreferredDuration() != null ? app.getPreferredDuration() : 2;
            if (earliestStart.plusHours(durationHours).isAfter(latestEnd)) {
                continue; // runtime cannot finish before hard deadline
            }

            final LocalDateTime recurrenceWindowStart = targetDate.atTime(startTime);
            final LocalDateTime recurrenceWindowEnd = latestEnd;

            ApplianceUsageLog existingLog = recentLogs.stream()
                    .filter(log -> log.getAppliance().getId().equals(app.getId()) &&
                            !log.getStartTime().isBefore(recurrenceWindowStart) &&
                            !log.getStartTime().isAfter(recurrenceWindowEnd))
                    .findFirst()
                    .orElse(null);

            // User explicitly cancelled this recurrence window — do not auto-recreate
            if (existingLog != null && "CANCELLED".equalsIgnoreCase(existingLog.getStatus())) {
                continue;
            }

            ApplianceRecommendationResponseDTO rec = null;
            try {
                rec = getBestTimeForAppliance(
                        userId, app.getId(), durationHours,
                        earliestStart.format(fmt), latestEnd.format(fmt)
                );
            } catch (Exception e) {
                System.err.println("Failed to fetch recommendation for " + app.getName() + ": " + e.getMessage());
            }

            if (rec != null && rec.getBestStartTime() != null) {
                LocalDateTime newBestStart = LocalDateTime.parse(rec.getBestStartTime().replace(" ", "T"));

                if (existingLog == null) {
                    ApplianceUsageLog newLog = new ApplianceUsageLog();
                    newLog.setAppliance(app);
                    newLog.setStartTime(newBestStart);
                    newLog.setDurationMinutes(durationHours * 60);
                    newLog.setStatus("SCHEDULED");
                    newLog.setDecisionReason(rec.getReason());

                    double powerKw = app.getPowerConsumptionKw() != null ? app.getPowerConsumptionKw() : 1.0;
                    double totalKwh = powerKw * durationHours;

                    double recCarbon = rec.getRecommendedCarbonIntensity() != null ? rec.getRecommendedCarbonIntensity() : 90.0;
                    double baseCarbon = rec.getBaselineCarbonIntensity() != null ? rec.getBaselineCarbonIntensity() : 450.0;
                    newLog.setRecommendedCarbonIntensity(recCarbon);
                    newLog.setBaselineCarbonIntensity(baseCarbon);
                    if (rec.getCo2AvoidedKg() != null) {
                        newLog.setSavedCo2Grams(Math.max(0.0, rec.getCo2AvoidedKg() * 1000.0));
                    } else {
                        newLog.setSavedCo2Grams(Math.max(0.0, (totalKwh * baseCarbon) - (totalKwh * recCarbon)));
                    }

                    double basePrice = rec.getBaselineEnergyPrice() != null ? rec.getBaselineEnergyPrice() : 1.30;
                    double recPrice = rec.getRecommendedEnergyPrice() != null ? rec.getRecommendedEnergyPrice() : 0.45;
                    newLog.setRecommendedEnergyPrice(recPrice);
                    newLog.setBaselineEnergyPrice(basePrice);
                    if (rec.getSingleRunSavingsRon() != null) {
                        newLog.setSavedMoneyRon(Math.max(0.0, rec.getSingleRunSavingsRon()));
                    } else {
                        newLog.setSavedMoneyRon(Math.max(0.0, (totalKwh * basePrice) - (totalKwh * recPrice)));
                    }

                    newLog = applianceUsageLogRepository.save(newLog);
                    recentLogs.add(newLog);
                } else {
                    long minuteDiff = Math.abs(Duration.between(existingLog.getStartTime(), newBestStart).toMinutes());
                    if (minuteDiff > 30) {
                        existingLog.setStartTime(newBestStart);
                        existingLog.setDecisionReason("Re-optimized due to forecast shift: " + rec.getReason());

                        double powerKw = app.getPowerConsumptionKw() != null ? app.getPowerConsumptionKw() : 1.0;
                        double totalKwh = powerKw * durationHours;
                        double recCarbon = rec.getRecommendedCarbonIntensity() != null ? rec.getRecommendedCarbonIntensity() : 90.0;
                        double baseCarbon = rec.getBaselineCarbonIntensity() != null ? rec.getBaselineCarbonIntensity() : 450.0;
                        if (rec.getCo2AvoidedKg() != null) {
                            existingLog.setSavedCo2Grams(Math.max(0.0, rec.getCo2AvoidedKg() * 1000.0));
                        } else {
                            existingLog.setSavedCo2Grams(Math.max(0.0, (totalKwh * baseCarbon) - (totalKwh * recCarbon)));
                        }
                        if (rec.getSingleRunSavingsRon() != null) {
                            existingLog.setSavedMoneyRon(Math.max(0.0, rec.getSingleRunSavingsRon()));
                        }

                        applianceUsageLogRepository.save(existingLog);
                        System.out.println("Re-optimized schedule for " + app.getName() + " to " + newBestStart);
                    }
                }
            }
        }

        LocalDateTime dayStart = targetDate.atStartOfDay();
        LocalDateTime dayEnd = targetDate.plusDays(1).atStartOfDay();

        return recentLogs.stream()
                .filter(log -> "SCHEDULED".equalsIgnoreCase(log.getStatus()))
                .filter(log -> !log.getStartTime().isBefore(dayStart) && log.getStartTime().isBefore(dayEnd))
                .map(log -> new ApplianceUsageLogResponseDTO(
                        log.getId(),
                        log.getAppliance().getId(),
                        log.getAppliance().getName(),
                        log.getStartTime(),
                        log.getDurationMinutes(),
                        log.getStatus(),
                        log.getSavedCo2Grams(),
                        log.getSavedMoneyRon(),
                        log.getAppliance().getIsRecurring(),
                        log.getDecisionReason()
                ))
                .collect(Collectors.toList());
    }

    public void cancelScheduledTask(Integer userId, Integer logId) {

        validateUserOwnership(userId);

        ApplianceUsageLog log = applianceUsageLogRepository.findById(logId)
                .orElseThrow(() -> new ApplianceNotFound("Scheduled task not found"));

        if (!log.getAppliance().getUser().getUser_id().equals(userId)) {
            throw new ApplianceNotFound("Task does not belong to user");
        }

        // Soft-cancel so recurring auto-dispatch does not recreate the same day
        if (Boolean.TRUE.equals(log.getAppliance().getIsRecurring())) {
            log.setStatus("CANCELLED");
            log.setDecisionReason("Cancelled by user for this occurrence");
            applianceUsageLogRepository.save(log);
        } else {
            applianceUsageLogRepository.delete(log);
        }
    }

    @Transactional
    public void cancelRecurringSchedule(Integer userId, RecurringCancelRequestDTO dto) {
        validateUserOwnership(userId);

        if (dto == null || dto.getScope() == null) {
            throw new IllegalArgumentException("scope is required (ONE_DAY or ALL_FUTURE)");
        }

        String scope = dto.getScope().trim().toUpperCase();
        ZoneId zone = ZoneId.of("Europe/Bucharest");
        LocalDateTime now = LocalDateTime.now(zone);

        if ("ONE_DAY".equals(scope)) {
            cancelOneRecurringDay(userId, dto, zone);
            return;
        }

        if ("ALL_FUTURE".equals(scope)) {
            Integer applianceId = dto.getApplianceId();
            if (applianceId == null && dto.getLogId() != null) {
                ApplianceUsageLog log = applianceUsageLogRepository.findById(dto.getLogId())
                        .orElseThrow(() -> new ApplianceNotFound("Scheduled task not found"));
                if (!log.getAppliance().getUser().getUser_id().equals(userId)) {
                    throw new ApplianceNotFound("Task does not belong to user");
                }
                applianceId = log.getAppliance().getId();
            }
            if (applianceId == null) {
                throw new IllegalArgumentException("applianceId is required for ALL_FUTURE");
            }

            Appliance appliance = applianceRepository.findById(applianceId)
                    .orElseThrow(() -> new ApplianceNotFound("Appliance not found"));
            if (!appliance.getUser().getUser_id().equals(userId)) {
                throw new ApplianceNotFound("Appliance does not belong to user");
            }

            appliance.setIsRecurring(false);
            applianceRepository.save(appliance);

            List<ApplianceUsageLog> futureLogs =
                    applianceUsageLogRepository.findScheduledFromByApplianceId(applianceId, now.minusHours(1));
            for (ApplianceUsageLog future : futureLogs) {
                future.setStatus("CANCELLED");
                future.setDecisionReason("Recurring rule deactivated by user");
                applianceUsageLogRepository.save(future);
            }
            return;
        }

        throw new IllegalArgumentException("Unsupported scope: " + dto.getScope());
    }

    private void cancelOneRecurringDay(Integer userId, RecurringCancelRequestDTO dto, ZoneId zone) {
        ApplianceUsageLog log = null;
        if (dto.getLogId() != null) {
            log = applianceUsageLogRepository.findById(dto.getLogId())
                    .orElseThrow(() -> new ApplianceNotFound("Scheduled task not found"));
            if (!log.getAppliance().getUser().getUser_id().equals(userId)) {
                throw new ApplianceNotFound("Task does not belong to user");
            }
            log.setStatus("CANCELLED");
            log.setDecisionReason("Cancelled for selected day only — recurring rule kept");
            applianceUsageLogRepository.save(log);
            return;
        }

        if (dto.getApplianceId() == null || dto.getDate() == null || dto.getDate().isBlank()) {
            throw new IllegalArgumentException("applianceId and date are required when logId is absent");
        }

        Appliance appliance = applianceRepository.findById(dto.getApplianceId())
                .orElseThrow(() -> new ApplianceNotFound("Appliance not found"));
        if (!appliance.getUser().getUser_id().equals(userId)) {
            throw new ApplianceNotFound("Appliance does not belong to user");
        }

        LocalDate targetDate = LocalDate.parse(dto.getDate());
        String startStr = appliance.getTimeWindowStart() != null ? appliance.getTimeWindowStart() : "00:00";
        LocalTime startTime = LocalTime.parse(startStr);
        LocalDateTime markerStart = targetDate.atTime(startTime);

        ApplianceUsageLog skip = new ApplianceUsageLog();
        skip.setAppliance(appliance);
        skip.setStartTime(markerStart);
        skip.setDurationMinutes(
                (appliance.getPreferredDuration() != null ? appliance.getPreferredDuration() : 2) * 60
        );
        skip.setStatus("CANCELLED");
        skip.setDecisionReason("Skipped " + targetDate + " — recurring rule kept for future days");
        skip.setIsRecurringExecution(true);
        skip.setSavedCo2Grams(0.0);
        skip.setSavedMoneyRon(0.0);
        applianceUsageLogRepository.save(skip);
    }

    public EcoAnalyticsDTO getUserEcoAnalytics(Integer userId) {

        validateUserOwnership(userId);

        List<ApplianceUsageLog> logs = applianceUsageLogRepository.findAllByUserId(userId);

        double totalSavedGrams = logs.stream()
                .mapToDouble(log -> log.getSavedCo2Grams() != null ? log.getSavedCo2Grams() : 0.0)
                .sum();

        double totalSavedRon = logs.stream()
                .mapToDouble(log -> log.getSavedMoneyRon() != null ? log.getSavedMoneyRon() : 0.0)
                .sum();

        double totalSavedKg = totalSavedGrams / 1000.0;

        double kmEquiv = totalSavedKg / 0.12;
        // 1 tree ≈ 1.75 kg CO₂ absorbed per month
        double treeEquiv = totalSavedKg / 1.75;

        Map<String, DoubleSummaryStatistics> dailyStats = logs.stream()
                .filter(log -> log.getStartTime() != null)
                .collect(Collectors.groupingBy(
                        log -> log.getStartTime().toLocalDate().toString(),
                        Collectors.summarizingDouble(log -> log.getSavedCo2Grams() != null ? log.getSavedCo2Grams() / 1000.0 : 0.0)
                ));

        List<EcoAnalyticsDTO.DailyImpactDTO> history = dailyStats.entrySet().stream()
                .map(entry -> new EcoAnalyticsDTO.DailyImpactDTO(
                        entry.getKey(),
                        entry.getValue().getSum() * 1.5, // baseline estimation
                        entry.getValue().getSum() * 0.5, // real co2 emissions
                        entry.getValue().getSum()        // difference
                ))
                .sorted(Comparator.comparing(EcoAnalyticsDTO.DailyImpactDTO::getDate))
                .collect(Collectors.toList());

        return new EcoAnalyticsDTO(
                Math.round(totalSavedKg * 100.0) / 100.0,
                Math.round(totalSavedRon * 100.0) / 100.0,
                logs.size(),
                Math.round(kmEquiv * 10.0) / 10.0,
                Math.round(treeEquiv * 10.0) / 10.0,
                history
        );
    }

    /**
     * Round UP to the next :00 / :15 / :30 / :45 boundary.
     * Already-aligned times are unchanged (18:15 stays 18:15).
     * Examples: 18:02 → 18:15, 18:38 → 18:45, 18:52 → 19:00.
     */
    private LocalDateTime snapToNext15Min(LocalDateTime dt) {
        LocalDateTime clean = dt.withSecond(0).withNano(0);
        int minute = clean.getMinute();
        int remainder = minute % 15;
        if (remainder == 0) {
            return clean;
        }
        return clean.plusMinutes(15L - remainder);
    }

    /**
     * Round DOWN to the previous :00 / :15 / :30 / :45 boundary (hard deadlines).
     * Already-aligned times are unchanged (10:00 stays 10:00).
     * Examples: 10:07 → 10:00, 10:00 → 10:00.
     */
    private LocalDateTime snapToPrevious15Min(LocalDateTime dt) {
        LocalDateTime clean = dt.withSecond(0).withNano(0);
        int minute = clean.getMinute();
        int remainder = minute % 15;
        if (remainder == 0) {
            return clean;
        }
        return clean.minusMinutes(remainder);
    }

    /**
     * Parse frontend/API datetimes that may arrive as {@code yyyy-MM-dd'T'HH:mm},
     * {@code yyyy-MM-dd HH:mm:ss}, or with a trailing Z. Falls back to {@code fallback}
     * when the value is null/blank/unparseable.
     */
    private LocalDateTime parseFlexibleDateTime(String value, LocalDateTime fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        String normalized = value.trim().replace(" ", "T");
        if (normalized.endsWith("Z")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        try {
            if (normalized.length() == 16) {
                // yyyy-MM-dd'T'HH:mm
                return LocalDateTime.parse(normalized, DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"));
            }
            return LocalDateTime.parse(normalized);
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private Integer parsePreferredDuration(String preferredDuration) {
        if (preferredDuration == null || preferredDuration.isBlank()) {
            return null;
        }
        try {
            int parsed = Integer.parseInt(preferredDuration.trim());
            if (parsed < 1 || parsed > 24) {
                throw new IllegalArgumentException("preferredDuration must be between 1 and 24 hours");
            }
            return parsed;
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("preferredDuration must be a whole number of hours");
        }
    }
}