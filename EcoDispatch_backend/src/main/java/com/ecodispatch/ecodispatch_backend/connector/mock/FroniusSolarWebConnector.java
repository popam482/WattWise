package com.ecodispatch.ecodispatch_backend.connector.mock;

import com.ecodispatch.ecodispatch_backend.connector.EnergyProvider;
import org.springframework.stereotype.Component;

@Component
public class FroniusSolarWebConnector extends AbstractMockEnergyDataConnector {
    @Override
    public EnergyProvider getProvider() {
        return EnergyProvider.FRONIUS_SOLARWEB;
    }

    @Override
    protected double productionScale() {
        return 0.95;
    }

    @Override
    protected double batteryBias() {
        return -2.0;
    }
}
