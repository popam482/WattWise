package com.ecodispatch.ecodispatch_backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.Map;

/**
 * Resolves lat/lon to a human-readable locality for Romania-first WattWise profiles.
 * Prefer nearest known city (fast/offline); fall back to Nominatim reverse geocode.
 */
@Service
public class LocationNameResolver {

    private static final Logger log = LoggerFactory.getLogger(LocationNameResolver.class);
    private static final String FALLBACK = "Localitatea mea";
    /** Match radius for curated city catalogue (~45 km). */
    private static final double CITY_MATCH_KM = 45.0;

    private static final List<City> CITIES = List.of(
            new City("Sibiu", 45.7983, 24.1256),
            new City("Cluj-Napoca", 46.7712, 23.6236),
            new City("Bucharest", 44.4268, 26.1025),
            new City("Timișoara", 45.7489, 21.2087),
            new City("Iași", 47.1585, 27.6014),
            new City("Brașov", 45.6579, 25.6012),
            new City("Constanța", 44.1598, 28.6348),
            new City("Oradea", 47.0465, 21.9189),
            new City("Craiova", 44.3302, 23.7949),
            new City("Galați", 45.4353, 28.0080),
            new City("Ploiești", 44.9462, 26.0365),
            new City("Arad", 46.1866, 21.3123),
            new City("Pitești", 44.8565, 24.8692),
            new City("Bacău", 46.5670, 26.9140),
            new City("Târgu Mureș", 46.5425, 24.5575)
    );

    private final RestTemplate restTemplate;

    public LocationNameResolver(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public String resolve(Double latitude, Double longitude) {
        if (latitude == null || longitude == null
                || !Double.isFinite(latitude) || !Double.isFinite(longitude)) {
            return FALLBACK;
        }

        City nearest = nearestCity(latitude, longitude);
        if (nearest != null && nearest.distanceKm <= CITY_MATCH_KM) {
            return nearest.name + ", Romania";
        }

        String remote = reverseGeocode(latitude, longitude);
        if (remote != null && !remote.isBlank()) {
            return remote;
        }

        if (nearest != null) {
            return nearest.name + ", Romania";
        }
        return FALLBACK;
    }

    private City nearestCity(double lat, double lon) {
        City best = null;
        for (City city : CITIES) {
            double d = haversineKm(lat, lon, city.lat, city.lon);
            if (best == null || d < best.distanceKm) {
                best = new City(city.name, city.lat, city.lon, d);
            }
        }
        return best;
    }

    @SuppressWarnings("unchecked")
    private String reverseGeocode(double lat, double lon) {
        try {
            String url = UriComponentsBuilder
                    .fromUriString("https://nominatim.openstreetmap.org/reverse")
                    .queryParam("format", "json")
                    .queryParam("lat", lat)
                    .queryParam("lon", lon)
                    .queryParam("zoom", 10)
                    .queryParam("addressdetails", 1)
                    .toUriString();

            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.USER_AGENT, "WattWise/1.0 (energy-dispatch; contact=wattwise@local)");
            headers.set(HttpHeaders.ACCEPT_LANGUAGE, "en");

            ResponseEntity<Map> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
            Map<String, Object> body = response.getBody();
            if (body == null) {
                return null;
            }

            Object addressObj = body.get("address");
            if (addressObj instanceof Map<?, ?> address) {
                String city = firstNonBlank(
                        (String) address.get("city"),
                        (String) address.get("town"),
                        (String) address.get("municipality"),
                        (String) address.get("village"),
                        (String) address.get("county")
                );
                String country = firstNonBlank((String) address.get("country"), "Romania");
                if (city != null) {
                    return city + ", " + country;
                }
            }

            Object display = body.get("display_name");
            if (display instanceof String s && !s.isBlank()) {
                String[] parts = s.split(",");
                if (parts.length >= 2) {
                    return parts[0].trim() + ", " + parts[parts.length - 1].trim();
                }
                return s.trim();
            }
        } catch (RestClientException | ClassCastException ex) {
            log.debug("Reverse geocode unavailable: {}", ex.getMessage());
        }
        return null;
    }

    private static String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String v : values) {
            if (v != null && !v.isBlank()) return v.trim();
        }
        return null;
    }

    private static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        final double r = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * r * Math.asin(Math.sqrt(a));
    }

    private static final class City {
        final String name;
        final double lat;
        final double lon;
        final double distanceKm;

        City(String name, double lat, double lon) {
            this(name, lat, lon, Double.POSITIVE_INFINITY);
        }

        City(String name, double lat, double lon, double distanceKm) {
            this.name = name;
            this.lat = lat;
            this.lon = lon;
            this.distanceKm = distanceKm;
        }
    }
}
