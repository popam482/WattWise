package com.ecodispatch.ecodispatch_backend.connector;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Component
public class ConnectorRegistry {

    private final Map<EnergyProvider, EnergyDataConnector> connectors = new EnumMap<>(EnergyProvider.class);

    public ConnectorRegistry(List<EnergyDataConnector> connectorBeans) {
        for (EnergyDataConnector connector : connectorBeans) {
            connectors.put(connector.getProvider(), connector);
        }
    }

    public EnergyDataConnector require(EnergyProvider provider) {
        EnergyDataConnector connector = connectors.get(provider);
        if (connector == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No connector registered for " + provider);
        }
        return connector;
    }

    public List<EnergyDataConnector> all() {
        return List.copyOf(connectors.values());
    }
}
