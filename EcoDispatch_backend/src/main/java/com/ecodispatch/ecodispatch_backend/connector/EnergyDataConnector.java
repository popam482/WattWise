package com.ecodispatch.ecodispatch_backend.connector;

import com.ecodispatch.ecodispatch_backend.connector.dto.ConnectProviderRequestDTO;
import com.ecodispatch.ecodispatch_backend.connector.dto.HistoricalEnergyPointDTO;
import com.ecodispatch.ecodispatch_backend.connector.dto.LiveProductionDTO;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Contract for third-party inverter / smart-meter integrations.
 * Implementations MUST degrade gracefully (never throw on live fetch).
 */
public interface EnergyDataConnector {

    EnergyProvider getProvider();

    /**
     * Establish a connection. Returns an opaque token to persist
     * (for Shelly this is typically the auth_key itself).
     */
    default String connect(ConnectProviderRequestDTO request) {
        String label = request != null ? request.getAccountLabel() : null;
        String site = request != null ? request.getExternalSiteId() : null;
        return connect(label, site);
    }

    default String connect(String accountLabel, String externalSiteId) {
        return "mock-" + getProvider().name().toLowerCase() + "-" + UUID.randomUUID();
    }

    /**
     * Preferred live fetch with full connection context (device id, host, key).
     */
    default LiveProductionDTO fetchLiveProduction(ProviderConnection connection) {
        return fetchLiveProduction(connection != null ? connection.getExternalToken() : null);
    }

    LiveProductionDTO fetchLiveProduction(String externalToken);

    List<HistoricalEnergyPointDTO> fetchHistorical(String externalToken, Instant from, Instant to);

    default List<HistoricalEnergyPointDTO> fetchHistorical(ProviderConnection connection, Instant from, Instant to) {
        return fetchHistorical(connection != null ? connection.getExternalToken() : null, from, to);
    }

    default void disconnect(String externalToken) {
        // no-op by default
    }
}
