// src/components/BioDetail/TransmissionNetworkSection.js
import React, { useState, useMemo, useEffect } from 'react';
import ChainFlowGraph from '../Network/TransmitterView/ChainFlowGraph';
import StatsPanel from '../Network/shared/StatsPanel';
import Loading from '../common/Loading';

const TransmissionNetworkSection = ({ bioId, bioName }) => {
  const [activeSource, setActiveSource] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [sourceData, setSourceData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    loadSourceData();
  }, [bioId]);

  async function loadSourceData() {
    setLoading(true);
    setError(null);
    const sources = ['sulami', 'hilya', 'ansari'];
    const data = {};
    
    for (const source of sources) {
      try {
        const res = await fetch(`/data/jsons/${source}/${bioId}.json`);
        if (res.ok) {
          const text = await res.text();
          const json = JSON.parse(text.replace(/NaN/g, 'null'));
          data[source] = json;
        }
      } catch (e) {
        console.log(`Failed to load ${source}:`, e);
      }
    }
    
    setSourceData(data);
    
    const available = Object.keys(data);
    if (available.length > 0) {
      setActiveSource(available[0]);
    } else {
      setError('No network data available');
    }
    
    setLoading(false);
  }

  const graphData = useMemo(() => {
    if (!activeSource || !sourceData[activeSource]) return null;

    const currentData = sourceData[activeSource];
    
    if (!currentData.isnads || currentData.isnads.length === 0) return null;

    const nodesMap = new Map();
    const edgesMap = new Map();
    let subjectNodeId = null;

    currentData.isnads.forEach((isnad) => {
      if (!isnad.chain || isnad.chain.length === 0) return;

      const chain = isnad.chain.filter(c => c.person_id);
      
      chain.forEach((person, i) => {
        const nodeId = `p_${person.person_id}`;
        
        // Check if this person is the subject
        const isSubject = String(person.has_id) === String(bioId);
        if (isSubject) subjectNodeId = nodeId;
        
        if (!nodesMap.has(nodeId)) {
          nodesMap.set(nodeId, {
            id: nodeId,
            name: person.canonical_name || person.name || `Person ${person.person_id}`,
            personId: person.person_id,
            hasId: person.has_id,
            isBioSubject: isSubject,
            size: isSubject ? 20 : 10,
            color: isSubject ? '#ef4444' : '#3b82f6'
          });
        }

        // Create edge to next person in chain
        if (i < chain.length - 1) {
          const nextId = `p_${chain[i + 1].person_id}`;
          const edgeKey = `${nodeId}->${nextId}`;
          if (!edgesMap.has(edgeKey)) {
            edgesMap.set(edgeKey, {
              source: nodeId,
              target: nextId,
              weight: 1
            });
          } else {
            edgesMap.get(edgeKey).weight += 1;
          }
        }
      });
    });

    const nodes = Array.from(nodesMap.values());
    const edges = Array.from(edgesMap.values());

    if (nodes.length === 0) return null;

    return {
      nodes,
      edges,
      centerPersonId: subjectNodeId || nodes[0].id
    };
  }, [sourceData, activeSource, bioId]);

  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };

  const handleNodeAction = (action, nodeData) => {
    if (action === 'focus-transmitter' && nodeData.personId) {
      window.open(`/network?view=transmitter&focus=${nodeData.personId}`, '_blank');
    }
  };

  function downloadJSON() {
    const data = sourceData[activeSource];
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSource}_${bioId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCSV() {
    if (!graphData) return;
    const rows = [['source', 'target', 'weight']];
    graphData.edges.forEach(e => {
      const source = graphData.nodes.find(n => n.id === e.source)?.name || e.source;
      const target = graphData.nodes.find(n => n.id === e.target)?.name || e.target;
      rows.push([source, target, e.weight]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network_${activeSource}_${bioId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <Loading />;
  if (error) return <div style={{ padding: '20px', color: '#666' }}>{error}</div>;
  if (!activeSource) return null;

  const availableSources = Object.keys(sourceData);

  return (
    <div style={{ marginBottom: '30px' }}>
      <h2>Transmission Network</h2>
      
      <div style={{ 
        borderBottom: '2px solid #e0e0e0', 
        marginBottom: '20px',
        display: 'flex',
        gap: '10px',
        justifyContent: 'space-between',
        alignItems: 'flex-end'
      }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          {availableSources.map(source => {
            const count = sourceData[source]?.isnads?.length || 0;
            
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
        
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button
            onClick={downloadJSON}
            style={{
              padding: '6px 12px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            JSON
          </button>
          <button
            onClick={downloadCSV}
            style={{
              padding: '6px 12px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            CSV
          </button>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        {graphData ? (
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
                orientation="down"
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
                  profile={null}
                  isnads={null}
                  onClose={() => setSelectedNode(null)}
                  onAction={handleNodeAction}
                  viewType="transmission"
                />
              </div>
            )}
          </>
        ) : (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: '#666' 
          }}>
            No transmission data for {activeSource}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransmissionNetworkSection;