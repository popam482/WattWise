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
import com.ecodispatch.ecodispatch_backend.user.UserType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.*;
import java.time.format.DateTimeFormatter;
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

    @Value("${PYTHON_API_URL:http://localhost:8000}")
    private String pythonApiBaseUrl;

    public ApplianceService(ApplianceRepository applianceRepository, UserRepository userRepository,
                            ApplianceUsageLogRepository applianceUsageLogRepository, RestTemplate restTemplate) {
        this.applianceRepository = applianceRepository;
        this.userRepository = userRepository;
        this.applianceUsageLogRepository = applianceUsageLogRepository;
        this.restTemplate = restTemplate;
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
        return applianceRepository.findByUserId(userId)
                .stream()
                .map(this::toResponseDTO)
                .collect(Collectors.toList());
    }

    public ApplianceResponseDTO addAppliance(Integer userId, ApplianceRequestDTO dto) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFound("User not found " + userId));

        Appliance appliance = new Appliance();
        appliance.setName(dto.getName());
        appliance.setPowerConsumptionKw(dto.getPowerConsumptionKw());
        appliance.setIsRecurring(dto.getIsRecurring() != null ? dto.getIsRecurring() : false);
        appliance.setRecurringDays(dto.getRecurringDays());
        appliance.setPreferredDuration(dto.getPreferredDuration() != null ? Integer.valueOf(dto.getPreferredDuration()) : null);
        appliance.setTimeWindowStart(dto.getTimeWindowStart());
        appliance.setTimeWindowEnd(dto.getTimeWindowEnd());
        appliance.setUser(user);

        Appliance savedAppliance = applianceRepository.save(appliance);
        return toResponseDTO(savedAppliance);
    }

    public void logApplianceUsage(Integer userId, ApplianceUsageLogRequestDTO dto) {
        Appliance appliance = applianceRepository.findById(dto.getId())
                .orElseThrow(() -> new ApplianceNotFound("Appliance not found."));

        if(!appliance.getUser().getUser_id().equals(userId)) {
            throw new ApplianceNotFound("The appliance does not belong to the user");
        }

        ApplianceUsageLog log = new ApplianceUsageLog();
        log.setAppliance(appliance);
        log.setStartTime(dto.getStartTime());
        log.setDurationMinutes(dto.getDurationMinutes());

        applianceUsageLogRepository.save(log);
    }

    public ApplianceRecommendationResponseDTO getBestTimeForAppliance(Integer userId, Integer applianceId, Integer durationHours) {
        return getBestTimeForAppliance(userId, applianceId, durationHours, null, null);
    }

    public ApplianceRecommendationResponseDTO getBestTimeForAppliance(
            Integer userId, Integer applianceId, Integer durationHours,
            String earliestStart, String latestEnd) {
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

        ApplianceRecommendationRequestDTO request = new ApplianceRecommendationRequestDTO();
        request.setUserType(user.getUserType().name());
        request.setDurationHours(durationHours);
        request.setPowerKw(appliance.getPowerConsumptionKw());
        request.setEarliestStart(earliestStart);
        request.setLatestEnd(latestEnd);

        Map<Integer, Double> committedPower = new HashMap<>();

        if (user.getUserType() == UserType.PROSUMER) {
            LocalDateTime now = LocalDateTime.now(ZoneId.of("Europe/Bucharest"));
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

        if(user.getUserType() == UserType.PROSUMER && user.getEnergyProfile() != null) {
            request.setLat(user.getEnergyProfile().getLatitude());
            request.setLon(user.getEnergyProfile().getLongitude());
            request.setSystemKwp(user.getEnergyProfile().getPvSystemKw());
            request.setTilt(user.getEnergyProfile().getTilt());
            request.setAzimuth(user.getEnergyProfile().getAzimuth());
        }

        String baseUrl = pythonApiBaseUrl.endsWith("/") ? pythonApiBaseUrl : pythonApiBaseUrl + "/";
        String pythonApiUrl = baseUrl + "api/recommendations/best-time";

        return restTemplate.postForObject(
                pythonApiUrl,
                request,
                ApplianceRecommendationResponseDTO.class
        );
    }

    public void deleteAppliance(Integer userId, Integer applianceId) {
        Appliance appliance = applianceRepository.findById(applianceId)
                .orElseThrow(() -> new ApplianceNotFound("Appliance not found"));

        if (!appliance.getUser().getUser_id().equals(userId)) {
            throw new ApplianceNotFound("Appliance does not belong to user");
        }

        applianceRepository.delete(appliance);
    }

    public ApplianceResponseDTO updateAppliance(Integer userId, Integer applianceId, ApplianceRequestDTO dto) {
        Appliance appliance = applianceRepository.findById(applianceId)
                .orElseThrow(() -> new ApplianceNotFound("Appliance not found"));

        if (!appliance.getUser().getUser_id().equals(userId)) {
            throw new ApplianceNotFound("Appliance does not belong to user");
        }

        appliance.setName(dto.getName());
        appliance.setPowerConsumptionKw(dto.getPowerConsumptionKw());
        appliance.setIsRecurring(dto.getIsRecurring() != null ? dto.getIsRecurring() : false);
        appliance.setRecurringDays(dto.getRecurringDays());
        appliance.setPreferredDuration(dto.getPreferredDuration() != null ? Integer.parseInt(dto.getPreferredDuration()) : null);
        appliance.setTimeWindowStart(dto.getTimeWindowStart());
        appliance.setTimeWindowEnd(dto.getTimeWindowEnd());

        Appliance updated = applianceRepository.save(appliance);
        return toResponseDTO(updated);
    }

    public void scheduleApplianceUsage(Integer userId, ApplianceUsageLogRequestDTO dto) {
        Appliance appliance = applianceRepository.findById(dto.getId())
                .orElseThrow(() -> new ApplianceNotFound("Appliance not found."));

        if (!appliance.getUser().getUser_id().equals(userId)) {
            throw new ApplianceNotFound("The appliance does not belong to the user");
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
        double emissionsRecommended = totalKwh * recommendedCarbon;
        double emissionsBaseline = totalKwh * baselineCarbon;
        log.setSavedCo2Grams(Math.max(0.0, emissionsBaseline - emissionsRecommended));

        double basePrice = dto.getBaselineEnergyPrice() != null ? dto.getBaselineEnergyPrice() : 1.30;
        double recPrice = dto.getRecommendedEnergyPrice() != null ? dto.getRecommendedEnergyPrice() : 0.45;

        log.setRecommendedEnergyPrice(recPrice);
        log.setBaselineEnergyPrice(basePrice);

        double costBaseline = totalKwh * basePrice;
        double costRecommended = totalKwh * recPrice;
        log.setSavedMoneyRon(Math.max(0.0, costBaseline - costRecommended));

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
        LocalDate targetDate;
        if (dateStr != null && !dateStr.isBlank()) {
            targetDate = LocalDate.parse(dateStr);
        } else {
            targetDate = LocalDate.now(ZoneId.of("Europe/Bucharest"));
        }

        List<ApplianceUsageLog> recentLogs = applianceUsageLogRepository
                .findByApplianceUserIdAndStatusAndStartTimeBetween(
                        userId,
                        "SCHEDULED",
                        targetDate.minusDays(1).atStartOfDay(),
                        targetDate.plusDays(2).atStartOfDay()
                );

        List<Appliance> recurringAppliances = applianceRepository.findByUserId(userId).stream()
                .filter(a -> a.getIsRecurring() != null && a.getIsRecurring())
                .collect(Collectors.toList());

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

            final LocalDateTime recurrenceWindowStart = earliestStart;
            final LocalDateTime recurrenceWindowEnd = latestEnd;
            boolean alreadyScheduled = recentLogs.stream()
                    .anyMatch(log -> log.getAppliance().getId().equals(app.getId()) &&
                            !log.getStartTime().isBefore(recurrenceWindowStart) &&
                            !log.getStartTime().isAfter(recurrenceWindowEnd));


            if (!alreadyScheduled) {
                try {
                    int durationHours = app.getPreferredDuration() != null ? app.getPreferredDuration() : 2;
                    DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm");

                    ApplianceRecommendationResponseDTO rec = getBestTimeForAppliance(
                            userId, app.getId(), durationHours,
                            earliestStart.format(fmt), latestEnd.format(fmt)
                    );

                    if (rec != null && rec.getBestStartTime() != null) {
                        ApplianceUsageLog newLog = new ApplianceUsageLog();
                        newLog.setAppliance(app);
                        newLog.setStartTime(LocalDateTime.parse(rec.getBestStartTime().replace(" ", "T")));
                        newLog.setDurationMinutes(durationHours * 60);
                        newLog.setStatus("SCHEDULED");

                        double powerKw = app.getPowerConsumptionKw() != null ? app.getPowerConsumptionKw() : 1.0;
                        double totalKwh = powerKw * durationHours;

                        double recCarbon = rec.getRecommendedCarbonIntensity() != null ? rec.getRecommendedCarbonIntensity() : 90.0;
                        double baseCarbon = rec.getBaselineCarbonIntensity() != null ? rec.getBaselineCarbonIntensity() : 450.0;
                        newLog.setRecommendedCarbonIntensity(recCarbon);
                        newLog.setBaselineCarbonIntensity(baseCarbon);
                        newLog.setSavedCo2Grams(Math.max(0.0, (totalKwh * baseCarbon) - (totalKwh * recCarbon)));

                        double basePrice = rec.getBaselineEnergyPrice() != null ? rec.getBaselineEnergyPrice() : 1.30;
                        double recPrice = rec.getRecommendedEnergyPrice() != null ? rec.getRecommendedEnergyPrice() : 0.45;
                        newLog.setRecommendedEnergyPrice(recPrice);
                        newLog.setBaselineEnergyPrice(basePrice);
                        newLog.setSavedMoneyRon(Math.max(0.0, (totalKwh * basePrice) - (totalKwh * recPrice)));

                        newLog = applianceUsageLogRepository.save(newLog);
                        recentLogs.add(newLog);
                    }
                } catch (Exception e) {
                    System.err.println("Could not auto-schedule for appliance " + app.getId() + ": " + e.getMessage());
                }
            }
        }

        LocalDateTime dayStart = targetDate.atStartOfDay();
        LocalDateTime dayEnd = targetDate.plusDays(1).atStartOfDay();

        return recentLogs.stream()
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
                        log.getAppliance().getIsRecurring()
                ))
                .collect(Collectors.toList());
    }

    public void cancelScheduledTask(Integer userId, Integer logId) {
        ApplianceUsageLog log = applianceUsageLogRepository.findById(logId)
                .orElseThrow(() -> new ApplianceNotFound("Scheduled task not found"));

        if (!log.getAppliance().getUser().getUser_id().equals(userId)) {
            throw new ApplianceNotFound("Task does not belong to user");
        }

        applianceUsageLogRepository.delete(log);
    }

    public EcoAnalyticsDTO getUserEcoAnalytics(Integer userId) {
        List<ApplianceUsageLog> logs = applianceUsageLogRepository.findAllByUserId(userId);

        double totalSavedGrams = logs.stream()
                .mapToDouble(log -> log.getSavedCo2Grams() != null ? log.getSavedCo2Grams() : 0.0)
                .sum();

        double totalSavedRon = logs.stream()
                .mapToDouble(log -> log.getSavedMoneyRon() != null ? log.getSavedMoneyRon() : 0.0)
                .sum();

        double totalSavedKg = totalSavedGrams / 1000.0;

        double kmEquiv = totalSavedKg / 0.12;
        double treeEquiv = totalSavedKg / 1.83;

        Map<String, DoubleSummaryStatistics> dailyStats = logs.stream()
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
}