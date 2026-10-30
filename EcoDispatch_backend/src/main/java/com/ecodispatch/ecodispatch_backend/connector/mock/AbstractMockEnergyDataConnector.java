package com.ecodispatch.ecodispatch_backend.connector.mock;

import com.ecodispatch.ecodispatch_backend.connector.EnergyDataConnector;
import com.ecodispatch.ecodispatch_backend.connector.EnergyProvider;
import com.ecodispatch.ecodispatch_backend.connector.dto.HistoricalEnergyPointDTO;
import com.ecodispatch.ecodispatch_backend.connector.dto.LiveProductionDTO;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Shared synthetic PV / load / battery curves for hackathon demos.
 * Each provider only differs by display branding and a small seed offset.
 */
public abstract class AbstractMockEnergyDataConnector implements EnergyDataConnector {

    private static final ZoneId ZONE = ZoneId.of("Europe/Bucharest");

    protected abstract double productionScale();

    protected abstract double batteryBias();

    @Override
    public String connect(String accountLabel, String externalSiteId) {
        return "mock-" + getProvider().name().toLowerCase() + "-" + UUID.randomUUID();
    }

    @Override
    public LiveProductionDTO fetchLiveProduction(String externalToken) {
        ZonedDateTime now = ZonedDateTime.now(ZONE);
        double hour = now.getHour() + now.getMinute() / 60.0;
        double pv = estimatePvKw(hour) * productionScale();
        double load = 0.8 + ThreadLocalRandom.current().nextDouble(0, 1.2);
        double surplus = pv - load;
        double batteryPower = surplus > 0
                ? Math.min(surplus, 3.0)
                : -Math.min(-surplus, 3.0);
        double soc = Math.max(15, Math.min(95, 55 + batteryBias() + (hour - 13) * 2.5));

        double gridExport = Math.max(0, surplus - Math.max(0, batteryPower));
        double gridImport = Math.max(0, -surplus + Math.max(0, -batteryPower));

        return LiveProductionDTO.builder()
                .provider(getProvider().name())
                .pvPowerKw(round(pv))
                .gridImportKw(round(gridImport))
                .gridExportKw(round(gridExport))
                .batterySocPercent(round(soc))
                .batteryPowerKw(round(batteryPower))
                .homeLoadKw(round(load))
                .timestamp(Instant.now())
                .mock(true)
                .shellyLive(false)
                .solarLive(false)
                .dataSource("Simulated " + getProvider().getDisplayName())
                .statusMessage("Mock connector feed")
                .build();
    }

    @Override
    public List<HistoricalEnergyPointDTO> fetchHistorical(String externalToken, Instant from, Instant to) {
        List<HistoricalEnergyPointDTO> points = new ArrayList<>();
        ZonedDateTime cursor = from.atZone(ZONE).withMinute(0).withSecond(0).withNano(0);
        ZonedDateTime end = to.atZone(ZONE);

        while (!cursor.isAfter(end)) {
            double hour = cursor.getHour();
            double pv = estimatePvKw(hour) * productionScale();
            double load = 0.6 + (hour >= 18 && hour <= 22 ? 1.4 : 0.5);
            double export = Math.max(0, pv - load);
            double imports = Math.max(0, load - pv);
            double soc = Math.max(20, Math.min(95, 40 + batteryBias() + Math.max(0, 13 - Math.abs(hour - 13)) * 3));

            points.add(new HistoricalEnergyPointDTO(
                    cursor.toInstant(),
                    round(pv),
                    round(load),
                    round(imports),
                    round(export),
                    round(soc)
            ));
            cursor = cursor.plusHours(1);
        }
        return points;
    }

    private double estimatePvKw(double hourOfDay) {
        if (hourOfDay < 6 || hourOfDay > 20) {
            return 0.0;
        }
        double peak = 13.0;
        double distance = Math.abs(peak - hourOfDay);
        return Math.max(0, 5.5 * (1.0 - distance * 0.14));
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
