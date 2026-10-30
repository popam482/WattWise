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
public class ConnectorStatusDTO {
    private String provider;
    private String displayName;
    private String category;
    private boolean connected;
    private String accountLabel;
    private String externalSiteId;
    private Instant connectedAt;
    private Instant lastSyncAt;
    private Integer syncedPoints;
    private String statusMessage;
    /** True when real vendor credentials are stored (not just a mock link). */
    private boolean realCredentials;
    private String cloudHost;
}
