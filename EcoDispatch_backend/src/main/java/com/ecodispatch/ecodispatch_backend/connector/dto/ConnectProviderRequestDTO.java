package com.ecodispatch.ecodispatch_backend.connector.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ConnectProviderRequestDTO {
    /** Display label (email / plant name). */
    private String accountLabel;

    /** Generic site id OR Shelly device id. */
    private String externalSiteId;

    /** Shelly Cloud device id (preferred over externalSiteId for SHELLY). */
    private String deviceId;

    /** Shelly Cloud authorization key from the Shelly app. */
    private String authKey;

    /**
     * Shelly Cloud host, e.g. {@code shelly-76-eu.shelly.cloud}.
     * Defaults to EU host when blank.
     */
    private String cloudHost;
}
