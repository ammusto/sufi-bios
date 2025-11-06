import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const GeographySection = ({ bioId, bioName }) => {
  const [geoData, setGeoData] = useState(null);
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
        
        // Filter for this bio_id
        const bioLocations = allData
          .filter(row => String(row.bio_id) === String(bioId))
          .filter(row => {
            const canonicalName = row.canonical_name;
            // Skip None/empty canonical names
            if (!canonicalName || String(canonicalName).trim() === '' ||
                String(canonicalName).toLowerCase() === 'none') {
              return false;
            }
            return true;
          })
          .map(row => {
            const coords = String(row.coords || '').trim();
            const hasCoords = coords && coords !== '?' && coords !== 'nan' && coords !== '';
            
            return {
              source: row.source,
              context: row.context || 'unknown',
              canonical_name: row.canonical_name,
              english_transliteration: row.english_transliteration || row.canonical_name,
              coords: coords,
              has_coords: hasCoords
            };
          });
        
        if (bioLocations.length > 0) {
          setGeoData({
            bio_id: bioId,
            locations: bioLocations
          });
        }
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

  const mappableLocations = geoData.locations.filter(loc => loc.has_coords);
  const unmappableLocations = geoData.locations.filter(loc => !loc.has_coords);

  // Parse coordinates and prepare markers
  const markers = mappableLocations.map((loc, idx) => {
    const [lat, lng] = loc.coords.split(',').map(s => parseFloat(s.trim()));
    return {
      id: idx,
      lat,
      lng,
      ...loc
    };
  }).filter(m => !isNaN(m.lat) && !isNaN(m.lng));

  // Calculate map center (average of all coordinates)
  const center = markers.length > 0
    ? [
        markers.reduce((sum, m) => sum + m.lat, 0) / markers.length,
        markers.reduce((sum, m) => sum + m.lng, 0) / markers.length
      ]
    : [30, 50]; // Default to Middle East

  return (
    <div style={{ marginBottom: '30px' }}>
      <h2>Geographical Locations</h2>

      {markers.length > 0 && (
        <div style={{ 
          marginBottom: '20px',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <MapContainer
            center={center}
            zoom={markers.length === 1 ? 8 : 5}
            style={{ height: '500px', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {markers.map((marker) => (
              <Marker key={marker.id} position={[marker.lat, marker.lng]}>
                <Popup>
                  <div style={{ minWidth: '200px' }}>
                    <strong style={{ fontSize: '15px', display: 'block', marginBottom: '5px' }}>
                      {marker.english_transliteration}
                    </strong>
                    <div style={{ fontSize: '14px', marginBottom: '5px', color: '#666' }}>
                      {marker.canonical_name}
                    </div>
                    <div style={{ 
                      fontSize: '13px', 
                      padding: '4px 8px',
                      background: '#f0f0f0',
                      borderRadius: '3px',
                      marginTop: '8px'
                    }}>
                      <strong>Context:</strong> {marker.context}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
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
      <div style={{ 
        background: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        padding: '20px'
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
                borderRadius: '4px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>
                    {loc.english_transliteration}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '6px' }}>
                    {loc.canonical_name}
                  </div>
                  <div style={{ fontSize: '13px' }}>
                    <span style={{ 
                      background: '#e3f2fd',
                      padding: '2px 8px',
                      borderRadius: '3px',
                      marginRight: '8px'
                    }}>
                      {loc.context}
                    </span>
                    <span style={{ color: '#999' }}>
                      Source: {loc.source}
                    </span>
                  </div>
                </div>
                {!loc.has_coords && (
                  <div style={{
                    fontSize: '12px',
                    color: '#856404',
                    background: '#fff3cd',
                    padding: '4px 8px',
                    borderRadius: '3px',
                    fontWeight: '600'
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