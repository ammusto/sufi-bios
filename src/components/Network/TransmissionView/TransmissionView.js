import React, { useState, useMemo } from 'react';
import HierarchicalGraph from './HierarchicalGraph';
import StatsPanel from '../shared/StatsPanel';
import ChainsList from './ChainsList';

/**
 * View 1: Transmission Chains
 * Shows hierarchical network of all transmission chains
 */
const TransmissionView = ({ data, onViewChange }) => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [showChainsList, setShowChainsList] = useState(false);
  
  // Build graph data from chains
  const graphData = useMemo(() => {
    const { chains, profiles } = data;
    
    // Filter chains by source if needed
    const filteredChains = Object.values(chains).filter(chain => {
      if (sourceFilter === 'all') return true;
      return chain.sources.includes(sourceFilter);
    });
    
    // Extract all nodes and edges
    const nodesMap = new Map();
    const edges = [];
    
    filteredChains.forEach(chain => {
      const { sequence, names, has_ids } = chain;
      
      // Add nodes
      sequence.forEach((personId, position) => {
        const key = `${personId}-${position}`;
        
        if (!nodesMap.has(key)) {
          const profile = profiles[String(personId)];
          
          nodesMap.set(key, {
            id: key,
            personId: personId,
            position: position,
            name: names[position] || profile?.name || `Person ${personId}`,
            hasId: has_ids[position],
            // For sizing/coloring
            totalChains: profile?.transmission_activity.total_chains || 0,
            texts: profile?.transmission_activity.texts || []
          });
        }
      });
      
      // Add edges
      for (let i = 0; i < sequence.length - 1; i++) {
        edges.push({
          source: `${sequence[i]}-${i}`,
          target: `${sequence[i+1]}-${i+1}`,
          chainId: chain.chain_id,
          bioIds: chain.unique_bio_ids,
          bioCount: chain.unique_bio_ids.length
        });
      }
    });
    
    return {
      nodes: Array.from(nodesMap.values()),
      edges: edges,
      chainCount: filteredChains.length
    };
  }, [data, sourceFilter]);
  
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
  
  return (
    <div className="transmission-view">
      <div className="view-controls">
        <div className="filter-group">
          <label>Source:</label>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="all">All Sources</option>
            <option value="sulami">Al-Sulamī</option>
            <option value="ansari">Al-Anṣārī</option>
            <option value="hilya">Ḥilya</option>
          </select>
        </div>
        
        <div className="stats-display">
          <span>{graphData.chainCount} chains</span>
          <span>{graphData.nodes.length} positions</span>
        </div>
        
        <button 
          className="toggle-list-btn"
          onClick={() => setShowChainsList(!showChainsList)}
        >
          {showChainsList ? 'Hide' : 'Show'} Chains List
        </button>
      </div>
      
      <div className="view-layout">
        <div className="graph-area">
          <HierarchicalGraph
            nodes={graphData.nodes}
            edges={graphData.edges}
            onNodeClick={handleNodeClick}
            selectedNode={selectedNode}
          />
        </div>
        
        {selectedNode && (
          <StatsPanel
            node={selectedNode}
            profile={data.profiles[String(selectedNode.personId)]}
            chains={data.chains}
            onClose={() => setSelectedNode(null)}
            onAction={handleNodeAction}
            viewType="transmission"
          />
        )}
        
        {showChainsList && (
          <ChainsList
            chains={Object.values(data.chains).filter(chain => {
              if (sourceFilter === 'all') return true;
              return chain.sources.includes(sourceFilter);
            })}
            onClose={() => setShowChainsList(false)}
          />
        )}
      </div>
    </div>
  );
};

export default TransmissionView;