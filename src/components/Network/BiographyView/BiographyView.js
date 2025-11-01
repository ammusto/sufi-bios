import React, { useMemo, useState } from 'react';
import SocialNetwork from './SocialNetwork';
import StatsPanel from '../shared/StatsPanel';

/**
 * View 3: Biography Social Network
 * Shows associates and relationships for a biography subject
 */
const BiographyView = ({ bioId, data, onViewChange }) => {
  const [selectedNode, setSelectedNode] = useState(null);
  const bioNetwork = data.bioNetworks[bioId];
  const bioMetadata = data.biosMetadata[bioId];
  
  // Color scheme for relationship types
  const relationshipColors = {
    'teachers': '#4CAF50',
    'students': '#2196F3',
    'companions': '#FF9800',
    'narrators': '#9C27B0',
    'other': '#757575'
  };
  
  const networkData = useMemo(() => {
    if (!bioNetwork) return null;
    
    const { associates, subject } = bioNetwork;
    
    // Add subject as center node
    const nodes = [
      {
        id: subject.person_id || `bio_${bioId}`,
        personId: subject.person_id,
        type: 'subject',
        name: subject.name_ar || subject.name_lat || `Biography ${bioId}`,
        bioId: bioId,
        hasId: bioId
      }
    ];
    
    // Add associate nodes
    associates.nodes.forEach(assoc => {
      nodes.push({
        id: assoc.person_id,
        personId: assoc.person_id,
        type: 'associate',
        name: assoc.name,
        hasId: assoc.has_id,
        sources: assoc.sources
      });
    });
    
    // Edges with relationship types
    const edges = associates.edges.map(edge => ({
      ...edge,
      color: relationshipColors[edge.relationship_type] || relationshipColors.other
    }));
    
    return { nodes, edges };
  }, [bioNetwork, bioId, relationshipColors]);
  
  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };
  
  const handleNodeAction = (action, nodeData) => {
    if (action === 'focus-transmitter') {
      onViewChange('transmitter', String(nodeData.personId));
    } else if (action === 'view-biography' && nodeData.hasId) {
      onViewChange('biography', String(nodeData.hasId));
    }
  };
  
  if (!bioNetwork || !bioMetadata) {
    return <div className="error">Biography data not found</div>;
  }
  
  return (
    <div className="biography-view">
      <div className="view-header">
        <div>
          <h2>{bioMetadata.name_ar || bioMetadata.name_lat}</h2>
          {bioMetadata.name_ar && bioMetadata.name_lat && (
            <p className="subtitle">{bioMetadata.name_lat}</p>
          )}
        </div>
        <div className="view-stats">
          <span>Associates: {bioNetwork.associates.nodes.length}</span>
          <span>Sources: {bioMetadata.has_json.join(', ')}</span>
        </div>
      </div>
      
      <div className="view-content">
        <div className="network-area">
          <SocialNetwork
            nodes={networkData.nodes}
            edges={networkData.edges}
            onNodeClick={handleNodeClick}
            selectedNode={selectedNode}
          />
          
          <div className="legend">
            <h4>Relationship Types</h4>
            {Object.entries(relationshipColors).map(([type, color]) => (
              <div key={type} className="legend-item">
                <div 
                  className="legend-color" 
                  style={{ backgroundColor: color }}
                />
                <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
              </div>
            ))}
          </div>
        </div>
        
        {selectedNode && (
          <StatsPanel
            node={selectedNode}
            profile={data.profiles[String(selectedNode.personId)]}
            chains={data.chains}
            onClose={() => setSelectedNode(null)}
            onAction={handleNodeAction}
            viewType="biography"
          />
        )}
      </div>
    </div>
  );
};

export default BiographyView;