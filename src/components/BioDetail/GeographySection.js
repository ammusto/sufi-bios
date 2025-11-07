import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Dijkstra over full graph
function shortestPath(graph, start, end) {
    if (!graph[start] || !graph[end]) return null;

    const dist = {};
    const prev = {};
    const visited = new Set();

    // init
    Object.keys(graph).forEach((n) => {
        dist[n] = Infinity;
    });
    dist[start] = 0;

    while (true) {
        let u = null;
        let best = Infinity;

        for (const n in dist) {
            if (!visited.has(n) && dist[n] < best) {
                best = dist[n];
                u = n;
            }
        }

        if (u === null || best === Infinity) break;
        visited.add(u);
        if (u === end) break;

        const neighbors = graph[u] || [];
        for (let i = 0; i < neighbors.length; i++) {
            const v = neighbors[i].node;
            const w = neighbors[i].weight;
            const alt = dist[u] + w;
            if (alt < dist[v]) {
                dist[v] = alt;
                prev[v] = u;
            }
        }
    }

    if (start !== end && !prev[end]) return null;

    const path = [end];
    let cur = end;
    while (cur !== start) {
        cur = prev[cur];
        if (!cur) return null;
        path.unshift(cur);
    }
    return path;
}

const GeographySection = ({ bioId, bioName }) => {
    const [geoData, setGeoData] = useState(null);
    const [routeData, setRouteData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadGeoData = async () => {
            try {
                const XLSX = await import('xlsx');

                // Load geographical_locations.xlsx
                const response = await fetch('/data/geographical_locations.xlsx');
                if (!response.ok) {
                    setLoading(false);
                    return;
                }

                const arrayBuffer = await response.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const allData = XLSX.utils.sheet_to_json(sheet);

                // Filter rows for this bio
                const bioLocations = allData
                    .filter((row) => String(row.bio_id) === String(bioId))
                    .filter((row) => {
                        const canonicalName = row.canonical_name;
                        return (
                            canonicalName &&
                            String(canonicalName).trim() !== '' &&
                            String(canonicalName).trim().toLowerCase() !== 'none'
                        );
                    })
                    .map((row) => {
                        const rawCoords = String(row.coords || '').trim();
                        const hasCoords =
                            rawCoords &&
                            rawCoords !== '?' &&
                            rawCoords.toLowerCase() !== 'nan' &&
                            rawCoords !== '';

                        return {
                            source: row.source,
                            context: row.context || 'unknown',
                            canonical_name: row.canonical_name,
                            english_transliteration:
                                row.english_transliteration || row.canonical_name,
                            coords: rawCoords,
                            has_coords: hasCoords,
                            URI: String(row.URI || '').trim(),
                        };
                    });

                if (!bioLocations.length) {
                    setLoading(false);
                    return;
                }

                const geoObj = {
                    bio_id: bioId,
                    locations: bioLocations,
                };

                // Load sufi_routes.json
                const routesResp = await fetch('/data/sufi_routes.json');
                if (!routesResp.ok) {
                    console.warn('sufi_routes.json not found or not accessible');
                    setGeoData(geoObj);
                    setRouteData([]);
                    return;
                }

                const routesJson = await routesResp.json();
                const features = Array.isArray(routesJson.features)
                    ? routesJson.features
                    : [];

                // Build adjacency graph from ALL sufi_routes edges
                const graph = {};
                for (let i = 0; i < features.length; i++) {
                    const f = features[i];
                    const props = f.properties || {};
                    const s = props.sToponym;
                    const e = props.eToponym;
                    if (!s || !e) continue;
                    const w = typeof props.Meter === 'number' ? props.Meter : 1;

                    if (!graph[s]) graph[s] = [];
                    if (!graph[e]) graph[e] = [];

                    graph[s].push({ node: e, weight: w });
                    graph[e].push({ node: s, weight: w });
                }

                // Collect this bio's URIs
                const bioUris = geoObj.locations
                    .map((l) => l.URI)
                    .filter(
                        (u) =>
                            u &&
                            u.toLowerCase() !== 'nan' &&
                            u.toLowerCase() !== 'none' &&
                            graph[u]
                    );

                const usedEdges = new Set();

                // If multiple URIs: compute shortest paths between all pairs
                if (bioUris.length > 1 && Object.keys(graph).length > 0) {
                    for (let i = 0; i < bioUris.length; i++) {
                        for (let j = i + 1; j < bioUris.length; j++) {
                            const start = bioUris[i];
                            const end = bioUris[j];
                            const path = shortestPath(graph, start, end);
                            if (!path || path.length < 2) continue;

                            for (let k = 0; k < path.length - 1; k++) {
                                const a = path[k];
                                const b = path[k + 1];
                                // undirected key
                                const key1 = a + '→' + b;
                                const key2 = b + '→' + a;
                                usedEdges.add(key1);
                                usedEdges.add(key2);
                            }
                        }
                    }
                }

                // Filter route features actually used in those paths
                const relevantRoutes =
                    usedEdges.size === 0
                        ? []
                        : features.filter((f) => {
                            const props = f.properties || {};
                            const s = props.sToponym;
                            const e = props.eToponym;
                            if (!s || !e) return false;
                            const k1 = s + '→' + e;
                            const k2 = e + '→' + s;
                            return usedEdges.has(k1) || usedEdges.has(k2);
                        });

                console.log(
                    `Bio ${bioId}: locations=${bioLocations.length}, URIs=${bioUris.length}, routes=${relevantRoutes.length}`
                );

                setGeoData(geoObj);
                setRouteData(relevantRoutes);
            } catch (err) {
                console.log(`Error loading geography data for bio ${bioId}:`, err);
            } finally {
                setLoading(false);
            }
        };

        loadGeoData();
    }, [bioId]);

    if (loading) return null;
    if (!geoData || geoData.locations.length === 0) return null;

    const mappableLocations = geoData.locations.filter((loc) => loc.has_coords);

    const markers = mappableLocations
        .map((loc, idx) => {
            const parts = loc.coords.replace(/\u00A0/g, ' ').split(',');
            const lat = parseFloat(parts[0]?.trim());
            const lng = parseFloat(parts[1]?.trim());
            if (isNaN(lat) || isNaN(lng)) return null;
            return { id: idx, lat, lng, ...loc };
        })
        .filter(Boolean);

    const center =
        markers.length > 0
            ? [
                markers.reduce((sum, m) => sum + m.lat, 0) / markers.length,
                markers.reduce((sum, m) => sum + m.lng, 0) / markers.length,
            ]
            : [30, 50];

    return (
        <div style={{ marginBottom: '30px' }}>
            <h2>Geographical Locations</h2>

            {markers.length > 0 && (
                <div
                    style={{
                        marginBottom: '20px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '4px',
                        overflow: 'hidden',
                    }}
                >
                    <MapContainer
                        center={center}
                        zoom={markers.length === 1 ? 8 : 5}
                        style={{ height: '500px', width: '100%' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        />

                        {/* Draw only segments used in shortest paths between this bio's URIs */}
                        {routeData.map((route, i) => {
                            const coords = route.geometry?.coordinates || [];
                            if (!coords.length) return null;
                            return (
                                <Polyline
                                    key={`route-${i}`}
                                    positions={coords.map(([lon, lat]) => [lat, lon])}
                                    pathOptions={{ color: '#750000ff', weight: 2.5, opacity: 0.8 }}
                                />
                            );
                        })}

                        {markers.map((marker) => (
                            <Marker key={marker.id} position={[marker.lat, marker.lng]}>
                                <Popup>
                                    <div style={{ minWidth: '200px' }}>
                                        <strong
                                            style={{
                                                fontSize: '15px',
                                                display: 'block',
                                                marginBottom: '5px',
                                            }}
                                        >
                                            {marker.english_transliteration}
                                        </strong>
                                        <div
                                            style={{
                                                fontSize: '14px',
                                                marginBottom: '5px',
                                                color: '#666',
                                            }}
                                        >
                                            {marker.canonical_name}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: '13px',
                                                padding: '4px 8px',
                                                background: '#f0f0f0',
                                                borderRadius: '3px',
                                                marginTop: '8px',
                                            }}
                                        >
                                            <strong>Context:</strong> {marker.context}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: '12px',
                                                color: '#999',
                                                marginTop: '5px',
                                            }}
                                        >
                                            Source: {marker.source}
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
            )}

            {/* List of all locations */}
            <div
                style={{
                    background: 'white',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    padding: '20px',
                }}
            >
                <h3 style={{ fontSize: '18px', marginBottom: '15px' }}>
                    All Location Mentions ({geoData.locations.length})
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {geoData.locations.map((loc, idx) => (
                        <div
                            key={idx}
                            style={{
                                padding: '12px',
                                background: loc.has_coords ? '#f9f9f9' : '#fff3cd',
                                border: `1px solid ${loc.has_coords ? '#e0e0e0' : '#ffc107'
                                    }`,
                                borderRadius: '4px',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'start',
                                }}
                            >
                                <div style={{ flex: 1 }}>
                                    <div
                                        style={{
                                            fontSize: '15px',
                                            fontWeight: '600',
                                            marginBottom: '4px',
                                        }}
                                    >
                                        {loc.english_transliteration}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: '14px',
                                            color: '#666',
                                            marginBottom: '6px',
                                        }}
                                    >
                                        {loc.canonical_name}
                                    </div>
                                    <div style={{ fontSize: '13px' }}>
                                        <span
                                            style={{
                                                background: '#e3f2fd',
                                                padding: '2px 8px',
                                                borderRadius: '3px',
                                                marginRight: '8px',
                                            }}
                                        >
                                            {loc.context}
                                        </span>
                                        <span style={{ color: '#999' }}>
                                            Source: {loc.source}
                                        </span>
                                    </div>
                                </div>
                                {!loc.has_coords && (
                                    <div
                                        style={{
                                            fontSize: '12px',
                                            color: '#856404',
                                            background: '#fff3cd',
                                            padding: '4px 8px',
                                            borderRadius: '3px',
                                            fontWeight: '600',
                                        }}
                                    >
                                        Coordinates unknown
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GeographySection;
