import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import TransmitterViewComponent from '../components/Network/TransmitterView/TransmitterView';
import Loading from '../components/common/Loading';

const TransmitterView = () => {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const focusId = searchParams.get('focus');
  
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        const [isnads, profiles] = await Promise.all([
          fetch('/data/transmission-isnads.json').then(r => r.json()),
          fetch('/data/person-profiles.json').then(r => r.json())
        ]);
        
        setData({ isnads, profiles });
      } catch (err) {
        console.error('Error loading network data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  const handleViewChange = (action, id) => {
    if (action === 'focus-transmitter') {
      window.open(`/network?view=transmitter&focus=${id}`, '_blank');
    }
  };
  
  if (loading) return <Loading />;
  if (error) return <div className="error">Error loading data: {error}</div>;
  if (!data) return <div className="error">No data available</div>;
  if (!focusId) {
    return (
      <div className="container" style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Transmitter Network View</h2>
        <p style={{ color: '#666', marginTop: '20px' }}>
          Select a transmitter from the <a href="/transmitters">Transmitters Registry</a> to view their network.
        </p>
      </div>
    );
  }
  
  return (
    <TransmitterViewComponent 
      personId={focusId}
      data={data}
      onViewChange={handleViewChange}
    />
  );
};

export default TransmitterView;