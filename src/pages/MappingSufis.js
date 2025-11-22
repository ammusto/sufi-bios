import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Layout from '../components/Layout/Layout';
import Loading from '../components/common/Loading';
import './MappingSufis.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createNumberedIcon = (count, isRegion = false) => {
    const color = count === 1 ? '#2196F3' : count < 5 ? '#4CAF50' : count < 10 ? '#FF9800' : '#F44336';
    
    if (isRegion) {
        // Hexagon for regions
        const size = 35;
        return L.divIcon({
            className: 'custom-marker',
            html: `
          <div style="position: relative; width: ${size}px; height: ${size}px;">
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
              <polygon points="${size/2},2 ${size-3},${size*0.25} ${size-3},${size*0.75} ${size/2},${size-2} 3,${size*0.75} 3,${size*0.25}" 
                       fill="${color}" 
                       stroke="#fff" 
                       stroke-width="2"
                       opacity="0.85"/>
            </svg>
            <div style="
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 13px;
              font-weight: bold;
              pointer-events: none;
            ">${count}</div>
          </div>`,
            iconSize: [size, size],
            iconAnchor: [size/2, size/2],
            popupAnchor: [0, -size/2],
        });
    } else {
        // Standard pin for specific places
        return L.divIcon({
            className: 'custom-marker',
            html: `
          <div style="position: relative; width: 25px; height: 41px;">
            <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" 
                    fill="${color}" stroke="#fff" stroke-width="1.5"/>
            </svg>
            <div style="
              position: absolute;
              top: 6px;
              left: 0;
              right: 0;
              text-align: center;
              color: white;
              font-size: 12px;
              font-weight: bold;
              pointer-events: none;
            ">${count}</div>
          </div>`,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
        });
    }
};

const getSourceAbbrev = (source) => {
    if (!source) return '?';
    const s = source.toLowerCase();
    if (s === 'ansari') return 'A';
    if (s === 'hilya') return 'H';
    if (s === 'sulami') return 'S';
    return source.charAt(0).toUpperCase();
};

const PersonContextDisplay = ({ person }) => {
    return (
        <div className="map-popup-person">
            <strong>
                <Link
                    to={`/bio/${person.bioId}`}
                    className="person-link"
                    onClick={(e) => e.stopPropagation()}
                    target="_blank"
                >
                    {person.name}
                </Link>
            </strong>
            <div className="person-contexts">
                {person.contexts.map((ctx, idx) => (
                    <span key={idx} className="context-group">
                        {ctx.context}{' '}
                        {ctx.sources.map((src, sidx) => (
                            <React.Fragment key={sidx}>
                                <Link
                                    to={`/bio/${person.bioId}?tab=${src}`}
                                    className="source-link"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    [{getSourceAbbrev(src)}]
                                </Link>
                                {sidx < ctx.sources.length - 1 ? '' : ''}
                            </React.Fragment>
                        ))}
                        {idx < person.contexts.length - 1 && ', '}
                    </span>
                ))}
            </div>
        </div>
    );
};

const MappingSufis = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [locationData, setLocationData] = useState([]);
    const [routesData, setRoutesData] = useState([]);
    const [stats, setStats] = useState({ totalLocations: 0, totalPeople: 0, totalMentions: 0 });

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const XLSX = await import('xlsx');

                const biosResponse = await fetch('/data/bios.xlsx');
                if (!biosResponse.ok) throw new Error('Failed to load bios data');
                const biosArrayBuffer = await biosResponse.arrayBuffer();
                const biosWorkbook = XLSX.read(biosArrayBuffer, { type: 'array' });
                const biosSheet = biosWorkbook.Sheets[biosWorkbook.SheetNames[0]];
                const biosJson = XLSX.utils.sheet_to_json(biosSheet);

                const biosMap = {};
                biosJson.forEach(bio => {
                    biosMap[String(bio.bio_id)] = bio.name_lat || bio.name_ar || `Bio ${bio.bio_id}`;
                });

                const geoResponse = await fetch('/data/geographical_locations.xlsx');
                if (!geoResponse.ok) throw new Error('Failed to load geographical data');
                const geoArrayBuffer = await geoResponse.arrayBuffer();
                const geoWorkbook = XLSX.read(geoArrayBuffer, { type: 'array' });
                const geoSheet = geoWorkbook.Sheets[geoWorkbook.SheetNames[0]];
                const geoJson = XLSX.utils.sheet_to_json(geoSheet);

                const locationMap = new Map();
                let totalMentions = 0;

                // Normalize function to handle variants like الشام vs شام
                const normalizeLocationName = (name) => {
                    if (!name) return '';
                    return String(name).trim()
                        .replace(/^ال/, '')  // Remove ال
                        .replace(/^الـ/, '') // Remove الـ
                        .toLowerCase();
                };

                // Group by bio_id + canonical_name first to count unique individuals
                const bioLocationCombos = new Set();

                geoJson.forEach(row => {
                    const canonicalName = row.canonical_name;
                    const coords = row.coords;
                    const certain = String(row.certain || '').toLowerCase().trim();
                    
                    if (!canonicalName || String(canonicalName).trim() === '' ||
                        String(canonicalName).toLowerCase() === 'none') {
                        return;
                    }
                    if (!coords || String(coords).trim() === '' ||
                        String(coords).trim() === '?' || String(coords).trim().toLowerCase() === 'nan') {
                        return;
                    }

                    totalMentions++;
                    const bioId = String(row.bio_id);
                    const bioName = biosMap[bioId];
                    if (!bioName) return;

                    // Track unique bio + location combinations using normalized name
                    const normalizedName = normalizeLocationName(canonicalName);
                    const comboKey = `${bioId}|${normalizedName}`;
                    bioLocationCombos.add(comboKey);

                    const key = normalizedName;
                    if (!locationMap.has(key)) {
                        locationMap.set(key, {
                            canonical_name: canonicalName,
                            english_transliteration: row.english_transliteration || canonicalName,
                            coords: String(coords),
                            peopleData: new Map(),
                            allSources: new Set(),
                            isRegion: certain === 'r',
                        });
                    } else {
                        // Keep the longer/more complete canonical_name
                        const existing = locationMap.get(key);
                        if (canonicalName.length > existing.canonical_name.length) {
                            existing.canonical_name = canonicalName;
                        }
                        if (!existing.english_transliteration && row.english_transliteration) {
                            existing.english_transliteration = row.english_transliteration;
                        }
                        // If any entry is a region, mark the whole location as region
                        if (certain === 'r') {
                            existing.isRegion = true;
                        }
                    }

                    const entry = locationMap.get(key);
                    if (!entry.peopleData.has(bioId)) {
                        entry.peopleData.set(bioId, {
                            bioId: bioId,
                            bioName: bioName,
                            contextsMap: new Map(),
                        });
                    }

                    const personData = entry.peopleData.get(bioId);
                    const context = row.context || 'unknown';
                    const source = row.source;

                    if (!personData.contextsMap.has(context)) {
                        personData.contextsMap.set(context, new Set());
                    }
                    personData.contextsMap.get(context).add(source);

                    if (source) entry.allSources.add(source);
                });

                const locationsArray = Array.from(locationMap.values())
                    .map(loc => {
                        const [lat, lng] = loc.coords
                            .replace(/\u00A0/g, ' ')
                            .split(',')
                            .map(s => parseFloat(s.trim()));
                        if (isNaN(lat) || isNaN(lng)) return null;

                        const peopleArray = Array.from(loc.peopleData.entries())
                            .map(([bioId, personData]) => {
                                const contexts = Array.from(personData.contextsMap.entries())
                                    .sort(([a], [b]) => a.localeCompare(b))
                                    .map(([context, sourcesSet]) => ({
                                        context,
                                        sources: Array.from(sourcesSet).sort(),
                                    }));
                                return {
                                    name: personData.bioName,
                                    bioId: bioId,
                                    contexts,
                                };
                            })
                            .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

                        return {
                            canonical_name: loc.canonical_name,
                            english_transliteration: loc.english_transliteration,
                            lat,
                            lng,
                            people: peopleArray,
                            allSources: Array.from(loc.allSources).sort(),
                            isRegion: loc.isRegion || false,
                        };
                    })
                    .filter(Boolean);

                console.log('Locations with isRegion:', locationsArray.filter(l => l.isRegion).map(l => ({ name: l.canonical_name, isRegion: l.isRegion })));

                setLocationData(locationsArray);
                
                // Count unique individuals across all locations
                const uniquePeopleSet = new Set();
                locationsArray.forEach(loc => {
                    loc.people.forEach(p => uniquePeopleSet.add(p.bioId));
                });

                setStats({
                    totalLocations: locationsArray.length,
                    totalPeople: uniquePeopleSet.size,
                    totalMentions,
                });

                try {
                    const routeResp = await fetch('/data/sufi_routes.json');
                    if (routeResp.ok) {
                        const routeJson = await routeResp.json();
                        setRoutesData(routeJson.features || []);
                    }
                } catch (rerr) {
                    console.warn('Error loading sufi_routes.json:', rerr);
                }

            } catch (err) {
                console.error('Error loading mapping data:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const sortedLocationData = useMemo(() => {
        return [...locationData].sort((a, b) => a.people.length - b.people.length);
    }, [locationData]);

    if (loading) return <Layout><Loading /></Layout>;
    if (error) return <Layout><div className="error">Error: {error}</div></Layout>;

    const markers = sortedLocationData
        .map((location, idx) => ({
            ...location,
            count: location.people.length
        }));

    const center = markers.length > 0
        ? [
            markers.reduce((sum, m) => sum + m.lat, 0) / markers.length,
            markers.reduce((sum, m) => sum + m.lng, 0) / markers.length,
        ]
        : [30, 50];

    return (
        <Layout>
            <div className="container">
                <div className="header">
                    <h1>Mapping Sufis</h1>
                    <div className="stats mapping-stats">
                        <span className="mapping-stat-item">
                            <strong>{stats.totalLocations}</strong> unique locations
                        </span>
                        <span className="mapping-stat-item">
                            <strong>{stats.totalPeople}</strong> unique individuals
                        </span>
                        <span>
                            <strong>{stats.totalMentions}</strong> total location mentions
                        </span>
                    </div>
                </div>

                {locationData.length === 0 ? (
                    <div className="mapping-empty-state">
                        <p className="mapping-empty-state-title">No geographical data available yet.</p>
                        <p className="mapping-empty-state-subtitle">
                            Geography JSON files will appear after running the extraction script.
                        </p>
                    </div>
                ) : (
                    <div className="mapping-map-container">
                        <MapContainer center={center} zoom={4} style={{ height: '700px', width: '100%' }}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                            />

                            {routesData.map((feature, i) => (
                                <Polyline
                                    key={`route-${i}`}
                                    positions={feature.geometry.coordinates.map(([lon, lat]) => [lat, lon])}
                                    pathOptions={{ color: '#750000ff', weight: 2, opacity: 0.6 }}
                                />
                            ))}

                            {markers.map((location, idx) => (
                                <Marker
                                    key={idx}
                                    position={[location.lat, location.lng]}
                                    icon={createNumberedIcon(location.count, location.isRegion)}
                                    zIndexOffset={location.count * 1000}
                                >
                                    <Popup maxWidth={400} maxHeight={400}>
                                        <div className="map-popup">
                                            <div className="map-popup-title">
                                                {location.english_transliteration} - {location.canonical_name}
                                                {location.isRegion && (
                                                    <span style={{
                                                        fontSize: '11px',
                                                        background: '#e3f2fd',
                                                        color: '#1976d2',
                                                        padding: '2px 6px',
                                                        borderRadius: '3px',
                                                        fontWeight: '500',
                                                        marginLeft: '8px'
                                                    }}>
                                                        REGION
                                                    </span>
                                                )}
                                            </div>
                                            <div className="map-popup-people">
                                                <strong className="map-popup-people-header">
                                                    People associated with this location ({location.people.length}):
                                                </strong>
                                                <div className="map-popup-people-list">
                                                    {location.people.map((person, i) => (
                                                        <PersonContextDisplay key={i} person={person} />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </div>
                )}

                <div className="mapping-legend">
                    <h3>Legend</h3>
                    <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>Marker Shapes</h4>
                        <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="25" height="41" viewBox="0 0 25 41" style={{ display: 'block' }}>
                                    <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" 
                                          fill="#2196F3" stroke="#fff" strokeWidth="1.5"/>
                                </svg>
                                <span>Specific Place</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="35" height="35" viewBox="0 0 35 35" style={{ display: 'block' }}>
                                    <polygon points="17.5,2 32,8.75 32,26.25 17.5,33 3,26.25 3,8.75" 
                                             fill="#2196F3" 
                                             stroke="#fff" 
                                             strokeWidth="2"
                                             opacity="0.85"/>
                                </svg>
                                <span>Region</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>Number of People</h4>
                        <div className="mapping-legend-items">
                            <div className="mapping-legend-item">
                                <div className="mapping-legend-dot mapping-legend-dot-blue"></div><span>1 person</span>
                            </div>
                            <div className="mapping-legend-item">
                                <div className="mapping-legend-dot mapping-legend-dot-green"></div><span>2–4 people</span>
                            </div>
                            <div className="mapping-legend-item">
                                <div className="mapping-legend-dot mapping-legend-dot-orange"></div><span>5–9 people</span>
                            </div>
                            <div className="mapping-legend-item">
                                <div className="mapping-legend-dot mapping-legend-dot-red"></div><span>10+ people</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default MappingSufis;