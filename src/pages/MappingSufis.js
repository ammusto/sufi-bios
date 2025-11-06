import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Layout from '../components/Layout/Layout';
import Loading from '../components/common/Loading';
import './MappingSufis.css';

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker with number badge
const createNumberedIcon = (count) => {
    const color = count === 1 ? '#2196F3' : count < 5 ? '#4CAF50' : count < 10 ? '#FF9800' : '#F44336';

    return L.divIcon({
        className: 'custom-marker',
        html: `
      <div style="
        position: relative;
        width: 25px;
        height: 41px;
      ">
        <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" 
                fill="${color}" 
                stroke="#fff" 
                stroke-width="1.5"/>
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
      </div>
    `,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
    });
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

                >{person.name}
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
    // const [biosData, setBiosData] = useState({});
    const [stats, setStats] = useState({ totalLocations: 0, totalPeople: 0, totalMentions: 0 });

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);

                const XLSX = await import('xlsx');

                // Load bios.xlsx for name_lat lookups
                const biosResponse = await fetch('/data/bios.xlsx');
                if (!biosResponse.ok) throw new Error('Failed to load bios data');

                const biosArrayBuffer = await biosResponse.arrayBuffer();
                const biosWorkbook = XLSX.read(biosArrayBuffer, { type: 'array' });
                const biosSheet = biosWorkbook.Sheets[biosWorkbook.SheetNames[0]];
                const biosJson = XLSX.utils.sheet_to_json(biosSheet);

                // Create bio_id -> name_lat lookup
                const biosMap = {};
                biosJson.forEach(bio => {
                    biosMap[String(bio.bio_id)] = bio.name_lat || bio.name_ar || `Bio ${bio.bio_id}`;
                });

                // Load geographical_locations.xlsx directly
                const geoResponse = await fetch('/data/geographical_locations.xlsx');
                if (!geoResponse.ok) throw new Error('Failed to load geographical data');

                const geoArrayBuffer = await geoResponse.arrayBuffer();
                const geoWorkbook = XLSX.read(geoArrayBuffer, { type: 'array' });
                const geoSheet = geoWorkbook.Sheets[geoWorkbook.SheetNames[0]];
                const geoJson = XLSX.utils.sheet_to_json(geoSheet);

                // Aggregate by canonical_name
                const locationMap = new Map();
                let totalMentions = 0;

                geoJson.forEach(row => {
                    const canonicalName = row.canonical_name;
                    const coords = row.coords;

                    // Skip if canonical_name is None/empty or coords missing/invalid
                    if (!canonicalName || String(canonicalName).trim() === '' ||
                        String(canonicalName).toLowerCase() === 'none') {
                        return;
                    }

                    if (!coords || String(coords).trim() === '' ||
                        String(coords).trim() === '?' || String(coords).trim() === 'nan') {
                        return;
                    }

                    totalMentions++;

                    const bioId = String(row.bio_id);
                    const bioName = biosMap[bioId];
                    if (!bioName) return;

                    const key = canonicalName;

                    if (!locationMap.has(key)) {
                        locationMap.set(key, {
                            canonical_name: canonicalName,
                            english_transliteration: row.english_transliteration || canonicalName,
                            coords: String(coords),
                            peopleData: new Map(),
                            allSources: new Set(),
                        });
                    }

                    const entry = locationMap.get(key);

                    // Track per-person, per-context data with sources
                    if (!entry.peopleData.has(bioName)) {
                        entry.peopleData.set(bioName, {
                            bioId: bioId,
                            contextsMap: new Map() // Map of context -> Set of sources
                        });
                    }

                    const personData = entry.peopleData.get(bioName);
                    const context = row.context || 'unknown';
                    const source = row.source;

                    if (!personData.contextsMap.has(context)) {
                        personData.contextsMap.set(context, new Set());
                    }
                    personData.contextsMap.get(context).add(source);

                    if (source) {
                        entry.allSources.add(source);
                    }
                });

                // Convert to array and parse coordinates
                const locationsArray = Array.from(locationMap.values()).map(loc => {
                    const [lat, lng] = loc.coords.split(',').map(s => parseFloat(s.trim()));

                    // Convert peopleData Map to sorted array with consolidated contexts
                    const peopleArray = Array.from(loc.peopleData.entries())
                        .map(([name, personData]) => {
                            // Group sources by context: [{context: "died", sources: ["sulami", "ansari"]}]
                            const contexts = Array.from(personData.contextsMap.entries())
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([context, sourcesSet]) => ({
                                    context,
                                    sources: Array.from(sourcesSet).sort()
                                }));

                            return {
                                name,
                                bioId: personData.bioId,
                                contexts
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
                    };
                }).filter(loc => !isNaN(loc.lat) && !isNaN(loc.lng));

                setLocationData(locationsArray);
                setStats({
                    totalLocations: locationsArray.length,
                    totalPeople: new Set(locationsArray.flatMap(l => l.people.map(p => p.name))).size,
                    totalMentions: totalMentions
                });

            } catch (err) {
                console.error('Error loading mapping data:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    if (loading) return <Layout><Loading /></Layout>;
    if (error) return <Layout><div className="error">Error: {error}</div></Layout>;

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
                            <strong>{stats.totalPeople}</strong> people
                        </span>
                        <span>
                            <strong>{stats.totalMentions}</strong> total location mentions
                        </span>
                    </div>
                </div>

                {locationData.length === 0 ? (
                    <div className="mapping-empty-state">
                        <p className="mapping-empty-state-title">
                            No geographical data available yet.
                        </p>
                        <p className="mapping-empty-state-subtitle">
                            Geography JSON files will appear after running the extraction script.
                        </p>
                    </div>
                ) : (
                    <div className="mapping-map-container">
                        <MapContainer
                            center={[30, 50]}
                            zoom={4}
                            style={{ height: '700px', width: '100%' }}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                            />

                            {locationData.map((location, idx) => (
                                <Marker
                                    key={idx}
                                    position={[location.lat, location.lng]}
                                    icon={createNumberedIcon(location.people.length)}
                                >
                                    <Popup maxWidth={400} maxHeight={400}>
                                        <div className="map-popup">
                                            <div className="map-popup-title">
                                                {location.english_transliteration} - {location.canonical_name}
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
                    <div className="mapping-legend-items">
                        <div className="mapping-legend-item">
                            <div className="mapping-legend-dot mapping-legend-dot-blue"></div>
                            <span>1 person</span>
                        </div>
                        <div className="mapping-legend-item">
                            <div className="mapping-legend-dot mapping-legend-dot-green"></div>
                            <span>2-4 people</span>
                        </div>
                        <div className="mapping-legend-item">
                            <div className="mapping-legend-dot mapping-legend-dot-orange"></div>
                            <span>5-9 people</span>
                        </div>
                        <div className="mapping-legend-item">
                            <div className="mapping-legend-dot mapping-legend-dot-red"></div>
                            <span>10+ people</span>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default MappingSufis;