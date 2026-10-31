import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useTheme } from '../theme/ThemeContext.jsx';

const SIBIU = [45.7983, 24.1256];

const pinIcon = L.divIcon({
    className: 'wattwise-map-pin',
    html: `<div class="wattwise-pin-dot" style="
        width:18px;height:18px;border-radius:9999px;
        background:linear-gradient(135deg,#34d399,#0d9488);
        border:2px solid #ecfdf5;
        box-shadow:0 0 0 4px rgba(16,185,129,0.35),0 8px 16px rgba(2,6,23,0.55);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
});

function LocationMarker({ position, onPick }) {
    useMapEvents({
        click(e) {
            onPick([e.latlng.lat, e.latlng.lng]);
        }
    });

    if (!position) return null;
    return <Marker position={position} icon={pinIcon} />;
}

function MapSizeFix({ position }) {
    const map = useMap();

    useEffect(() => {
        const timer = setTimeout(() => {
            map.invalidateSize();
            if (position) {
                map.setView(position, map.getZoom(), { animate: false });
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [map, position]);

    return null;
}

export default function LocationPicker({
    onLocationSelect,
    initialLatitude = SIBIU[0],
    initialLongitude = SIBIU[1],
    label = 'Click the map to set your home location'
}) {
    const { isDark } = useTheme();
    const initial = [
        Number.isFinite(Number(initialLatitude)) ? Number(initialLatitude) : SIBIU[0],
        Number.isFinite(Number(initialLongitude)) ? Number(initialLongitude) : SIBIU[1]
    ];
    const [position, setPosition] = useState(initial);

    useEffect(() => {
        onLocationSelect?.({ latitude: initial[0], longitude: initial[1] });
        // Seed parent once on mount with defaults / props
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePositionChange = (newPos) => {
        setPosition(newPos);
        onLocationSelect?.({ latitude: newPos[0], longitude: newPos[1] });
    };

    const resetToSibiu = () => {
        handlePositionChange([...SIBIU]);
    };

    return (
        <div className="mb-4 space-y-3">
            {/* Scoped map theme — tiles only; marker pane stays unfiltered */}
            <style>{`
                .map-tiles-dark .leaflet-tile-container img {
                    filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7) !important;
                }
                .map-tiles-light .leaflet-tile-container img {
                    filter: none !important;
                }
                .wattwise-map-pin,
                .wattwise-map-pin .wattwise-pin-dot {
                    filter: none !important;
                }
            `}</style>

            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        {label}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                        Lat {position[0].toFixed(4)} · Lon {position[1].toFixed(4)}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={resetToSibiu}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                    Reset to Sibiu
                </button>
            </div>

            <div
                className={`overflow-hidden rounded-2xl border border-slate-200 shadow-sm transition-all duration-300 dark:border-slate-800 dark:shadow-lg dark:shadow-slate-950/40 ${
                    isDark ? 'map-tiles-dark' : 'map-tiles-light'
                }`}
            >
                <div className="h-[240px] w-full sm:h-[280px]">
                    <MapContainer
                        center={position}
                        zoom={12}
                        scrollWheelZoom
                        className="h-full w-full"
                    >
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        <MapSizeFix position={position} />
                        <LocationMarker position={position} onPick={handlePositionChange} />
                    </MapContainer>
                </div>
            </div>
        </div>
    );
}
