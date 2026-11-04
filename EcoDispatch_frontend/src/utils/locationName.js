const FALLBACK = 'Localitatea mea';

const CITIES = [
    {name: 'Sibiu', lat: 45.7983, lon: 24.1256},
    {name: 'Cluj-Napoca', lat: 46.7712, lon: 23.6236},
    {name: 'Bucharest', lat: 44.4268, lon: 26.1025},
    {name: 'Timișoara', lat: 45.7489, lon: 21.2087},
    {name: 'Iași', lat: 47.1585, lon: 27.6014},
    {name: 'Brașov', lat: 45.6579, lon: 25.6012},
    {name: 'Constanța', lat: 44.1598, lon: 28.6348},
    {name: 'Oradea', lat: 47.0465, lon: 21.9189},
    {name: 'Craiova', lat: 44.3302, lon: 23.7949},
    {name: 'Galați', lat: 45.4353, lon: 28.008},
    {name: 'Ploiești', lat: 44.9462, lon: 26.0365},
    {name: 'Arad', lat: 46.1866, lon: 21.3123},
    {name: 'Pitești', lat: 44.8565, lon: 24.8692},
    {name: 'Bacău', lat: 46.567, lon: 26.914},
    {name: 'Târgu Mureș', lat: 46.5425, lon: 24.5575}
];

const CITY_MATCH_KM = 45;

function haversineKm(lat1, lon1, lat2, lon2) {
    const r = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    return 2 * r * Math.asin(Math.sqrt(a));
}

/** Instant offline resolve from curated Romanian cities. */
export function resolveLocationNameLocal(lat, lon) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
        return FALLBACK;
    }
    let best = null;
    for (const city of CITIES) {
        const d = haversineKm(Number(lat), Number(lon), city.lat, city.lon);
        if (!best || d < best.d) best = {name: city.name, d};
    }
    if (best && best.d <= CITY_MATCH_KM) {
        return `${best.name}, Romania`;
    }
    return best ? `${best.name}, Romania` : FALLBACK;
}

/**
 * Prefer backend `locationName`; otherwise use local city match.
 * Async Nominatim enrichment is optional for out-of-catalogue points.
 */
export async function resolveLocationName(lat, lon, preferredName) {
    if (preferredName && String(preferredName).trim()) {
        return String(preferredName).trim();
    }
    const local = resolveLocationNameLocal(lat, lon);
    if (local !== FALLBACK && local.includes(',')) {
        // Within catalogue radius — good enough for dashboard
        const nearest = CITIES
            .map((c) => ({...c, d: haversineKm(Number(lat), Number(lon), c.lat, c.lon)}))
            .sort((a, b) => a.d - b.d)[0];
        if (nearest && nearest.d <= CITY_MATCH_KM) {
            return local;
        }
    }

    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
        return FALLBACK;
    }

    try {
        const url = new URL('https://nominatim.openstreetmap.org/reverse');
        url.searchParams.set('format', 'json');
        url.searchParams.set('lat', String(lat));
        url.searchParams.set('lon', String(lon));
        url.searchParams.set('zoom', '10');
        url.searchParams.set('addressdetails', '1');

        const res = await fetch(url.toString(), {
            headers: {Accept: 'application/json', 'Accept-Language': 'en'}
        });
        if (!res.ok) return local;
        const data = await res.json();
        const address = data?.address || {};
        const city =
            address.city ||
            address.town ||
            address.municipality ||
            address.village ||
            address.county;
        const country = address.country || 'Romania';
        if (city) return `${city}, ${country}`;
        if (data?.display_name) {
            const parts = String(data.display_name).split(',');
            if (parts.length >= 2) {
                return `${parts[0].trim()}, ${parts[parts.length - 1].trim()}`;
            }
        }
    } catch {
        // keep local fallback
    }
    return local || FALLBACK;
}

export const LOCATION_FALLBACK = FALLBACK;
