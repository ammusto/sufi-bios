import React, { useState, useMemo } from 'react';
import HierarchicalGraph from './HierarchicalGraph';
import StatsPanel from '../shared/StatsPanel';

/**
 * View 1: Transmission Isnads
 * Shows aggregated hierarchical network with significant transmitters only
 * One node per person (aggregated across all isnads)
 */
const TransmissionView = ({ data, onViewChange }) => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [sourceFilter, setSourceFilter] = useState('hilya'); // Start with hilya
  const [minIsnadCount, setMinIsnadCount] = useState(3); // Threshold for showing transmitters
  
  // Build aggregated graph data from isnads
  const graphData = useMemo(() => {
    const { isnads, profiles } = data;
    
    // Filter isnads by source
    const filteredIsnads = Object.values(isnads).filter(isnad => {
      return isnad.sources.includes(sourceFilter);
    });
    
    // Aggregate: count how many times each person appears across all isnads
    const personIsnadCounts = new Map(); // person_id -> count
    const personPositions = new Map(); // person_id -> array of positions
    const personTexts = new Map(); // person_id -> Set of texts
    const personHasId = new Map(); // person_id -> has_id
    
    filteredIsnads.forEach(isnad => {
      isnad.sequence.forEach((personId, position) => {
        // Count appearances
        personIsnadCounts.set(personId, (personIsnadCounts.get(personId) || 0) + isnad.occurrences.length);
        
        // Track positions
        if (!personPositions.has(personId)) {
          personPositions.set(personId, []);
        }
        // Add position once per unique isnad, not per occurrence
        personPositions.get(personId).push(position);
        
        // Track texts
        if (!personTexts.has(personId)) {
          personTexts.set(personId, new Set());
        }
        personTexts.get(personId).add(sourceFilter);
        
        // Track has_id
        if (isnad.has_ids[position] && !personHasId.has(personId)) {
          personHasId.set(personId, isnad.has_ids[position]);
        }
      });
    });
    
    // Filter: only keep people who appear in minIsnadCount+ isnads
    const significantPeople = new Set(
      Array.from(personIsnadCounts.entries())
        .filter(([_, count]) => count >= minIsnadCount)
        .map(([pid, _]) => pid)
    );
    
    // Build nodes (one per person)
    const nodesMap = new Map();
    
    significantPeople.forEach(personId => {
      const profile = profiles[String(personId)];
      const positions = personPositions.get(personId) || [];
      
      // Calculate average position for layering
      const avgPosition = positions.length > 0 
        ? positions.reduce((sum, p) => sum + p, 0) / positions.length
        : 0;
      
      nodesMap.set(personId, {
        id: personId,
        personId: personId,
        name: profile?.name || `Person ${personId}`,
        isnadCount: personIsnadCounts.get(personId) || 0,
        avgPosition: avgPosition,
        positions: positions,
        texts: Array.from(personTexts.get(personId) || []),
        hasId: personHasId.get(personId)
      });
    });
    
    // Build edges (aggregated by connection count)
    const edgesMap = new Map(); // "source->target" -> {source, target, weight, isnadIds}
    
    filteredIsnads.forEach(isnad => {
      const sequence = isnad.sequence;
      
      // For each consecutive pair in the isnad
      for (let i = 0; i < sequence.length - 1; i++) {
        const source = sequence[i];
        const target = sequence[i + 1];
        
        // Only include edge if both nodes are significant
        if (!significantPeople.has(source) || !significantPeople.has(target)) {
          continue;
        }
        
        const edgeKey = `${source}->${target}`;
        
        if (!edgesMap.has(edgeKey)) {
          edgesMap.set(edgeKey, {
            source: source,
            target: target,
            weight: 0,
            isnadIds: new Set()
          });
        }
        
        const edge = edgesMap.get(edgeKey);
        edge.weight += isnad.occurrences.length; // Weight by occurrence count
        edge.isnadIds.add(isnad.isnad_id);
      }
    });
    
    // Convert to arrays
    const nodes = Array.from(nodesMap.values());
    const edges = Array.from(edgesMap.values()).map(e => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
      isnadIds: Array.from(e.isnadIds)
    }));
    
    return {
      nodes: nodes,
      edges: edges,
      isnadCount: filteredIsnads.length,
      totalNodes: personIsnadCounts.size,
      filteredCount: significantPeople.size
    };
  }, [data, sourceFilter, minIsnadCount]);
  
  const handleNodeClick = (node) => {
    if (!node) {
      setSelectedNode(null);
      return;
    }
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
          <label>Text:</label>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="hilya">Ḥilya</option>
            <option value="sulami">Al-Sulamī</option>
            <option value="ansari">Al-Anṣārī</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>Min. isnads:</label>
          <input 
            type="range" 
            min="1" 
            max="20" 
            value={minIsnadCount}
            onChange={(e) => setMinIsnadCount(parseInt(e.target.value))}
            style={{ width: '120px' }}
          />
          <span style={{ minWidth: '30px', textAlign: 'center' }}>{minIsnadCount}+</span>
        </div>
        
        <div className="stats-display">
          <span>{graphData.isnadCount} isnads</span>
          <span>{graphData.filteredCount} / {graphData.totalNodes} transmitters shown</span>
        </div>
      </div>
      
      <div className="view-layout">
        <div className="graph-area">
          {graphData.nodes.length === 0 ? (
            <div className="no-results">
              No transmitters meet the threshold. Try lowering the minimum isnad count.
            </div>
          ) : (
            <HierarchicalGraph
              nodes={graphData.nodes}
              edges={graphData.edges}
              isnads={data.isnads}
              sourceFilter={sourceFilter}
              onNodeClick={handleNodeClick}
              selectedNode={selectedNode}
            />
          )}
        </div>
        
        {selectedNode && (
          <StatsPanel
            node={selectedNode}
            profile={data.profiles[String(selectedNode.personId)]}
            isnads={data.isnads}
            onClose={() => setSelectedNode(null)}
            onAction={handleNodeAction}
            viewType="transmission"
          />
        )}
      </div>
    </div>
  );
};

export default TransmissionView;