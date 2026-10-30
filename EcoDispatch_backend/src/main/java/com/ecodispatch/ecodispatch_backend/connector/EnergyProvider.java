package com.ecodispatch.ecodispatch_backend.connector;

public enum EnergyProvider {
    HUAWEI_FUSIONSOLAR("Huawei FusionSolar", "Inverter / PV monitoring"),
    FRONIUS_SOLARWEB("Fronius Solar.web", "Inverter / PV monitoring"),
    SHELLY("Shelly", "Smart meter / plugs"),
    HOME_ASSISTANT("Home Assistant", "Local energy hub");

    private final String displayName;
    private final String category;

    EnergyProvider(String displayName, String category) {
        this.displayName = displayName;
        this.category = category;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getCategory() {
        return category;
    }
}
