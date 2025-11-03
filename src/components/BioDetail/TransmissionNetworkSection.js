import React, { useState, useMemo, useEffect } from 'react';
import ChainFlowGraph from '../Network/TransmitterView/ChainFlowGraph';
import StatsPanel from '../Network/shared/StatsPanel';
import Loading from '../common/Loading';

const TransmissionNetworkSection = ({ bioId, bioName }) => {
  const [activeSource, setActiveSource] = useState('hilya');
  const [selectedNode, setSelectedNode] = useState(null);
  const [isnads, setIsnads] = useState(null);
  const [profiles, setProfiles] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Load aggregated data once
  useEffect(() => {
    const loadData = async () => {
      try {
        const [isnadsData, profilesData] = await Promise.all([
          fetch('/data/transmission-isnads.json').then(r => r.json()),
          fetch('/data/person-profiles.json').then(r => r.json())
        ]);
        setIsnads(isnadsData);
        setProfiles(profilesData);
      } catch (err) {
        console.error('Error loading network data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);
  
  // Filter isnads by bio_id and source
  const availableSources = useMemo(() => {
    if (!isnads) return [];
    
    const sources = [];
    const bioIsnads = Object.values(isnads).filter(isnad => 
      isnad.unique_bio_ids?.includes(bioId)
    );
    
    if (bioIsnads.some(i => i.sources?.includes('hilya'))) sources.push('hilya');
    if (bioIsnads.some(i => i.sources?.includes('sulami'))) sources.push('sulami');
    if (bioIsnads.some(i => i.sources?.includes('ansari'))) sources.push('ansari');
    
    return sources;
  }, [isnads, bioId]);

  // Build graph data for current source
  const graphData = useMemo(() => {
    if (!isnads || !profiles) return null;
    
    // Get isnads for this bio and source
    const relevantIsnads = Object.values(isnads).filter(isnad => {
      if (!isnad.unique_bio_ids?.includes(bioId)) return false;
      if (!isnad.sources?.includes(activeSource)) return false;
      return true;
    });
    
    if (relevantIsnads.length === 0) return null;

    const nodesMap = new Map();
    const edgesMap = new Map();
    
    // Add bio subject as the final node (will be the focus)
    const subjectId = `bio_${bioId}`;
    nodesMap.set(subjectId, {
      id: subjectId,
      personId: null,
      type: 'center',
      name: bioName,
      hasId: bioId,
      isBioSubject: true
    });

    // Process each isnad
    relevantIsnads.forEach(isnad => {
      const sequence = isnad.sequence || [];
      const names = isnad.names || [];
      const hasIds = isnad.has_ids || [];
      
      // Add all people in chain
      sequence.forEach((pid, idx) => {
        if (!nodesMap.has(pid)) {
          const profile = profiles[String(pid)];
          nodesMap.set(pid, {
            id: pid,
            personId: pid,
            type: 'other',
            name: names[idx] || profile?.name || `Person ${pid}`,
            hasId: hasIds[idx] || profile?.has_id,
            isUpstream: true
          });
        }
      });
      
      // Add edges between people in chain
      for (let i = 0; i < sequence.length - 1; i++) {
        const source = sequence[i];
        const target = sequence[i + 1];
        
        const edgeKey = `${source}->${target}`;
        if (!edgesMap.has(edgeKey)) {
          edgesMap.set(edgeKey, {
            source: source,
            target: target,
            weight: 0
          });
        }
        edgesMap.get(edgeKey).weight += 1;
      }
      
      // Add final edge from last person to bio subject
      if (sequence.length > 0) {
        const lastPerson = sequence[sequence.length - 1];
        const edgeKey = `${lastPerson}->${subjectId}`;
        if (!edgesMap.has(edgeKey)) {
          edgesMap.set(edgeKey, {
            source: lastPerson,
            target: subjectId,
            weight: 0
          });
        }
        edgesMap.get(edgeKey).weight += 1;
      }
    });

    return {
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values()),
      centerPersonId: subjectId
    };
  }, [isnads, profiles, activeSource, bioId, bioName]);

  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };

  const handleNodeAction = (action, nodeData) => {
    if (action === 'focus-transmitter' && nodeData.personId) {
      // Open transmitter view in new tab
      window.open(`/network?view=transmitter&focus=${nodeData.personId}`, '_blank');
    }
  };

  if (loading) return <Loading />;
  if (availableSources.length === 0) return null;

  // Set default source if current one not available
  if (!availableSources.includes(activeSource) && availableSources.length > 0) {
    setActiveSource(availableSources[0]);
  }

  return (
    <div style={{ marginBottom: '30px' }}>
      <h2>Transmission Network</h2>
      
      <div style={{ 
        borderBottom: '2px solid #e0e0e0', 
        marginBottom: '20px',
        display: 'flex',
        gap: '10px'
      }}>
        {availableSources.map(source => {
          const count = Object.values(isnads).filter(i => 
            i.unique_bio_ids?.includes(bioId) && i.sources?.includes(source)
          ).length;
          
          return (
            <button
              key={source}
              onClick={() => setActiveSource(source)}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: activeSource === source ? '#333' : 'transparent',
                color: activeSource === source ? 'white' : '#333',
                cursor: 'pointer',
                borderRadius: '4px 4px 0 0',
                fontSize: '14px',
                fontWeight: activeSource === source ? 'bold' : 'normal',
                textTransform: 'capitalize'
              }}
            >
              {source === 'hilya' ? 'Ḥilya' : source === 'sulami' ? 'Al-Sulamī' : 'Al-Anṣārī'}
              {` (${count})`}
            </button>
          );
        })}
      </div>

      <div style={{ position: 'relative' }}>
        {graphData && (
          <>
            <div style={{ 
              height: '700px', 
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              background: '#fafafa'
            }}>
              <ChainFlowGraph
                data={graphData}
                isnadDetails={null}
                onNodeClick={handleNodeClick}
                selectedNode={selectedNode}
                showPeerConnections={false}
                orientation="left"
              />
            </div>
            
            {selectedNode && !selectedNode.isBioSubject && (
              <div style={{
                position: 'absolute',
                right: '20px',
                top: '20px',
                maxHeight: 'calc(100% - 40px)',
                overflowY: 'auto'
              }}>
                <StatsPanel
                  node={selectedNode}
                  profile={profiles?.[String(selectedNode.personId)]}
                  isnads={isnads}
                  onClose={() => setSelectedNode(null)}
                  onAction={handleNodeAction}
                  viewType="transmission"
                />
              </div>
            )}
          </>
        )}
        
        {!graphData && (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: '#666' 
          }}>
            No transmission data available for {activeSource}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransmissionNetworkSection;