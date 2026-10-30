package com.ecodispatch.ecodispatch_backend.connector.mock;

import com.ecodispatch.ecodispatch_backend.connector.EnergyProvider;
import org.springframework.stereotype.Component;

@Component
public class HomeAssistantConnector extends AbstractMockEnergyDataConnector {
    @Override
    public EnergyProvider getProvider() {
        return EnergyProvider.HOME_ASSISTANT;
    }

    @Override
    protected double productionScale() {
        return 1.0;
    }

    @Override
    protected double batteryBias() {
        return 6.0;
    }
}
