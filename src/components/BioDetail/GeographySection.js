import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createLocationIcon = (isRegion = false) => {
    if (isRegion) {
        // Hexagon for regions
        const size = 35;
        return L.divIcon({
            className: 'custom-marker',
            html: `
          <div style="position: relative; width: ${size}px; height: ${size}px;">
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
              <polygon points="${size/2},2 ${size-3},${size*0.25} ${size-3},${size*0.75} ${size/2},${size-2} 3,${size*0.75} 3,${size*0.25}" 
                       fill="#2196F3" 
                       stroke="#fff" 
                       stroke-width="2"
                       opacity="0.85"/>
            </svg>
          </div>`,
            iconSize: [size, size],
            iconAnchor: [size/2, size/2],
            popupAnchor: [0, -size/2],
        });
    } else {
        // Standard Leaflet default marker for specific places
        return new L.Icon.Default();
    }
};

function shortestPath(graph, start, end) {
    if (!graph[start] || !graph[end]) return null;

    const dist = {};
    const prev = {};
    const visited = new Set();

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

                const response = await fetch('/data/geographical_locations.xlsx');
                if (!response.ok) {
                    setLoading(false);
                    return;
                }

                const arrayBuffer = await response.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const allData = XLSX.utils.sheet_to_json(sheet);

                const bioRows = allData
                    .filter((row) => String(row.bio_id) === String(bioId))
                    .filter((row) => {
                        const canonicalName = row.canonical_name;
                        return (
                            canonicalName &&
                            String(canonicalName).trim() !== '' &&
                            String(canonicalName).trim().toLowerCase() !== 'none'
                        );
                    });

                if (!bioRows.length) {
                    setLoading(false);
                    return;
                }

                // Normalize function to handle variants like الشام vs شام
                const normalizeLocationName = (name) => {
                    if (!name) return '';
                    // Remove common Arabic definite article variants at start
                    return String(name).trim()
                        .replace(/^ال/, '')  // Remove ال
                        .replace(/^الـ/, '') // Remove الـ
                        .toLowerCase();
                };

                // Group by normalized canonical_name to deduplicate
                const locationGroups = new Map();
                
                bioRows.forEach((row) => {
                    const normalizedKey = normalizeLocationName(row.canonical_name);
                    const key = normalizedKey;
                    const rawCoords = String(row.coords || '').trim();
                    const hasCoords =
                        rawCoords &&
                        rawCoords !== '?' &&
                        rawCoords.toLowerCase() !== 'nan' &&
                        rawCoords !== '';
                    const certain = String(row.certain || '').toLowerCase().trim();

                    if (!locationGroups.has(key)) {
                        locationGroups.set(key, {
                            canonical_name: row.canonical_name,
                            english_transliteration: row.english_transliteration || row.canonical_name,
                            coords: rawCoords,
                            has_coords: hasCoords,
                            URI: String(row.URI || '').trim(),
                            isRegion: certain === 'r',
                            mentions: []
                        });
                    } else {
                        // Keep the longer/more complete canonical_name (likely has ال prefix)
                        const existing = locationGroups.get(key);
                        if (row.canonical_name.length > existing.canonical_name.length) {
                            existing.canonical_name = row.canonical_name;
                        }
                        // Keep first non-empty english transliteration
                        if (!existing.english_transliteration && row.english_transliteration) {
                            existing.english_transliteration = row.english_transliteration;
                        }
                        // Keep first valid coords
                        if (!existing.has_coords && hasCoords) {
                            existing.coords = rawCoords;
                            existing.has_coords = hasCoords;
                        }
                        // Keep first non-empty URI
                        if (!existing.URI && row.URI) {
                            existing.URI = String(row.URI).trim();
                        }
                        // If any entry is a region, mark as region
                        if (certain === 'r') {
                            existing.isRegion = true;
                        }
                    }

                    locationGroups.get(key).mentions.push({
                        source: row.source,
                        context: row.context || 'unknown'
                    });
                });

                // Convert to deduplicated array with grouped contexts
                const bioLocations = Array.from(locationGroups.values()).map(loc => {
                    const contextGroups = new Map();
                    loc.mentions.forEach(m => {
                        if (!contextGroups.has(m.context)) {
                            contextGroups.set(m.context, []);
                        }
                        if (!contextGroups.get(m.context).includes(m.source)) {
                            contextGroups.get(m.context).push(m.source);
                        }
                    });

                    return {
                        ...loc,
                        contextGroups: Array.from(contextGroups.entries())
                            .map(([context, sources]) => ({
                                context,
                                sources: sources.sort()
                            }))
                            .sort((a, b) => a.context.localeCompare(b.context))
                    };
                });

                const geoObj = {
                    bio_id: bioId,
                    locations: bioLocations,
                };

                // Load routes
                const routesResp = await fetch('/data/sufi_routes.json');
                if (!routesResp.ok) {
                    setGeoData(geoObj);
                    setRouteData([]);
                    return;
                }

                const routesJson = await routesResp.json();
                const features = Array.isArray(routesJson.features) ? routesJson.features : [];

                // Build graph
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

                const bioUris = geoObj.locations
                    .map((l) => l.URI)
                    .filter((u) => u && u.toLowerCase() !== 'nan' && u.toLowerCase() !== 'none' && graph[u]);

                const usedEdges = new Set();

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
                                const key1 = a + '→' + b;
                                const key2 = b + '→' + a;
                                usedEdges.add(key1);
                                usedEdges.add(key2);
                            }
                        }
                    }
                }

                const relevantRoutes = usedEdges.size === 0
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

    const center = markers.length > 0
        ? [
            markers.reduce((sum, m) => sum + m.lat, 0) / markers.length,
            markers.reduce((sum, m) => sum + m.lng, 0) / markers.length,
        ]
        : [30, 50];

    return (
        <div style={{ marginBottom: '30px' }}>
            <h2>Geographical Locations</h2>

            {markers.length > 0 && (
                <div style={{
                    marginBottom: '20px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    overflow: 'hidden',
                }}>
                    <MapContainer
                        center={center}
                        zoom={markers.length === 1 ? 8 : 5}
                        style={{ height: '500px', width: '100%' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        />

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
                            <Marker 
                                key={marker.id} 
                                position={[marker.lat, marker.lng]}
                                icon={createLocationIcon(marker.isRegion)}
                            >
                                <Popup>
                                    <div style={{ minWidth: '200px' }}>
                                        <strong style={{
                                            fontSize: '15px',
                                            display: 'block',
                                            marginBottom: '5px',
                                        }}>
                                            {marker.english_transliteration}
                                            {marker.isRegion && (
                                                <span style={{
                                                    fontSize: '10px',
                                                    background: '#e3f2fd',
                                                    color: '#1976d2',
                                                    padding: '2px 6px',
                                                    borderRadius: '3px',
                                                    fontWeight: '500',
                                                    marginLeft: '6px'
                                                }}>
                                                    REGION
                                                </span>
                                            )}
                                        </strong>
                                        <div style={{
                                            fontSize: '14px',
                                            marginBottom: '8px',
                                            color: '#666',
                                        }}>
                                            {marker.canonical_name}
                                        </div>
                                        <div style={{
                                            fontSize: '13px',
                                            padding: '8px',
                                            background: '#f0f0f0',
                                            borderRadius: '3px',
                                        }}>
                                            {marker.contextGroups.map((cg, i) => (
                                                <div key={i} style={{ marginBottom: i < marker.contextGroups.length - 1 ? '4px' : '0' }}>
                                                    <strong>{cg.context}:</strong> {cg.sources.join(', ')}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
            )}

            {/* Deduplicated list */}
            <div style={{
                background: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                padding: '20px',
            }}>
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
                                border: `1px solid ${loc.has_coords ? '#e0e0e0' : '#ffc107'}`,
                                borderRadius: '4px',
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'start',
                            }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        marginBottom: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        {loc.english_transliteration}
                                        {loc.isRegion && (
                                            <span style={{
                                                fontSize: '11px',
                                                background: '#e3f2fd',
                                                color: '#1976d2',
                                                padding: '2px 6px',
                                                borderRadius: '3px',
                                                fontWeight: '500'
                                            }}>
                                                REGION
                                            </span>
                                        )}
                                    </div>
                                    <div style={{
                                        fontSize: '14px',
                                        color: '#666',
                                        marginBottom: '8px',
                                    }}>
                                        {loc.canonical_name}
                                    </div>
                                    <div style={{ fontSize: '13px' }}>
                                        {loc.contextGroups.map((cg, cgIdx) => (
                                            <div key={cgIdx} style={{ marginBottom: '4px' }}>
                                                <span style={{
                                                    background: '#e3f2fd',
                                                    padding: '2px 8px',
                                                    borderRadius: '3px',
                                                    marginRight: '8px',
                                                    fontWeight: '500'
                                                }}>
                                                    {cg.context}
                                                </span>
                                                <span style={{ color: '#666' }}>
                                                    {cg.sources.map((src, srcIdx) => (
                                                        <span key={srcIdx}>
                                                            {src}
                                                            {srcIdx < cg.sources.length - 1 ? ', ' : ''}
                                                        </span>
                                                    ))}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {!loc.has_coords && (
                                    <div style={{
                                        fontSize: '12px',
                                        color: '#856404',
                                        background: '#fff3cd',
                                        padding: '4px 8px',
                                        borderRadius: '3px',
                                        fontWeight: '600',
                                    }}>
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