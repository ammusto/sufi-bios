import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import NetworkVisualization from './NetworkVisualization';
import NetworkControls from './NetworkControls';
import NetworkStats from './NetworkStats';
import Loading from '../common/Loading';
import './Network.css';

const NetworkGraph = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State
  const [data, setData] = useState({
    transmissionGraph: null,
    personNetworks: null,
    bioNetworks: null,
    namesRegistry: null,
    isnadChains: null,
    edgeRegistry: null,
    metrics: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  
  // Get view parameters from URL
  const viewType = searchParams.get('view') || 'transmission';
  const focusId = searchParams.get('focus');
  const sourceFilter = searchParams.get('source') || 'all';
  const degreeFilter = parseInt(searchParams.get('degree')) || 3;
  const minWeight = parseInt(searchParams.get('minWeight')) || 0;

  // Load data
  useEffect(() => {
    const loadNetworkData = async () => {
      try {
        setLoading(true);
        
        // Load core data files
        const [
          transmissionGraph,
          personNetworks,
          bioNetworks,
          namesRegistry,
          isnadChains,
          edgeRegistry,
          metrics
        ] = await Promise.all([
          fetch('/data/transmission-graph.json').then(r => r.json()),
          fetch('/data/person-networks.json').then(r => r.json()),
          fetch('/data/bio-networks.json').then(r => r.json()),
          fetch('/data/names-registry.json').then(r => r.json()),
          fetch('/data/isnad-chains.json').then(r => r.json()),
          fetch('/data/edge-registry.json').then(r => r.json()),
          fetch('/data/network-metrics.json').then(r => r.json())
        ]);
        
        setData({
          transmissionGraph,
          personNetworks,
          bioNetworks,
          namesRegistry,
          isnadChains,
          edgeRegistry,
          metrics
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadNetworkData();
  }, []);

  // Filter graph data based on view type
  const filteredGraphData = useMemo(() => {
    if (!data.transmissionGraph) return null;
    
    let nodes = [];
    let edges = [];
    
    switch (viewType) {
      case 'transmission':
        // Full transmission network
        nodes = [...data.transmissionGraph.nodes];
        edges = [...data.transmissionGraph.edges];
        
        // Apply source filter
        if (sourceFilter !== 'all') {
          edges = edges.filter(e => sourceFilter in e.source_weights);
          const nodeIds = new Set();
          edges.forEach(e => {
            nodeIds.add(e.source);
            nodeIds.add(e.target);
          });
          nodes = nodes.filter(n => nodeIds.has(n.id));
        }
        
        // Apply minimum weight filter
        if (minWeight > 0) {
          edges = edges.filter(e => e.total_weight >= minWeight);
          const nodeIds = new Set();
          edges.forEach(e => {
            nodeIds.add(e.source);
            nodeIds.add(e.target);
          });
          nodes = nodes.filter(n => nodeIds.has(n.id));
        }
        break;
        
      case 'transmitter':
        // Focus on single transmitter
        if (focusId && data.personNetworks[focusId]) {
          const network = data.personNetworks[focusId];
          const nodeIds = new Set([parseInt(focusId)]);
          const edgeIds = new Set();
          
          // Add nodes and edges based on degree
          ['from', 'to'].forEach(direction => {
            for (let d = 1; d <= degreeFilter; d++) {
              const degreeKey = `degree_${d}`;
              if (network.transmission[direction][degreeKey]) {
                network.transmission[direction][degreeKey].nodes.forEach(nid => {
                  nodeIds.add(nid);
                });
                network.transmission[direction][degreeKey].edges.forEach(eid => {
                  edgeIds.add(eid);
                });
              }
            }
          });
          
          // Filter nodes and edges
          nodes = data.transmissionGraph.nodes.filter(n => nodeIds.has(n.id));
          edges = data.edgeRegistry.edges.filter(e => 
            edgeIds.has(`${e.source}->${e.target}`)
          );
          
          // Mark the focused node
          nodes = nodes.map(n => ({
            ...n,
            focused: n.id === parseInt(focusId),
            direction: n.id === parseInt(focusId) ? 'center' : 
                      (network.transmission.from.degree_1.nodes.includes(n.id) ||
                       network.transmission.from.degree_2.nodes.includes(n.id) ||
                       network.transmission.from.degree_3.nodes.includes(n.id)) ? 'from' : 'to'
          }));
        }
        break;
        
      case 'bio-transmission':
        // Biography transmission view
        if (focusId && data.bioNetworks[focusId]) {
          const network = data.bioNetworks[focusId];
          const nodeIds = new Set();
          
          // Add transmitters by degree
          network.transmission.direct_transmitters.forEach(id => nodeIds.add(id));
          if (degreeFilter >= 1) {
            network.transmission.degree_1.forEach(id => nodeIds.add(id));
          }
          if (degreeFilter >= 2) {
            network.transmission.degree_2.forEach(id => nodeIds.add(id));
          }
          if (degreeFilter >= 3) {
            network.transmission.degree_3.forEach(id => nodeIds.add(id));
          }
          
          // Filter nodes and edges
          nodes = data.transmissionGraph.nodes.filter(n => nodeIds.has(n.id));
          edges = data.edgeRegistry.edges.filter(e => 
            network.transmission.edges.includes(`${e.source}->${e.target}`)
          );
          
          // Add bio node as central node
          nodes.unshift({
            id: `bio_${focusId}`,
            name: network.name_ar || network.name_lat || `Biography ${focusId}`,
            is_bio: true,
            bio_id: focusId,
            x: 0,
            y: 0,
            total_weight: network.transmission.chains.length
          });
          
          // Add edges from bio to direct transmitters
          network.transmission.direct_transmitters.forEach(tid => {
            edges.push({
              source: `bio_${focusId}`,
              target: tid,
              is_bio_edge: true,
              total_weight: 1
            });
          });
        }
        break;
        
      case 'bio-network':
        // Biography relationship network
        if (focusId && data.bioNetworks[focusId]) {
          const network = data.bioNetworks[focusId];
          const nodeIds = new Set();
          const customEdges = [];
          
          // Add bio as central node
          nodes.push({
            id: `bio_${focusId}`,
            name: network.name_ar || network.name_lat || `Biography ${focusId}`,
            is_bio: true,
            bio_id: focusId,
            x: 0,
            y: 0,
            total_weight: 10
          });
          
          // Add related people
          Object.entries(network.relationships).forEach(([relType, relations]) => {
            relations.forEach(rel => {
              if (rel.person_id) {
                nodeIds.add(rel.person_id);
                customEdges.push({
                  source: `bio_${focusId}`,
                  target: rel.person_id,
                  relationship_type: relType,
                  total_weight: 1
                });
              }
            });
          });
          
          // Get nodes from registry
          const relatedNodes = data.transmissionGraph.nodes.filter(n => nodeIds.has(n.id));
          nodes = nodes.concat(relatedNodes);
          edges = customEdges;
        }
        break;
        
      default:
        break;
    }
    
    return { nodes, edges };
  }, [data, viewType, focusId, sourceFilter, degreeFilter, minWeight]);

  // Handle view changes
  const handleViewChange = useCallback((newView, newFocus = null) => {
    const params = new URLSearchParams(searchParams);
    params.set('view', newView);
    if (newFocus) {
      params.set('focus', newFocus);
    } else {
      params.delete('focus');
    }
    setSearchParams(params);
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [searchParams, setSearchParams]);

  // Handle filter changes
  const handleFilterChange = useCallback((filterType, value) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== 'all' && value !== 0) {
      params.set(filterType, value);
    } else {
      params.delete(filterType);
    }
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  // Handle node selection
  const handleNodeClick = useCallback((node) => {
    if (node.is_bio) {
      // Clicked on a biography node
      handleViewChange('bio-network', node.bio_id);
    } else {
      // Regular person node
      setSelectedNode(node);
    }
  }, [handleViewChange]);

  // Handle edge selection
  const handleEdgeClick = useCallback((edge) => {
    setSelectedEdge(edge);
  }, []);

  if (loading) return <Loading />;
  if (error) return <div className="error">Error loading network data: {error}</div>;
  if (!filteredGraphData) return <div className="error">No data available</div>;

  return (
    <div className="network-container">
      <div className="network-header">
        <h1>Sufi Transmission Networks</h1>
        <NetworkControls
          viewType={viewType}
          sourceFilter={sourceFilter}
          degreeFilter={degreeFilter}
          minWeight={minWeight}
          onViewChange={handleViewChange}
          onFilterChange={handleFilterChange}
        />
      </div>
      
      <div className="network-main">
        <div className="network-canvas">
          <NetworkVisualization
            nodes={filteredGraphData.nodes}
            edges={filteredGraphData.edges}
            viewType={viewType}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onNodeHover={setHoveredNode}
            selectedNode={selectedNode}
            hoveredNode={hoveredNode}
          />
        </div>
        
        <NetworkStats
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          hoveredNode={hoveredNode}
          data={data}
          viewType={viewType}
          onViewChange={handleViewChange}
        />
      </div>
    </div>
  );
};

export default NetworkGraph;