import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import './Network.css';

/**
 * Sufi Network Visualization Component
 * Displays force-directed network graphs with multiple view modes
 */
const Network = () => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  
  // State for data and view management
  const [transmissionGraph, setTransmissionGraph] = useState(null);
  const [isnadRegistry, setIsnadRegistry] = useState(null);
  const [personNetworks, setPersonNetworks] = useState(null);
  const [bioNetworks, setBioNetworks] = useState(null);
  const [namesRegistry, setNamesRegistry] = useState(null);
  const [networkMetrics, setNetworkMetrics] = useState(null);
  
  const [viewMode, setViewMode] = useState('transmission'); // transmission | transmitter | bio-transmission | bio-network
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedBio, setSelectedBio] = useState(null);
  const [filterSource, setFilterSource] = useState('all'); // all | sulami | ansari | hilya
  const [showDegree, setShowDegree] = useState(2); // 1, 2, or 3 degrees
  const [loading, setLoading] = useState(true);
  const [statsPanel, setStatsPanel] = useState(null);
  const [frozen, setFrozen] = useState(false); // Add freeze state
  const simulationRef = useRef(null); // Store simulation reference

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [tGraph, iRegistry, pNetworks, bNetworks, nRegistry, nMetrics] = await Promise.all([
          fetch('/data/transmission-graph.json').then(r => r.json()),
          fetch('/data/isnad-registry.json').then(r => r.json()),
          fetch('/data/person-networks.json').then(r => r.json()),
          fetch('/data/bio-networks.json').then(r => r.json()),
          fetch('/data/names-registry.json').then(r => r.json()),
          fetch('/data/network-metrics.json').then(r => r.json())
        ]);
        
        setTransmissionGraph(tGraph);
        setIsnadRegistry(iRegistry);
        setPersonNetworks(pNetworks);
        setBioNetworks(bNetworks);
        setNamesRegistry(nRegistry);
        setNetworkMetrics(nMetrics);
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Helper function to get filtered graph based on current settings
  const getFilteredGraph = useCallback(() => {
    if (!transmissionGraph) return { nodes: [], links: [] };
    
    let nodes = [...transmissionGraph.nodes];
    let links = [...transmissionGraph.edges];
    
    // Filter by source if needed
    if (filterSource !== 'all') {
      nodes = nodes.filter(n => n.sources.includes(filterSource));
      const nodeIds = new Set(nodes.map(n => n.id));
      links = links.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    }
    
    // Apply view-specific filtering
    if (viewMode === 'transmitter' && selectedNode) {
      const egoNetwork = personNetworks[selectedNode];
      if (egoNetwork) {
        const relevantNodes = new Set([parseInt(selectedNode)]);
        
        // Add nodes based on degree setting
        for (let degree = 1; degree <= showDegree; degree++) {
          const degreeKey = `degree_${degree}`;
          egoNetwork.transmission_network[degreeKey].from.forEach(id => relevantNodes.add(id));
          egoNetwork.transmission_network[degreeKey].to.forEach(id => relevantNodes.add(id));
        }
        
        nodes = nodes.filter(n => relevantNodes.has(n.id));
        links = links.filter(e => relevantNodes.has(e.source) && relevantNodes.has(e.target));
      }
    } else if (viewMode === 'bio-transmission' && selectedBio) {
      const bioNet = bioNetworks[selectedBio];
      if (bioNet) {
        const relevantNodes = new Set();
        
        // Add transmitters by degree
        bioNet.transmission_tree.direct_transmitters.forEach(id => relevantNodes.add(id));
        if (showDegree >= 2) {
          bioNet.transmission_tree.degree_2.forEach(id => relevantNodes.add(id));
        }
        if (showDegree >= 3) {
          bioNet.transmission_tree.degree_3.forEach(id => relevantNodes.add(id));
        }
        
        nodes = nodes.filter(n => relevantNodes.has(n.id));
        links = links.filter(e => relevantNodes.has(e.source) && relevantNodes.has(e.target));
      }
    } else if (viewMode === 'bio-network' && selectedBio) {
      const bioNet = bioNetworks[selectedBio];
      if (bioNet) {
        const relevantNodes = new Set();
        
        // Add all relationship nodes
        Object.values(bioNet.relationships).flat().forEach(id => relevantNodes.add(id));
        
        nodes = nodes.filter(n => relevantNodes.has(n.id));
        // For bio-network view, we might want to create custom edges based on relationships
        // This is simplified - you'd want to create proper relationship edges
        links = links.filter(e => relevantNodes.has(e.source) && relevantNodes.has(e.target));
      }
    }
    
    return { nodes, links };
  }, [transmissionGraph, personNetworks, bioNetworks, viewMode, selectedNode, selectedBio, filterSource, showDegree]);

  // Main D3 visualization effect
  useEffect(() => {
    if (!transmissionGraph || loading) return;
    
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 800;
    
    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();
    
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);
    
    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    
    svg.call(zoom);
    
    // Create main group for zoom/pan
    const g = svg.append('g');
    
    // Get filtered data
    const { nodes, links } = getFilteredGraph();
    
    // Set initial positions for nodes to reduce chaos
    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.3;
      if (!node.x) node.x = width / 2 + Math.cos(angle) * radius;
      if (!node.y) node.y = height / 2 + Math.sin(angle) * radius;
    });
    
    // Create scales
    const nodeScale = d3.scaleSqrt()
      .domain([1, d3.max(nodes, d => d.isnad_count)])
      .range([3, 20]);
    
    const colorScale = d3.scaleOrdinal()
      .domain(['sulami', 'ansari', 'hilya', 'mixed'])
      .range(['#e74c3c', '#3498db', '#2ecc71', '#95a5a6']);
    
    // Create force simulation with better parameters for stability
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links)
        .id(d => d.id)
        .distance(80)  // Fixed distance for more stability
        .strength(0.5))
      .force('charge', d3.forceManyBody()
        .strength(-300)  // Fixed repulsion instead of variable
        .distanceMax(500))  // Limit the range of repulsion
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide()
        .radius(d => nodeScale(d.isnad_count) + 5)
        .strength(0.7))
      .force('x', d3.forceX(width / 2).strength(0.05))  // Gentle centering on X
      .force('y', d3.forceY(height / 2).strength(0.05))  // Gentle centering on Y
      .alphaDecay(0.02)  // Faster cooling
      .alphaMin(0.001)  // Stop sooner
      .velocityDecay(0.4);  // More friction
    
    // Store simulation reference
    simulationRef.current = simulation;
    
    // Stop simulation after a certain time for stability
    setTimeout(() => {
      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0);
      }
    }, 5000); // Stop after 5 seconds
    
    // Add arrow markers for directed edges
    svg.append('defs').selectAll('marker')
      .data(['end'])
      .enter().append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#999');
    
    // Draw links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.sqrt(d.weight))
      .attr('marker-end', viewMode === 'transmitter' ? 'url(#arrow)' : null);
    
    // Draw nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodes)
      .enter().append('circle')
      .attr('r', d => nodeScale(d.isnad_count))
      .attr('fill', d => {
        if (d.sources.length === 1) return colorScale(d.sources[0]);
        return colorScale('mixed');
      })
      .attr('stroke', d => d.has_bio ? '#333' : 'none')
      .attr('stroke-width', d => d.has_bio ? 2 : 0)
      .call(drag(simulation));
    
    // Add labels for important nodes
    const label = g.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodes.filter(d => d.isnad_count > 10 || d.id === parseInt(selectedNode)))
      .enter().append('text')
      .text(d => namesRegistry[d.id]?.canonical || d.name)
      .attr('font-size', 10)
      .attr('dx', d => nodeScale(d.isnad_count) + 3)
      .attr('dy', 3);
    
    // Add tooltips
    const tooltip = d3.select('body').append('div')
      .attr('class', 'network-tooltip')
      .style('opacity', 0);
    
    node.on('mouseover', (event, d) => {
        tooltip.transition().duration(200).style('opacity', .9);
        tooltip.html(getTooltipContent(d))
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', () => {
        tooltip.transition().duration(500).style('opacity', 0);
      })
      .on('click', handleNodeClick);
    
    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      
      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
      
      label
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });
    
    // Drag behavior
    function drag(simulation) {
      function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
      
      function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      }
      
      function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
      
      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }
    
    // Cleanup
    return () => {
      simulation.stop();
      d3.select('body').selectAll('.network-tooltip').remove();
    };
  }, [transmissionGraph, namesRegistry, viewMode, selectedNode, selectedBio, filterSource, showDegree, loading, getFilteredGraph]);

  // Handlers
  const handleNodeClick = (event, d) => {
    setSelectedNode(d.id.toString());
    updateStatsPanel(d);
  };

  const updateStatsPanel = (node) => {
    const person = namesRegistry[node.id];
    const metrics = networkMetrics?.persons[node.id];
    
    setStatsPanel({
      id: node.id,
      name: person?.canonical || node.name,
      variants: person?.variants || [],
      isnadCount: node.isnad_count,
      uniqueChains: node.unique_chains,
      bioTransmissions: node.bio_transmissions,
      sources: node.sources,
      metrics: metrics,
      hasBio: node.has_bio,
      ownBioId: node.own_bio_id
    });
  };

  const getTooltipContent = (d) => {
    const person = namesRegistry[d.id];
    return `
      <strong>${person?.canonical || d.name}</strong><br/>
      Appearances: ${d.isnad_count}<br/>
      Unique chains: ${d.unique_chains}<br/>
      Transmits about: ${d.bio_transmissions.length} people<br/>
      Sources: ${d.sources.join(', ')}
      ${d.has_bio ? '<br/><em>Has own biography</em>' : ''}
    `;
  };

  if (loading) {
    return <div className="loading">Loading network data...</div>;
  }

  return (
    <div className="network-visualization">
      <div className="controls">
        <div className="view-selector">
          <label>View Mode:</label>
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
            <option value="transmission">Transmission Network</option>
            <option value="transmitter">Transmitter Focus</option>
            <option value="bio-transmission">Biography Transmission</option>
            <option value="bio-network">Biography Network</option>
          </select>
        </div>
        
        <div className="source-filter">
          <label>Source:</label>
          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
            <option value="all">All Sources</option>
            <option value="sulami">Al-Sulami</option>
            <option value="ansari">Al-Ansari</option>
            <option value="hilya">Hilya</option>
          </select>
        </div>
        
        <div className="degree-selector">
          <label>Degrees:</label>
          <input 
            type="range" 
            min="1" 
            max="3" 
            value={showDegree}
            onChange={(e) => setShowDegree(parseInt(e.target.value))}
          />
          <span>{showDegree}</span>
        </div>
        
        <div className="freeze-control">
          <button 
            className={frozen ? 'frozen' : 'unfrozen'}
            onClick={() => {
              const newFrozen = !frozen;
              setFrozen(newFrozen);
              if (simulationRef.current) {
                if (newFrozen) {
                  simulationRef.current.stop();
                } else {
                  simulationRef.current.alpha(0.3).restart();
                }
              }
            }}
          >
            {frozen ? '▶ Resume' : '⏸ Freeze'}
          </button>
        </div>
        
        {viewMode === 'transmitter' && (
          <div className="person-selector">
            <label>Select Person:</label>
            <input 
              type="text" 
              placeholder="Enter person ID or name..."
              onChange={(e) => {
                // Implement person search
                const searchTerm = e.target.value;
                // Find person by ID or name
                const found = Object.entries(namesRegistry).find(([id, p]) => 
                  id === searchTerm || p.canonical?.includes(searchTerm)
                );
                if (found) setSelectedNode(found[0]);
              }}
            />
          </div>
        )}
        
        {(viewMode === 'bio-transmission' || viewMode === 'bio-network') && (
          <div className="bio-selector">
            <label>Select Biography:</label>
            <select value={selectedBio} onChange={(e) => setSelectedBio(e.target.value)}>
              <option value="">Choose...</option>
              {Object.entries(bioNetworks).map(([bioId, bio]) => (
                <option key={bioId} value={bioId}>
                  {bio.name_ar || bio.name_lat || `Biography ${bioId}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      <div className="visualization-container" ref={containerRef}>
        <svg ref={svgRef}></svg>
      </div>
      
      {statsPanel && (
        <div className="stats-panel">
          <h3>{statsPanel.name}</h3>
          <div className="stats-content">
            <p><strong>ID:</strong> {statsPanel.id}</p>
            {statsPanel.variants.length > 0 && (
              <p><strong>Also known as:</strong> {statsPanel.variants.slice(0, 3).join(', ')}</p>
            )}
            <p><strong>Total appearances:</strong> {statsPanel.isnadCount}</p>
            <p><strong>Unique chains:</strong> {statsPanel.uniqueChains}</p>
            <p><strong>Transmits about:</strong> {statsPanel.bioTransmissions.length} people</p>
            <p><strong>Sources:</strong> {statsPanel.sources.join(', ')}</p>
            
            {statsPanel.metrics && (
              <div className="metrics">
                <h4>Network Metrics</h4>
                <p><strong>Degree:</strong> {statsPanel.metrics.total_degree}</p>
                <p><strong>Betweenness:</strong> {statsPanel.metrics.betweenness.toFixed(4)}</p>
                <p><strong>PageRank:</strong> {statsPanel.metrics.pagerank.toFixed(4)}</p>
              </div>
            )}
            
            {statsPanel.hasBio && (
              <p><em>Has own biography (#{statsPanel.ownBioId})</em></p>
            )}
            
            {viewMode === 'transmission' && (
              <button onClick={() => {
                setViewMode('transmitter');
                setSelectedNode(statsPanel.id.toString());
              }}>
                Focus on this transmitter
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Network;