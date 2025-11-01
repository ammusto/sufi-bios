import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import TransmissionView from './TransmissionView/TransmissionView';
import TransmitterView from './TransmitterView/TransmitterView';
import BiographyView from './BiographyView/BiographyView';
import Loading from '../common/Loading';
import './NetworkStyles.css';

/**
 * Main container for all three network views
 * Manages data loading and view routing
 */
const NetworkContainer = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Get current view from URL
  const view = searchParams.get('view') || 'transmission';
  const focusId = searchParams.get('focus');
  
  // Load all data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        const [chains, profiles, bioNetworks, biosMetadata, metadata] = await Promise.all([
          fetch('/data/transmission-chains.json').then(r => r.json()),
          fetch('/data/person-profiles.json').then(r => r.json()),
          fetch('/data/bio-social-networks.json').then(r => r.json()),
          fetch('/data/bios-metadata.json').then(r => r.json()),
          fetch('/data/network-metadata.json').then(r => r.json())
        ]);
        
        setData({
          chains,
          profiles,
          bioNetworks,
          biosMetadata,
          metadata
        });
      } catch (err) {
        console.error('Error loading network data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  const handleViewChange = (newView, newFocus = null) => {
    const params = new URLSearchParams(searchParams);
    params.set('view', newView);
    if (newFocus) {
      params.set('focus', newFocus);
    } else {
      params.delete('focus');
    }
    setSearchParams(params);
  };
  
  if (loading) return <Loading />;
  if (error) return <div className="error">Error loading data: {error}</div>;
  if (!data) return <div className="error">No data available</div>;
  
  return (
    <div className="network-container">
      <div className="network-header">
        <h1>Sufi Transmission Networks</h1>
        
        <div className="view-tabs">
          <button
            className={`view-tab ${view === 'transmission' ? 'active' : ''}`}
            onClick={() => handleViewChange('transmission')}
          >
            Transmission Chains
          </button>
          <button
            className={`view-tab ${view === 'transmitter' ? 'active' : ''}`}
            onClick={() => handleViewChange('transmitter')}
            disabled={!focusId && view !== 'transmitter'}
          >
            Transmitter View
          </button>
          <button
            className={`view-tab ${view === 'biography' ? 'active' : ''}`}
            onClick={() => handleViewChange('biography')}
            disabled={!focusId && view !== 'biography'}
          >
            Biography Network
          </button>
        </div>
      </div>
      
      <div className="network-content">
        {view === 'transmission' && (
          <TransmissionView 
            data={data} 
            onViewChange={handleViewChange}
          />
        )}
        
        {view === 'transmitter' && focusId && (
          <TransmitterView 
            personId={focusId}
            data={data}
            onViewChange={handleViewChange}
          />
        )}
        
        {view === 'biography' && focusId && (
          <BiographyView 
            bioId={focusId}
            data={data}
            onViewChange={handleViewChange}
          />
        )}
        
        {((view === 'transmitter' && !focusId) || (view === 'biography' && !focusId)) && (
          <div className="no-selection">
            <p>Select a {view === 'transmitter' ? 'person' : 'biography'} to view their network</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkContainer;