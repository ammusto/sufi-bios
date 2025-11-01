import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';

const NetworkStats = ({
  selectedNode,
  selectedEdge,
  hoveredNode,
  data,
  viewType,
  onViewChange
}) => {
  const displayNode = selectedNode || hoveredNode;
  
  if (!displayNode && !selectedEdge) {
    return (
      <div className="network-stats">
        <h3>Network Statistics</h3>
        <div className="stats-content">
          <p>Click on a node or edge to see details</p>
          {data.metrics && (
            <div className="global-stats">
              <h4>Overview</h4>
              <div className="stat-item">
                <span className="stat-label">Total Transmitters:</span>
                <span className="stat-value">{Object.keys(data.namesRegistry).length}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total Chains:</span>
                <span className="stat-value">{Object.keys(data.isnadChains).length}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total Transmissions:</span>
                <span className="stat-value">{data.edgeRegistry.total_transmissions}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Network Density:</span>
                <span className="stat-value">{data.metrics.statistics.density.toFixed(4)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  if (selectedEdge) {
    const sourceNode = data.namesRegistry[selectedEdge.source];
    const targetNode = data.namesRegistry[selectedEdge.target];
    
    return (
      <div className="network-stats">
        <div className="stats-header">
          <h3>Edge Details</h3>
          <button 
            className="close-button"
            onClick={() => selectedEdge = null}
          >
            <X size={16} />
          </button>
        </div>
        <div className="stats-content">
          <div className="edge-info">
            <p><strong>From:</strong> {sourceNode?.canonical || `Person ${selectedEdge.source}`}</p>
            <p><strong>To:</strong> {targetNode?.canonical || `Person ${selectedEdge.target}`}</p>
            <p><strong>Weight:</strong> {selectedEdge.total_weight}</p>
            
            <h4>Sources</h4>
            {Object.entries(selectedEdge.source_weights || {}).map(([source, weight]) => (
              <div key={source} className="stat-item">
                <span className="stat-label">{source}:</span>
                <span className="stat-value">{weight}</span>
              </div>
            ))}
            
            <h4>Biographies</h4>
            <div className="bio-list">
              {selectedEdge.unique_bio_ids?.slice(0, 10).map(bioId => (
                <Link 
                  key={bioId}
                  to={`/bio/${bioId}`}
                  className="bio-link"
                >
                  Biography {bioId}
                </Link>
              ))}
              {selectedEdge.unique_bio_ids?.length > 10 && (
                <p className="more-items">...and {selectedEdge.unique_bio_ids.length - 10} more</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Node stats
  const nodeData = data.namesRegistry[displayNode.id];
  const personNetwork = data.personNetworks?.[displayNode.id];
  const metrics = data.metrics?.centrality?.[displayNode.id];
  
  return (
    <div className="network-stats">
      <div className="stats-header">
        <h3>{displayNode.name || `Person ${displayNode.id}`}</h3>
        {displayNode === selectedNode && (
          <button 
            className="close-button"
            onClick={() => selectedNode = null}
          >
            <X size={16} />
          </button>
        )}
      </div>
      
      <div className="stats-content">
        {nodeData && (
          <div className="node-info">
            <div className="stat-item">
              <span className="stat-label">ID:</span>
              <span className="stat-value">{displayNode.id}</span>
            </div>
            {nodeData.death_date && (
              <div className="stat-item">
                <span className="stat-label">Death:</span>
                <span className="stat-value">{nodeData.death_date.year_hijri}</span>
              </div>
            )}
            {nodeData.places?.length > 0 && (
              <div className="stat-item">
                <span className="stat-label">Places:</span>
                <span className="stat-value">{nodeData.places.join(', ')}</span>
              </div>
            )}
          </div>
        )}
        
        {metrics && (
          <div className="metrics-section">
            <h4>Network Metrics</h4>
            <div className="stat-item">
              <span className="stat-label">Transmissions:</span>
              <span className="stat-value">{metrics.transmission_count}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Betweenness:</span>
              <span className="stat-value">{metrics.betweenness.toFixed(4)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">PageRank:</span>
              <span className="stat-value">{metrics.pagerank.toFixed(4)}</span>
            </div>
          </div>
        )}
        
        {personNetwork && (
          <div className="transmission-section">
            <h4>Transmission Network</h4>
            <div className="stat-item">
              <span className="stat-label">Transmitted from:</span>
              <span className="stat-value">
                {personNetwork.transmission.from.degree_1.nodes.length} people
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Transmitted to:</span>
              <span className="stat-value">
                {personNetwork.transmission.to.degree_1.nodes.length} people
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Biographies:</span>
              <span className="stat-value">
                {displayNode.num_bios || 0} total
              </span>
            </div>
          </div>
        )}
        
        {displayNode === selectedNode && viewType !== 'transmitter' && (
          <button 
            className="focus-button"
            onClick={() => onViewChange('transmitter', displayNode.id)}
          >
            Focus on this transmitter
            <ArrowRight size={16} />
          </button>
        )}
        
        {displayNode.has_bio && (
          <Link 
            to={`/bio/${displayNode.own_bio_id}`}
            className="bio-link-button"
          >
            View Biography
            <ArrowRight size={16} />
          </Link>
        )}
      </div>
    </div>
  );
};

export default NetworkStats;