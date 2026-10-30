package com.ecodispatch.ecodispatch_backend.controller;

import com.ecodispatch.ecodispatch_backend.connector.EnergyProvider;
import com.ecodispatch.ecodispatch_backend.connector.dto.ConnectProviderRequestDTO;
import com.ecodispatch.ecodispatch_backend.connector.dto.ConnectorStatusDTO;
import com.ecodispatch.ecodispatch_backend.connector.dto.LiveProductionDTO;
import com.ecodispatch.ecodispatch_backend.service.EnergyConnectorService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class EnergyConnectorController {

    private final EnergyConnectorService energyConnectorService;

    public EnergyConnectorController(EnergyConnectorService energyConnectorService) {
        this.energyConnectorService = energyConnectorService;
    }

    @GetMapping("/users/{userId}/connectors")
    public List<ConnectorStatusDTO> list(@PathVariable Integer userId) {
        return energyConnectorService.listConnectors(userId);
    }

    @PostMapping("/users/{userId}/connectors/{provider}/connect")
    public ConnectorStatusDTO connect(@PathVariable Integer userId,
                                      @PathVariable EnergyProvider provider,
                                      @RequestBody(required = false) ConnectProviderRequestDTO request) {
        return energyConnectorService.connect(userId, provider, request != null ? request : new ConnectProviderRequestDTO());
    }

    @DeleteMapping("/users/{userId}/connectors/{provider}")
    public void disconnect(@PathVariable Integer userId, @PathVariable EnergyProvider provider) {
        energyConnectorService.disconnect(userId, provider);
    }

    @PostMapping("/users/{userId}/connectors/{provider}/sync")
    public Map<String, Object> sync(@PathVariable Integer userId, @PathVariable EnergyProvider provider) {
        return energyConnectorService.syncHistorical(userId, provider);
    }

    @GetMapping("/users/{userId}/connectors/{provider}/live")
    public LiveProductionDTO live(@PathVariable Integer userId, @PathVariable EnergyProvider provider) {
        return energyConnectorService.liveProduction(userId, provider);
    }

    /**
     * Fused live hub for the Dashboard badge: Shelly watts + Open-Meteo PV.
     * Never fails the pitch — connectors degrade internally.
     */
    @GetMapping("/users/{userId}/live-energy")
    public LiveProductionDTO liveEnergyHub(@PathVariable Integer userId) {
        return energyConnectorService.liveEnergyHub(userId);
    }
}
