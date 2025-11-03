import React, { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import Layout from '../components/Layout/Layout';
import Loading from '../components/common/Loading';
import './TransmitterListView.css';

const TransmitterListView = () => {
  const [profiles, setProfiles] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('isnads'); // isnads, bios, name

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/data/person-profiles.json');
        const data = await response.json();
        setProfiles(data);
      } catch (err) {
        console.error('Error loading profiles:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Process and sort transmitters
  const transmitters = useMemo(() => {
    if (!profiles) return [];
    
    const list = Object.entries(profiles).map(([pid, profile]) => {
      const activity = profile.transmission_activity || {};
      return {
        personId: pid,
        name: profile.name || `Person ${pid}`,
        totalIsnads: activity.total_isnads || 0,
        uniqueBios: (activity.bio_subjects || []).length,
        texts: (activity.texts || []).join(', '),
        hasId: profile.has_id
      };
    });

    // Filter by search
    let filtered = list;
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      filtered = list.filter(t => 
        t.name.toLowerCase().includes(term) ||
        t.personId.includes(term)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'isnads':
          return b.totalIsnads - a.totalIsnads;
        case 'bios':
          return b.uniqueBios - a.uniqueBios;
        case 'name':
          return a.name.localeCompare(b.name, 'ar');
        default:
          return 0;
      }
    });

    return filtered;
  }, [profiles, searchTerm, sortBy]);

  const handleRowClick = (personId) => {
    window.open(`/network?view=transmitter&focus=${personId}`, '_blank');
  };

  if (loading) return <Layout><Loading /></Layout>;
  if (!profiles) return <Layout><div className="error">Failed to load data</div></Layout>;

  return (
    <Layout>
      <div className="container">
        <div className="transmitter-list-header">
          <h1>Transmitters Registry</h1>
          <p className="subtitle">
            {transmitters.length} transmitters {searchTerm && `(filtered from ${Object.keys(profiles).length})`}
          </p>
        </div>

        <div className="transmitter-controls">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="sort-controls">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="isnads">Most Isnads</option>
              <option value="bios">Most Biographies</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>

        <div className="transmitter-table-container">
          <table className="transmitter-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>ID</th>
                <th>Isnads</th>
                <th>Biographies</th>
                <th>Texts</th>
                <th>Has Bio</th>
              </tr>
            </thead>
            <tbody>
              {transmitters.map(t => (
                <tr 
                  key={t.personId}
                  onClick={() => handleRowClick(t.personId)}
                  className="transmitter-row"
                >
                  <td className="name-cell">{t.name}</td>
                  <td className="id-cell">#{t.personId}</td>
                  <td className="number-cell">{t.totalIsnads}</td>
                  <td className="number-cell">{t.uniqueBios}</td>
                  <td className="texts-cell">{t.texts}</td>
                  <td className="bio-cell">
                    {t.hasId && <span className="has-bio-badge">★ #{t.hasId}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {transmitters.length === 0 && (
            <div className="no-results">
              No transmitters found matching "{searchTerm}"
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default TransmitterListView;