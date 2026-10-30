package com.ecodispatch.ecodispatch_backend.service;

import com.ecodispatch.ecodispatch_backend.connector.*;
import com.ecodispatch.ecodispatch_backend.connector.dto.*;
import com.ecodispatch.ecodispatch_backend.errors.UserNotFound;
import com.ecodispatch.ecodispatch_backend.profile.EnergyProfile;
import com.ecodispatch.ecodispatch_backend.repositories.EnergyProfileRepository;
import com.ecodispatch.ecodispatch_backend.repositories.UserRepository;
import com.ecodispatch.ecodispatch_backend.security.OwnershipGuard;
import com.ecodispatch.ecodispatch_backend.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class EnergyConnectorService {

    private final ConnectorRegistry connectorRegistry;
    private final ProviderConnectionRepository connectionRepository;
    private final UserRepository userRepository;
    private final EnergyProfileRepository energyProfileRepository;
    private final OwnershipGuard ownershipGuard;
    private final LiveSolarProductionService liveSolarProductionService;

    public EnergyConnectorService(ConnectorRegistry connectorRegistry,
                                  ProviderConnectionRepository connectionRepository,
                                  UserRepository userRepository,
                                  EnergyProfileRepository energyProfileRepository,
                                  OwnershipGuard ownershipGuard,
                                  LiveSolarProductionService liveSolarProductionService) {
        this.connectorRegistry = connectorRegistry;
        this.connectionRepository = connectionRepository;
        this.userRepository = userRepository;
        this.energyProfileRepository = energyProfileRepository;
        this.ownershipGuard = ownershipGuard;
        this.liveSolarProductionService = liveSolarProductionService;
    }

    public List<ConnectorStatusDTO> listConnectors(Integer userId) {
        ownershipGuard.requireOwnership(userId);

        Map<EnergyProvider, ProviderConnection> active = new EnumMap<>(EnergyProvider.class);
        for (ProviderConnection connection : connectionRepository.findActiveByUserId(userId)) {
            active.put(connection.getProvider(), connection);
        }

        List<ConnectorStatusDTO> statuses = new ArrayList<>();
        for (EnergyProvider provider : EnergyProvider.values()) {
            statuses.add(toStatus(provider, active.get(provider)));
        }
        return statuses;
    }

    @Transactional
    public ConnectorStatusDTO connect(Integer userId, EnergyProvider provider, ConnectProviderRequestDTO request) {
        ownershipGuard.requireOwnership(userId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFound(userId));

        ConnectProviderRequestDTO safeRequest = request != null ? request : new ConnectProviderRequestDTO();
        EnergyDataConnector connector = connectorRegistry.require(provider);
        String token = connector.connect(safeRequest);

        String deviceOrSite = firstNonBlank(safeRequest.getDeviceId(), safeRequest.getExternalSiteId());
        String accountLabel = !isBlank(safeRequest.getAccountLabel())
                ? safeRequest.getAccountLabel().trim()
                : (provider == EnergyProvider.SHELLY ? "Shelly device " + nullToEmpty(deviceOrSite) : "demo@" + provider.name().toLowerCase());

        boolean realCredentials = provider == EnergyProvider.SHELLY
                && !isBlank(deviceOrSite)
                && !isBlank(safeRequest.getAuthKey());

        ProviderConnection connection = connectionRepository.findByUserIdAndProvider(userId, provider)
                .orElseGet(ProviderConnection::new);
        connection.setUser(user);
        connection.setProvider(provider);
        connection.setAccountLabel(accountLabel);
        connection.setExternalSiteId(!isBlank(deviceOrSite) ? deviceOrSite : "SITE-" + userId);
        connection.setExternalToken(token);
        connection.setCloudHost(normalizeOptionalHost(safeRequest.getCloudHost()));
        connection.setRealCredentials(realCredentials);
        connection.setConnectedAt(Instant.now());
        connection.setLastSyncAt(null);
        connection.setSyncedPoints(0);
        connection.setLastLiveFetchAt(null);
        connection.setLastLiveWasReal(null);
        connection.setActive(true);

        return toStatus(provider, connectionRepository.save(connection));
    }

    @Transactional
    public void disconnect(Integer userId, EnergyProvider provider) {
        ownershipGuard.requireOwnership(userId);
        ProviderConnection connection = connectionRepository.findActiveByUserIdAndProvider(userId, provider)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Provider is not connected"));

        connectorRegistry.require(provider).disconnect(connection.getExternalToken());
        connection.setActive(false);
        connection.setRealCredentials(false);
        connectionRepository.save(connection);
    }

    @Transactional
    public Map<String, Object> syncHistorical(Integer userId, EnergyProvider provider) {
        ownershipGuard.requireOwnership(userId);
        ProviderConnection connection = connectionRepository.findActiveByUserIdAndProvider(userId, provider)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Connect the provider before syncing"));

        Instant to = Instant.now();
        Instant from = to.minus(7, ChronoUnit.DAYS);
        List<HistoricalEnergyPointDTO> points = connectorRegistry.require(provider)
                .fetchHistorical(connection, from, to);

        connection.setLastSyncAt(Instant.now());
        connection.setSyncedPoints(points.size());
        connectionRepository.save(connection);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("provider", provider.name());
        payload.put("syncedPoints", points.size());
        payload.put("from", from.toString());
        payload.put("to", to.toString());
        payload.put("sample", points.stream().limit(24).toList());
        payload.put("status", toStatus(provider, connection));
        return payload;
    }

    /**
     * Provider-scoped live read (Shelly consumption), then fused with Open-Meteo PV when profile exists.
     */
    @Transactional
    public LiveProductionDTO liveProduction(Integer userId, EnergyProvider provider) {
        ownershipGuard.requireOwnership(userId);
        ProviderConnection connection = connectionRepository.findActiveByUserIdAndProvider(userId, provider)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Connect the provider before reading live data"));

        LiveProductionDTO deviceLive = connectorRegistry.require(provider).fetchLiveProduction(connection);
        LiveProductionDTO fused = fuseWithSolar(userId, deviceLive);

        connection.setLastLiveFetchAt(Instant.now());
        connection.setLastLiveWasReal(Boolean.TRUE.equals(fused.isShellyLive()) || Boolean.TRUE.equals(fused.isSolarLive()));
        connectionRepository.save(connection);
        return fused;
    }

    /**
     * Dashboard hub endpoint — always succeeds.
     * Combines Shelly (if connected) + Open-Meteo (if energy profile exists).
     */
    public LiveProductionDTO liveEnergyHub(Integer userId) {
        ownershipGuard.requireOwnership(userId);

        LiveProductionDTO deviceLive = connectionRepository
                .findActiveByUserIdAndProvider(userId, EnergyProvider.SHELLY)
                .map(conn -> connectorRegistry.require(EnergyProvider.SHELLY).fetchLiveProduction(conn))
                .orElse(null);

        return fuseWithSolar(userId, deviceLive);
    }

    private LiveProductionDTO fuseWithSolar(Integer userId, LiveProductionDTO deviceLive) {
        EnergyProfile profile = energyProfileRepository.findByUserId(userId).orElse(null);
        LiveSolarProductionService.SolarLiveEstimate solar = liveSolarProductionService.estimateLivePv(profile);

        double homeLoad = deviceLive != null ? deviceLive.getHomeLoadKw() : 0.0;
        boolean shellyLive = deviceLive != null && deviceLive.isShellyLive();
        boolean deviceMock = deviceLive == null || deviceLive.isMock();

        double pv = solar.pvPowerKw();
        double surplus = pv - homeLoad;
        double gridExport = Math.max(0.0, surplus);
        double gridImport = Math.max(0.0, -surplus);

        List<String> sources = new ArrayList<>();
        if (shellyLive) {
            sources.add("Shelly Cloud");
        } else if (deviceLive != null) {
            sources.add("Shelly (fallback)");
        }
        if (solar.live()) {
            sources.add("Open-Meteo");
        } else {
            sources.add("Open-Meteo (fallback)");
        }

        String status = buildHubStatus(deviceLive, solar);

        return LiveProductionDTO.builder()
                .provider(deviceLive != null ? deviceLive.getProvider() : "WATTWISE_HUB")
                .pvPowerKw(pv)
                .homeLoadKw(round(homeLoad))
                .gridImportKw(round(gridImport))
                .gridExportKw(round(gridExport))
                .batterySocPercent(deviceLive != null ? deviceLive.getBatterySocPercent() : estimateSoc(profile, surplus))
                .batteryPowerKw(deviceLive != null ? deviceLive.getBatteryPowerKw() : 0.0)
                .timestamp(Instant.now())
                .mock(deviceMock && !solar.live())
                .shellyLive(shellyLive)
                .solarLive(solar.live())
                .dataSource(String.join(" + ", sources))
                .statusMessage(status)
                .build();
    }

    private String buildHubStatus(LiveProductionDTO deviceLive, LiveSolarProductionService.SolarLiveEstimate solar) {
        StringBuilder sb = new StringBuilder();
        if (deviceLive != null && deviceLive.getStatusMessage() != null) {
            sb.append(deviceLive.getStatusMessage());
        } else {
            sb.append("No Shelly device linked");
        }
        sb.append(" · ");
        sb.append(solar.message());
        return sb.toString();
    }

    private double estimateSoc(EnergyProfile profile, double surplus) {
        if (profile == null || !profile.isHasBattery()) {
            return 0.0;
        }
        double base = 55.0 + Math.max(-20.0, Math.min(30.0, surplus * 8.0));
        return round(Math.max(15.0, Math.min(95.0, base)));
    }

    private ConnectorStatusDTO toStatus(EnergyProvider provider, ProviderConnection connection) {
        if (connection == null || !connection.isActive()) {
            return new ConnectorStatusDTO(
                    provider.name(),
                    provider.getDisplayName(),
                    provider.getCategory(),
                    false,
                    null,
                    null,
                    null,
                    null,
                    null,
                    "Not connected",
                    false,
                    null
            );
        }
        String message;
        if (connection.isRealCredentials()) {
            message = connection.getLastLiveWasReal() != null && connection.getLastLiveWasReal()
                    ? "Live credentials ready — last fetch was REAL"
                    : "Live credentials stored — awaiting first live fetch";
        } else if (connection.getLastSyncAt() == null) {
            message = "Connected — awaiting first sync";
        } else {
            message = "Synced";
        }
        return new ConnectorStatusDTO(
                provider.name(),
                provider.getDisplayName(),
                provider.getCategory(),
                true,
                connection.getAccountLabel(),
                connection.getExternalSiteId(),
                connection.getConnectedAt(),
                connection.getLastSyncAt(),
                connection.getSyncedPoints(),
                message,
                connection.isRealCredentials(),
                connection.getCloudHost()
        );
    }

    private static String normalizeOptionalHost(String host) {
        if (isBlank(host)) {
            return null;
        }
        return host.trim()
                .replace("https://", "")
                .replace("http://", "")
                .replaceAll("/$", "");
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String firstNonBlank(String a, String b) {
        if (!isBlank(a)) return a.trim();
        if (!isBlank(b)) return b.trim();
        return null;
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
