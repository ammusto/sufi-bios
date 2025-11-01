import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';

const NetworkVisualization = React.memo(({
  nodes,
  edges,
  viewType,
  onNodeClick,
  onEdgeClick,
  onNodeHover,
  selectedNode,
  hoveredNode
}) => {
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const nodesRef = useRef(null);
  const edgesRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Memoize processed data
  const layoutData = useMemo(() => {
    if (!nodes || !edges || nodes.length === 0) return null;
    
    const { width, height } = dimensions;
    
    // Clone data
    const nodeCopy = nodes.map(d => ({...d}));
    const edgeCopy = edges.map(d => ({...d}));
    const maxWeight = Math.max(...edgeCopy.map(e => e.total_weight || 1));
    
    // Create node map for quick lookup
    const nodeMap = new Map();
    nodeCopy.forEach(n => nodeMap.set(n.id, n));
    
    // Check if we have positions
    const hasPositions = nodeCopy.every(n => n.x !== undefined && n.y !== undefined);
    
    if (!hasPositions) {
      // Create simulation for layout calculation
      const sim = d3.forceSimulation(nodeCopy)
        .force('link', d3.forceLink(edgeCopy)
          .id(d => d.id)
          .distance(100)
          .strength(0.5))
        .force('charge', d3.forceManyBody()
          .strength(-500)
          .distanceMax(300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide()
          .radius(d => Math.max(8, Math.sqrt(d.total_weight || 1) * 3)))
        .stop();
      
      // Run simulation
      for (let i = 0; i < 120; i++) {
        sim.tick();
      }
    }
    
    // Fix positions
    nodeCopy.forEach(node => {
      node.fx = node.x;
      node.fy = node.y;
    });
    
    // After simulation, edges have source/target as objects
    // We need to handle both cases (ID or object)
    const processedEdges = edgeCopy.map(edge => ({
      ...edge,
      sourceNode: typeof edge.source === 'object' ? edge.source : nodeMap.get(edge.source),
      targetNode: typeof edge.target === 'object' ? edge.target : nodeMap.get(edge.target)
    }));
    
    return { 
      nodes: nodeCopy, 
      edges: processedEdges, 
      maxWeight,
      nodeMap 
    };
  }, [nodes, edges, dimensions]);

  // Initialize visualization
  useEffect(() => {
    if (!layoutData || isInitialized) return;
    
    const svg = d3.select(svgRef.current);
    const { nodes: nodeCopy, edges: edgeCopy, maxWeight } = layoutData;
    
    // Clear previous
    svg.selectAll('*').remove();
    
    // Create main group
    const g = svg.append('g');
    gRef.current = g;
    
    // Add zoom
    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    
    svg.call(zoom);
    
    // Define markers
    svg.append('defs').selectAll('marker')
      .data(['arrow', 'arrow-highlighted'])
      .enter().append('marker')
      .attr('id', d => d)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', d => d === 'arrow-highlighted' ? '#1976d2' : '#999');
    
    // Create edges FIRST (so they appear behind nodes)
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(edgeCopy)
      .enter().append('line')
      .attr('class', 'network-edge')
      .attr('x1', d => d.sourceNode ? d.sourceNode.x : 0)
      .attr('y1', d => d.sourceNode ? d.sourceNode.y : 0)
      .attr('x2', d => d.targetNode ? d.targetNode.x : 0)
      .attr('y2', d => d.targetNode ? d.targetNode.y : 0)
      .attr('stroke', d => {
        if (d.relationship_type) {
          const colors = {
            'teachers': '#4CAF50',
            'students': '#2196F3',
            'companions': '#FF9800',
            'associates': '#9C27B0'
          };
          return colors[d.relationship_type] || '#999';
        }
        return '#999';
      })
      .attr('stroke-width', d => Math.max(1, Math.sqrt(d.total_weight || 1)))
      .attr('stroke-opacity', d => {
        const weight = d.total_weight || 1;
        return Math.min(0.8, Math.max(0.1, weight / maxWeight));
      })
      .attr('marker-end', d => d.total_weight > 5 ? 'url(#arrow)' : null)
      .on('click', (event, d) => {
        event.stopPropagation();
        onEdgeClick(d);
      })
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke-opacity', 1)
          .attr('stroke-width', Math.max(2, Math.sqrt(d.total_weight || 1) * 1.5));
      })
      .on('mouseout', function(event, d) {
        const weight = d.total_weight || 1;
        d3.select(this)
          .attr('stroke-opacity', Math.min(0.8, Math.max(0.1, weight / maxWeight)))
          .attr('stroke-width', Math.max(1, Math.sqrt(weight)));
      });
    
    edgesRef.current = link;
    
    // Create nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodeCopy)
      .enter().append('circle')
      .attr('class', 'network-node')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => {
        if (d.is_bio) return 20;
        if (d.focused) return 15;
        return Math.min(30, Math.max(5, Math.sqrt(d.total_weight || 1) * 2));
      })
      .attr('fill', d => {
        if (d.is_bio) return '#f44336';
        if (d.has_bio) return '#4CAF50';
        if (d.focused) return '#2196F3';
        if (d.direction === 'from') return '#FF9800';
        if (d.direction === 'to') return '#9C27B0';
        return '#666';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer');
    
    nodesRef.current = node;
    
    // Add labels for large nodes
    const labels = g.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodeCopy.filter(d => {
        if (d.is_bio || d.focused) return true;
        const size = Math.sqrt(d.total_weight || 1) * 2;
        return size >= 10;
      }))
      .enter().append('text')
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .attr('dx', 12)
      .attr('dy', '.35em')
      .text(d => {
        const name = d.name || `Person ${d.id}`;
        return name.length > 20 ? name.substring(0, 20) + '...' : name;
      })
      .style('font-size', '9px')
      .style('fill', '#333')
      .style('pointer-events', 'none')
      .style('user-select', 'none');
    
    // Add tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'network-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '10px')
      .style('border-radius', '4px')
      .style('font-size', '12px');
    
    // Simple drag
    const drag = d3.drag()
      .on('drag', function(event, d) {
        d.x = event.x;
        d.y = event.y;
        d.fx = event.x;
        d.fy = event.y;
        
        // Update node position
        d3.select(this).attr('cx', d.x).attr('cy', d.y);
        
        // Update connected edges
        link.each(function(l) {
          if (l.sourceNode === d) {
            d3.select(this).attr('x1', d.x).attr('y1', d.y);
          }
          if (l.targetNode === d) {
            d3.select(this).attr('x2', d.x).attr('y2', d.y);
          }
        });
        
        // Update label
        labels.filter(l => l === d)
          .attr('x', d.x)
          .attr('y', d.y);
      });
    
    node.call(drag);
    
    // Event handlers
    node.on('click', (event, d) => {
      event.stopPropagation();
      onNodeClick(d);
    })
    .on('mouseenter', (event, d) => {
      onNodeHover(d);
      tooltip.transition().duration(200).style('opacity', .9);
      tooltip.html(`
        <strong>${d.name || `Person ${d.id}`}</strong><br/>
        ${d.is_bio ? 'Biography' : `ID: ${d.id}`}<br/>
        Weight: ${d.total_weight || 0}<br/>
        ${d.death_date ? `Death: ${d.death_date.year_hijri || 'Unknown'}` : ''}
      `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseleave', () => {
      onNodeHover(null);
      tooltip.transition().duration(500).style('opacity', 0);
    });
    
    setIsInitialized(true);
    
    // Cleanup
    return () => {
      tooltip.remove();
    };
  }, [layoutData, isInitialized, onNodeClick, onEdgeClick, onNodeHover]);

  // Update visual properties when selection changes
  useEffect(() => {
    if (!isInitialized || !nodesRef.current) return;
    
    nodesRef.current
      .attr('stroke', function(d) {
        if (selectedNode && d.id === selectedNode.id) return '#1976d2';
        if (hoveredNode && d.id === hoveredNode.id) return '#333';
        return '#fff';
      })
      .attr('stroke-width', function(d) {
        if (selectedNode && d.id === selectedNode.id) return 3;
        if (hoveredNode && d.id === hoveredNode.id) return 2;
        return 1;
      });
  }, [selectedNode, hoveredNode, isInitialized]);

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const { width, height } = svgRef.current.getBoundingClientRect();
        setDimensions({ width, height });
        setIsInitialized(false);
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  return (
    <svg 
      ref={svgRef}
      className="network-svg"
      width="100%"
      height="100%"
    />
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.nodes === nextProps.nodes &&
    prevProps.edges === nextProps.edges &&
    prevProps.viewType === nextProps.viewType &&
    prevProps.selectedNode?.id === nextProps.selectedNode?.id &&
    prevProps.hoveredNode?.id === nextProps.hoveredNode?.id
  );
});

NetworkVisualization.displayName = 'NetworkVisualization';

export default NetworkVisualization;