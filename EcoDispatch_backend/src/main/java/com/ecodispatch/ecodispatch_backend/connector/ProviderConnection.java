package com.ecodispatch.ecodispatch_backend.connector;

import com.ecodispatch.ecodispatch_backend.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(
        name = "provider_connections",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "provider"})
)
@Getter
@Setter
public class ProviderConnection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EnergyProvider provider;

    private String accountLabel;

    /** For Shelly: device id. For others: plant / site id. */
    private String externalSiteId;

    /**
     * Opaque access material. For Shelly Cloud this stores the auth_key.
     * Length raised to fit real cloud keys.
     */
    @Column(nullable = false, length = 512)
    private String externalToken;

    /** Shelly Cloud host, e.g. shelly-76-eu.shelly.cloud */
    @Column(length = 255)
    private String cloudHost;

    @Column(nullable = false)
    private boolean realCredentials = false;

    @Column(nullable = false)
    private Instant connectedAt = Instant.now();

    private Instant lastSyncAt;
    private Integer syncedPoints = 0;

    private Instant lastLiveFetchAt;
    private Boolean lastLiveWasReal;

    @Column(nullable = false)
    private boolean active = true;

    public ProviderConnection() {
    }
}
