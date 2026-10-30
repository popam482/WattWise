package com.ecodispatch.ecodispatch_backend.connector.shelly;

import com.ecodispatch.ecodispatch_backend.config.ExternalHttpConfig;
import com.ecodispatch.ecodispatch_backend.connector.EnergyDataConnector;
import com.ecodispatch.ecodispatch_backend.connector.EnergyProvider;
import com.ecodispatch.ecodispatch_backend.connector.ProviderConnection;
import com.ecodispatch.ecodispatch_backend.connector.dto.ConnectProviderRequestDTO;
import com.ecodispatch.ecodispatch_backend.connector.dto.HistoricalEnergyPointDTO;
import com.ecodispatch.ecodispatch_backend.connector.dto.LiveProductionDTO;
import com.ecodispatch.ecodispatch_backend.connector.mock.AbstractMockEnergyDataConnector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Real Shelly Cloud connector with silent fallback to simulated load curves.
 * Endpoint: GET https://{host}/device/status?id={deviceId}&auth_key={authKey}
 */
@Component
public class ShellyConnector implements EnergyDataConnector {

    private static final Logger log = LoggerFactory.getLogger(ShellyConnector.class);
    private static final String DEFAULT_HOST = "shelly-76-eu.shelly.cloud";
    private static final ZoneId ZONE = ZoneId.of("Europe/Bucharest");

    private final RestTemplate externalRestTemplate;
    private final FallbackMock fallbackMock = new FallbackMock();

    public ShellyConnector(@Qualifier(ExternalHttpConfig.EXTERNAL_REST_TEMPLATE) RestTemplate externalRestTemplate) {
        this.externalRestTemplate = externalRestTemplate;
    }

    @Override
    public EnergyProvider getProvider() {
        return EnergyProvider.SHELLY;
    }

    @Override
    public String connect(ConnectProviderRequestDTO request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Shelly connection payload is required");
        }
        String deviceId = firstNonBlank(request.getDeviceId(), request.getExternalSiteId());
        String authKey = request.getAuthKey();
        if (isBlank(deviceId) || isBlank(authKey)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Shelly requires deviceId and authKey from the Shelly Cloud app"
            );
        }
        // Persist the auth key as the external token; host/device live on the connection row.
        return authKey.trim();
    }

    @Override
    public LiveProductionDTO fetchLiveProduction(ProviderConnection connection) {
        if (connection == null || isBlank(connection.getExternalToken()) || isBlank(connection.getExternalSiteId())) {
            return degrade("Missing Shelly credentials — using simulated load");
        }

        try {
            String host = normalizeHost(connection.getCloudHost());
            String url = UriComponentsBuilder
                    .fromUriString("https://" + host + "/device/status")
                    .queryParam("id", connection.getExternalSiteId())
                    .queryParam("auth_key", connection.getExternalToken())
                    .encode()
                    .toUriString();

            @SuppressWarnings("unchecked")
            Map<String, Object> response = externalRestTemplate.getForObject(url, Map.class);
            Double watts = extractPowerWatts(response);
            if (watts == null) {
                log.warn("Shelly response parsed but no power field found; falling back");
                return degrade("Shelly online but power field missing — using simulated load");
            }

            double loadKw = Math.max(0.0, watts / 1000.0);
            return LiveProductionDTO.builder()
                    .provider(EnergyProvider.SHELLY.name())
                    .homeLoadKw(round(loadKw))
                    .pvPowerKw(0.0)
                    .gridImportKw(round(loadKw))
                    .gridExportKw(0.0)
                    .batterySocPercent(0.0)
                    .batteryPowerKw(0.0)
                    .timestamp(Instant.now())
                    .mock(false)
                    .shellyLive(true)
                    .solarLive(false)
                    .dataSource("Shelly Cloud")
                    .statusMessage("Live consumption from Shelly Cloud (" + round(watts) + " W)")
                    .build();
        } catch (Exception ex) {
            log.warn("Shelly Cloud live fetch failed ({}). Falling back to simulation.", ex.getMessage());
            return degrade("Shelly unreachable — graceful demo fallback");
        }
    }

    @Override
    public LiveProductionDTO fetchLiveProduction(String externalToken) {
        return degrade("Token-only Shelly fetch not supported — using simulation");
    }

    @Override
    public List<HistoricalEnergyPointDTO> fetchHistorical(String externalToken, Instant from, Instant to) {
        // Shelly Cloud status API is live-only; return a realistic synthetic history so Sync still demos.
        return fallbackMock.fetchHistorical(externalToken, from, to);
    }

    @Override
    public List<HistoricalEnergyPointDTO> fetchHistorical(ProviderConnection connection, Instant from, Instant to) {
        return fetchHistorical(connection != null ? connection.getExternalToken() : null, from, to);
    }

    private LiveProductionDTO degrade(String message) {
        LiveProductionDTO simulated = fallbackMock.fetchLiveProduction("fallback");
        simulated.setProvider(EnergyProvider.SHELLY.name());
        simulated.setMock(true);
        simulated.setShellyLive(false);
        simulated.setSolarLive(false);
        simulated.setDataSource("Simulated Shelly fallback");
        simulated.setStatusMessage(message);
        return simulated;
    }

    @SuppressWarnings("unchecked")
    private Double extractPowerWatts(Map<String, Object> response) {
        if (response == null) {
            return null;
        }
        Object isOk = response.get("isok");
        if (Boolean.FALSE.equals(isOk)) {
            return null;
        }

        Object dataObj = response.get("data");
        if (!(dataObj instanceof Map<?, ?> data)) {
            // Some proxies return status at top level
            return findPowerWattsRecursive(response);
        }

        Object statusObj = data.get("device_status");
        if (statusObj instanceof Map<?, ?> status) {
            Double fromStatus = findPowerWattsInDeviceStatus((Map<String, Object>) status);
            if (fromStatus != null) {
                return fromStatus;
            }
        }
        return findPowerWattsRecursive((Map<String, Object>) data);
    }

    @SuppressWarnings("unchecked")
    private Double findPowerWattsInDeviceStatus(Map<String, Object> status) {
        // Gen1 meters[]
        Object meters = status.get("meters");
        if (meters instanceof List<?> meterList && !meterList.isEmpty() && meterList.get(0) instanceof Map<?, ?> meter) {
            Object power = ((Map<String, Object>) meter).get("power");
            Double parsed = toDouble(power);
            if (parsed != null) {
                return parsed;
            }
        }

        // Gen2+ keyed channels: switch:0, em:0, pm1:0, em1:0
        for (Map.Entry<String, Object> entry : status.entrySet()) {
            if (!(entry.getValue() instanceof Map<?, ?> channel)) {
                continue;
            }
            Map<String, Object> ch = (Map<String, Object>) channel;
            for (String key : List.of("apower", "total_act_power", "act_power", "power", "instant_power")) {
                Double parsed = toDouble(ch.get(key));
                if (parsed != null) {
                    return parsed;
                }
            }
        }
        return findPowerWattsRecursive(status);
    }

    @SuppressWarnings("unchecked")
    private Double findPowerWattsRecursive(Map<String, Object> node) {
        for (Map.Entry<String, Object> entry : node.entrySet()) {
            String key = entry.getKey() != null ? entry.getKey().toLowerCase() : "";
            Object value = entry.getValue();
            if (value instanceof Number && (key.contains("power") || key.equals("apower") || key.equals("watts"))) {
                return ((Number) value).doubleValue();
            }
            if (value instanceof Map<?, ?> nested) {
                Double found = findPowerWattsRecursive((Map<String, Object>) nested);
                if (found != null) {
                    return found;
                }
            }
            if (value instanceof List<?> list) {
                for (Object item : list) {
                    if (item instanceof Map<?, ?> mapItem) {
                        Double found = findPowerWattsRecursive((Map<String, Object>) mapItem);
                        if (found != null) {
                            return found;
                        }
                    }
                }
            }
        }
        return null;
    }

    private String normalizeHost(String cloudHost) {
        if (isBlank(cloudHost)) {
            return DEFAULT_HOST;
        }
        String host = cloudHost.trim()
                .replace("https://", "")
                .replace("http://", "");
        if (host.endsWith("/")) {
            host = host.substring(0, host.length() - 1);
        }
        return host;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String firstNonBlank(String a, String b) {
        if (!isBlank(a)) return a.trim();
        if (!isBlank(b)) return b.trim();
        return null;
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

    /** Tiny inner mock so we don't register a second SHELLY Spring bean. */
    private static final class FallbackMock extends AbstractMockEnergyDataConnector {
        @Override
        public EnergyProvider getProvider() {
            return EnergyProvider.SHELLY;
        }

        @Override
        protected double productionScale() {
            return 0.75;
        }

        @Override
        protected double batteryBias() {
            return 0.0;
        }

        @Override
        public LiveProductionDTO fetchLiveProduction(String externalToken) {
            ZonedDateTime now = ZonedDateTime.now(ZONE);
            double hour = now.getHour() + now.getMinute() / 60.0;
            double load = 0.6 + ThreadLocalRandom.current().nextDouble(0, 1.4)
                    + (hour >= 18 && hour <= 22 ? 0.8 : 0.0);
            return LiveProductionDTO.builder()
                    .provider(EnergyProvider.SHELLY.name())
                    .homeLoadKw(Math.round(load * 100.0) / 100.0)
                    .pvPowerKw(0.0)
                    .gridImportKw(Math.round(load * 100.0) / 100.0)
                    .gridExportKw(0.0)
                    .batterySocPercent(50.0)
                    .batteryPowerKw(0.0)
                    .timestamp(Instant.now())
                    .mock(true)
                    .build();
        }

        @Override
        public List<HistoricalEnergyPointDTO> fetchHistorical(String externalToken, Instant from, Instant to) {
            List<HistoricalEnergyPointDTO> points = new ArrayList<>();
            ZonedDateTime cursor = from.atZone(ZONE).withMinute(0).withSecond(0).withNano(0);
            ZonedDateTime end = to.atZone(ZONE);
            while (!cursor.isAfter(end)) {
                double hour = cursor.getHour();
                double load = 0.6 + (hour >= 18 && hour <= 22 ? 1.4 : 0.5);
                points.add(new HistoricalEnergyPointDTO(
                        cursor.toInstant(),
                        0.0,
                        Math.round(load * 100.0) / 100.0,
                        Math.round(load * 100.0) / 100.0,
                        0.0,
                        50.0
                ));
                cursor = cursor.plusHours(1);
            }
            return points;
        }
    }
}
