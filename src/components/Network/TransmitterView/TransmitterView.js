import React, { useMemo, useState } from 'react';
import ChainFlowGraph from './ChainFlowGraph';
import StatsPanel from '../shared/StatsPanel';
import NetworkControls from '../shared/NetworkControls';

const TransmitterView = ({ personId, data, onViewChange }) => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [showPeerConnections, setShowPeerConnections] = useState(false);
  const [orientation, setOrientation] = useState('left');
  
  const profile = data.profiles[personId];
  
  const isnadGraphData = useMemo(() => {
    if (!profile) return null;
    
    const { isnad_details } = profile;
    const centerPersonId = Number(personId);
    
    const nodesMap = new Map();
    const edgesMap = new Map();
    
    nodesMap.set(centerPersonId, {
      id: centerPersonId,
      personId: centerPersonId,
      type: 'center',
      name: profile.name,
      hasId: profile.has_id,
      isBioSubject: false
    });
    
    isnad_details.forEach(detail => {
      const { full_isnad, full_isnad_names, position } = detail;
      
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
            isDownstream: idx > position,
            isBioSubject: false
          });
        }
      });
      
      for (let i = 0; i < full_isnad.length - 1; i++) {
        const source = full_isnad[i];
        const target = full_isnad[i + 1];
        const edgeKey = `${source}->${target}`;
        
        if (!edgesMap.has(edgeKey)) {
          edgesMap.set(edgeKey, { source, target, weight: 0 });
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

  const handleExport = () => {
    if (!profile) return;
    
    const csv = [
      ['Isnad ID', 'Position', 'Bio ID', 'Bio Name', 'Source', 'Full Chain', 'Text'].join(','),
      ...profile.isnad_details.map(d => [
        d.isnad_id,
        d.position,
        d.bio_id,
        `"${d.bio_name}"`,
        d.source,
        `"${d.full_isnad_names.join(' → ')}"`,
        `"${d.full_text.replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `person_${personId}_isnads.csv`;
    link.click();
  };
  
  const handleNodeClick = (node) => setSelectedNode(node);
  
  const handleNodeAction = (action, nodeData) => {
    if (action === 'focus-transmitter' && nodeData.personId) {
      window.open(`/network?view=transmitter&focus=${nodeData.personId}`, '_blank');
    } else if (action === 'view-biography' && nodeData.hasId) {
      window.open(`/bio/${nodeData.hasId}`, '_blank');
    } else if (action === 'view-all-isnads' && nodeData.personId) {
      console.log('View all isnads for person:', nodeData.personId);
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
      </div>
      
      <NetworkControls
        orientation={orientation}
        onOrientationChange={setOrientation}
        showPeerConnections={showPeerConnections}
        onPeerConnectionsChange={setShowPeerConnections}
        onExport={handleExport}
      />
      
      <div className="view-content" style={{ marginTop: '20px' }}>
        <div className="graph-area">
          <ChainFlowGraph
            data={isnadGraphData}
            isnadDetails={profile.isnad_details}
            onNodeClick={handleNodeClick}
            selectedNode={selectedNode}
            showPeerConnections={showPeerConnections}
            orientation={orientation}
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