import React, { useMemo, useState } from 'react';
import ChainFlowGraph from './ChainFlowGraph';
import StatsPanel from '../shared/StatsPanel';

/**
 * View 2: Transmitter Focus
 * Shows all isnads aggregated with person at center
 */
const TransmitterView = ({ personId, data, onViewChange }) => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [showPeerConnections, setShowPeerConnections] = useState(false); // Default OFF
  
  const profile = data.profiles[personId];
  
  const isnadGraphData = useMemo(() => {
    if (!profile) return null;
    
    const { isnad_details } = profile;
    const centerPersonId = Number(personId);
    
    // Aggregate all edges from all isnads
    const nodesMap = new Map();
    const edgesMap = new Map();
    
    // Add center node
    nodesMap.set(centerPersonId, {
      id: centerPersonId,
      personId: centerPersonId,
      type: 'center',
      name: profile.name,
      hasId: profile.has_id
    });
    
    // Process each isnad
    isnad_details.forEach(detail => {
      const { full_isnad, full_isnad_names, position } = detail;
      
      // Add all nodes from isnad
      full_isnad.forEach((pid, idx) => {
        if (!nodesMap.has(pid)) {
          const nodeProfile = data.profiles[String(pid)];
          nodesMap.set(pid, {
            id: pid,
            personId: pid,
            type: pid === centerPersonId ? 'center' : 'other',
            name: full_isnad_names[idx] || nodeProfile?.name || `Person ${pid}`,
            hasId: nodeProfile?.has_id,
            isUpstream: idx < position,
            isDownstream: idx > position
          });
        }
      });
      
      // Add all edges from isnad
      for (let i = 0; i < full_isnad.length - 1; i++) {
        const source = full_isnad[i];
        const target = full_isnad[i + 1];
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
    });
    
    return {
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values()),
      centerPersonId: centerPersonId
    };
  }, [personId, profile, data]);
  
  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };
  
  const handleNodeAction = (action, nodeData) => {
    if (action === 'focus-transmitter') {
      onViewChange('transmitter', String(nodeData.personId));
    } else if (action === 'view-biography' && nodeData.hasId) {
      onViewChange('biography', String(nodeData.hasId));
    } else if (action === 'view-all-isnads') {
      onViewChange('view-all-isnads', String(nodeData.personId));
    }
  };
  
  if (!profile) {
    return <div className="error">Person profile not found</div>;
  }
  
  if (!isnadGraphData) {
    return <div className="error">Could not build isnad data</div>;
  }
  
  return (
    <div className="transmitter-view">
      <div className="view-header">
        <div>
          <h2>{profile.name}</h2>
          <div className="view-stats">
            <span>Total isnads: {profile.transmission_activity.total_isnads}</span>
            <span>Unique nodes: {isnadGraphData.nodes.length}</span>
            <span>Unique edges: {isnadGraphData.edges.length}</span>
          </div>
        </div>
        
        <div className="view-controls">
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={showPeerConnections}
              onChange={(e) => setShowPeerConnections(e.target.checked)}
            />
            <span className="toggle-label">Show Peer Connections</span>
            <span className="toggle-hint">
              (same-level & level-skipping edges)
            </span>
          </label>
        </div>
      </div>
      
      <div className="view-content">
        <div className="graph-area">
          <ChainFlowGraph
            data={isnadGraphData}
            isnadDetails={profile.isnad_details}
            onNodeClick={handleNodeClick}
            selectedNode={selectedNode}
            showPeerConnections={showPeerConnections}
          />
        </div>
        
        {selectedNode && (
          <StatsPanel
            node={selectedNode}
            profile={data.profiles[String(selectedNode.personId)]}
            isnads={data.isnads}
            onClose={() => setSelectedNode(null)}
            onAction={handleNodeAction}
            viewType="transmitter"
          />
        )}
      </div>
    </div>
  );
};

export default TransmitterView;