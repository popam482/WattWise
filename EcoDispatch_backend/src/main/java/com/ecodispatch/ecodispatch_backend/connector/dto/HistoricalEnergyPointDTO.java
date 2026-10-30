package com.ecodispatch.ecodispatch_backend.connector.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class HistoricalEnergyPointDTO {
    private Instant timestamp;
    private double pvProductionKwh;
    private double consumptionKwh;
    private double gridImportKwh;
    private double gridExportKwh;
    private Double batterySocPercent;
}
