package com.ecodispatch.ecodispatch_backend.connector.mock;

import com.ecodispatch.ecodispatch_backend.connector.EnergyProvider;
import org.springframework.stereotype.Component;

@Component
public class HuaweiFusionSolarConnector extends AbstractMockEnergyDataConnector {
    @Override
    public EnergyProvider getProvider() {
        return EnergyProvider.HUAWEI_FUSIONSOLAR;
    }

    @Override
    protected double productionScale() {
        return 1.05;
    }

    @Override
    protected double batteryBias() {
        return 4.0;
    }
}
