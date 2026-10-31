package com.ecodispatch.ecodispatch_backend.service;

import com.ecodispatch.ecodispatch_backend.config.ExternalHttpConfig;
import com.ecodispatch.ecodispatch_backend.profile.EnergyProfile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

/**
 * Live / near-term PV estimate from Open-Meteo (no API key).
 * Uses shortwave radiation × system kWp × performance factor.
 */
@Service
public class LiveSolarProductionService {

    private static final Logger log = LoggerFactory.getLogger(LiveSolarProductionService.class);
    private static final ZoneId ZONE = ZoneId.of("Europe/Bucharest");
    private static final double DEFAULT_PERFORMANCE = 0.80;

    private final RestTemplate externalRestTemplate;

    public LiveSolarProductionService(
            @Qualifier(ExternalHttpConfig.EXTERNAL_REST_TEMPLATE) RestTemplate externalRestTemplate) {
        this.externalRestTemplate = externalRestTemplate;
    }

    public record SolarLiveEstimate(
            double pvPowerKw,
            double shortwaveRadiationWm2,
            boolean live,
            String message
    ) {
    }

    public SolarLiveEstimate estimateLivePv(EnergyProfile profile) {
        if (profile == null) {
            return new SolarLiveEstimate(0.0, 0.0, false, "No energy profile — solar production unavailable");
        }
        double systemKwp = profile.getPvSystemKw() != null ? profile.getPvSystemKw() : 0.0;
        if (systemKwp <= 0) {
            // Consumers / zero-capacity profiles must never receive a fake PV curve
            return new SolarLiveEstimate(0.0, 0.0, false, "No PV capacity configured — solar production is zero");
        }
        if (profile.getLatitude() == null || profile.getLongitude() == null) {
            return fallback(profile, "Energy profile missing coordinates — using solar curve fallback");
        }

        try {
            String url = UriComponentsBuilder
                    .fromUriString("https://api.open-meteo.com/v1/forecast")
                    .queryParam("latitude", profile.getLatitude())
                    .queryParam("longitude", profile.getLongitude())
                    .queryParam("current", "shortwave_radiation")
                    .queryParam("hourly", "shortwave_radiation")
                    .queryParam("forecast_days", 1)
                    .queryParam("timezone", "Europe/Bucharest")
                    .toUriString();

            @SuppressWarnings("unchecked")
            Map<String, Object> body = externalRestTemplate.getForObject(url, Map.class);
            Double radiation = extractCurrentRadiation(body);
            if (radiation == null) {
                radiation = extractHourlyRadiationForNow(body);
            }
            if (radiation == null) {
                return fallback(profile, "Open-Meteo returned no radiation — using solar curve fallback");
            }

            double pvKw = (radiation / 1000.0) * systemKwp * DEFAULT_PERFORMANCE;
            // Mild tilt/azimuth efficiency nudge (does not invent weather)
            if (profile.getTilt() != null) {
                pvKw *= Math.max(0.75, 1.0 - Math.abs(profile.getTilt() - 35.0) * 0.004);
            }
            pvKw = Math.max(0.0, round(pvKw));

            return new SolarLiveEstimate(
                    pvKw,
                    round(radiation),
                    true,
                    "Open-Meteo shortwave " + round(radiation) + " W/m² → " + pvKw + " kW"
            );
        } catch (Exception ex) {
            log.warn("Open-Meteo live solar fetch failed ({}). Falling back.", ex.getMessage());
            return fallback(profile, "Open-Meteo unreachable — graceful solar fallback");
        }
    }

    @SuppressWarnings("unchecked")
    private Double extractCurrentRadiation(Map<String, Object> body) {
        if (body == null) {
            return null;
        }
        Object current = body.get("current");
        if (current instanceof Map<?, ?> currentMap) {
            return toDouble(((Map<String, Object>) currentMap).get("shortwave_radiation"));
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private Double extractHourlyRadiationForNow(Map<String, Object> body) {
        if (body == null) {
            return null;
        }
        Object hourlyObj = body.get("hourly");
        if (!(hourlyObj instanceof Map<?, ?> hourly)) {
            return null;
        }
        Object timesObj = hourly.get("time");
        Object radObj = hourly.get("shortwave_radiation");
        if (!(timesObj instanceof List<?> times) || !(radObj instanceof List<?> rads)) {
            return null;
        }
        String nowHour = LocalDateTime.now(ZONE).withMinute(0).withSecond(0).withNano(0)
                .toString()
                .substring(0, 16); // yyyy-MM-dd'T'HH:mm
        for (int i = 0; i < times.size() && i < rads.size(); i++) {
            Object t = times.get(i);
            if (t != null && t.toString().startsWith(nowHour.substring(0, 13))) {
                return toDouble(rads.get(i));
            }
        }
        // Closest available sample
        int idx = Math.min(LocalDateTime.now(ZONE).getHour(), Math.max(0, rads.size() - 1));
        return toDouble(rads.get(idx));
    }

    private SolarLiveEstimate fallback(EnergyProfile profile, String message) {
        double systemKwp = profile != null && profile.getPvSystemKw() != null ? profile.getPvSystemKw() : 0.0;
        if (systemKwp <= 0) {
            return new SolarLiveEstimate(0.0, 0.0, false, message);
        }
        int hour = LocalDateTime.now(ZONE).getHour();
        double pv = 0.0;
        if (hour >= 6 && hour <= 20) {
            double peak = 13.0;
            double distance = Math.abs(peak - hour);
            pv = systemKwp * Math.max(0.0, 1.0 - distance * 0.15) * DEFAULT_PERFORMANCE;
        }
        return new SolarLiveEstimate(round(pv), 0.0, false, message);
    }

    private static Double toDouble(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return Double.parseDouble(text.trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
