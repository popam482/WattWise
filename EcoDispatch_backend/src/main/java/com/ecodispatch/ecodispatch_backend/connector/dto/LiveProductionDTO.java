package com.ecodispatch.ecodispatch_backend.connector.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LiveProductionDTO {
    private String provider;
    private double pvPowerKw;
    private double gridImportKw;
    private double gridExportKw;
    private double batterySocPercent;
    private double batteryPowerKw;
    private double homeLoadKw;
    private Instant timestamp;

    /** True when any portion of the payload is simulated. */
    private boolean mock;

    /** True when homeLoadKw came from Shelly Cloud. */
    private boolean shellyLive;

    /** True when pvPowerKw came from Open-Meteo. */
    private boolean solarLive;

    /** Human-readable source line for the UI badge. */
    private String dataSource;

    private String statusMessage;
}
