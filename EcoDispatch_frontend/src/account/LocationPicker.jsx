import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import markerIconPng from 'leaflet/dist/images/marker-icon.png';
import markerShadowPng from 'leaflet/dist/images/marker-shadow.png';

const customIcon = L.icon({
    iconUrl: markerIconPng,
    shadowUrl: markerShadowPng,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

function LocationMarker({ position, setPosition }) {
    useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
        },
    });

    return position === null ? null : (
        <Marker position={position} icon={customIcon} />
    );
}

export default function LocationPicker({ onLocationSelect }) {
    const [position, setPosition] = useState([45.7925, 24.1520]);

    const handlePositionChange = (newPos) => {
        setPosition(newPos);
        onLocationSelect({ latitude: newPos[0], longitude: newPos[1] });
    };

    return (
        <div style={{ height: '220px', width: '100%', marginBottom: '15px' }}>
            <p style={{ fontSize: '13px', color: '#555', marginBottom: '5px' }}>
                Click on the map to choose your consumption location:
            </p>
            <MapContainer
                center={position}
                zoom={12}
                style={{ height: '100%', width: '100%', borderRadius: '8px' }}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                />
                <LocationMarker
                    position={position}
                    setPosition={handlePositionChange}
                />
            </MapContainer>
        </div>
    );
}