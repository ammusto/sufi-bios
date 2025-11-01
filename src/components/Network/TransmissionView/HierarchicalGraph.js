import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

/**
 * Hierarchical graph visualization for transmission chains
 * Uses layered layout with position-based Y-axis
 */
const HierarchicalGraph = ({ nodes, edges, onNodeClick, selectedNode }) => {
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  
  useEffect(() => {
    if (!nodes || !edges || nodes.length === 0) return;
    
    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;
    
    // Clear previous
    svg.selectAll('*').remove();
    
    // Create main group
    const g = svg.append('g');
    gRef.current = g;
    
    // Add zoom
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);
    
    // Calculate layout
    const layout = calculateHierarchicalLayout(nodes, edges, width, height);
    
    // Draw edges first (so they're behind nodes)
    const links = g.append('g')
      .attr('class', 'edges')
      .selectAll('path')
      .data(edges)
      .enter().append('path')
      .attr('class', 'transmission-edge')
      .attr('d', d => {
        const source = layout.nodePositions.get(d.source);
        const target = layout.nodePositions.get(d.target);
        if (!source || !target) return '';
        
        // Curved path
        const midX = (source.x + target.x) / 2;
        return `M ${source.x},${source.y} 
                Q ${midX},${source.y} ${midX},${(source.y + target.y) / 2}
                T ${target.x},${target.y}`;
      })
      .attr('stroke', '#999')
      .attr('stroke-width', d => Math.min(3, Math.sqrt(d.bioCount)))
      .attr('stroke-opacity', 0.4)
      .attr('fill', 'none');
    
    // Add bio count badges to edges
    g.append('g')
      .attr('class', 'edge-badges')
      .selectAll('g')
      .data(edges.filter(e => e.bioCount > 1))
      .enter().append('g')
      .attr('transform', d => {
        const source = layout.nodePositions.get(d.source);
        const target = layout.nodePositions.get(d.target);
        if (!source || !target) return '';
        return `translate(${(source.x + target.x) / 2}, ${(source.y + target.y) / 2})`;
      })
      .each(function(d) {
        const g = d3.select(this);
        g.append('circle')
          .attr('r', 10)
          .attr('fill', '#2196F3')
          .attr('stroke', 'white')
          .attr('stroke-width', 2);
        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('fill', 'white')
          .attr('font-size', '10px')
          .attr('font-weight', 'bold')
          .text(`×${d.bioCount}`);
      });
    
    // Draw nodes
    const nodeGroups = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'node-group')
      .attr('transform', d => {
        const pos = layout.nodePositions.get(d.id);
        return `translate(${pos.x}, ${pos.y})`;
      })
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeClick(d);
      });
    
    // Node circles
    nodeGroups.append('circle')
      .attr('class', 'node-circle')
      .attr('r', d => Math.min(25, Math.max(5, Math.sqrt(d.totalChains))))
      .attr('fill', d => {
        if (d.hasId) return '#4CAF50'; // Has biography
        if (d.texts.length > 1) return '#FF9800'; // Multi-source
        if (d.texts.includes('sulami')) return '#e74c3c';
        if (d.texts.includes('ansari')) return '#3498db';
        if (d.texts.includes('hilya')) return '#2ecc71';
        return '#95a5a6';
      })
      .attr('stroke', d => selectedNode?.id === d.id ? '#333' : '#fff')
      .attr('stroke-width', d => selectedNode?.id === d.id ? 3 : 1.5);
    
    // Node labels (for nodes with 2+ chains or selected)
    nodeGroups.filter(d => d.totalChains >= 100 || selectedNode?.id === d.id)
      .append('text')
      .attr('class', 'node-label')
      .attr('x', 0)
      .attr('y', d => -(Math.min(25, Math.max(5, Math.sqrt(d.totalChains))) + 8))
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#333')
      .attr('font-weight', d => selectedNode?.id === d.id ? 'bold' : 'normal')
      .style('text-shadow', '0 0 3px white, 0 0 3px white, 0 0 3px white, 0 0 5px white')
      .text(d => {
        const name = d.name || `Person ${d.personId}`;
        return name.length > 30 ? name.substring(0, 30) + '...' : name;
      });
    
    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'network-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', 'rgba(0,0,0,0.8)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px');
    
    nodeGroups
      .on('mouseenter', (event, d) => {
        tooltip.transition().duration(200).style('opacity', 0.9);
        tooltip.html(`
          <strong>${d.name}</strong><br/>
          Position: ${d.position}<br/>
          Chains: ${d.totalChains}<br/>
          ${d.hasId ? `<em>Has biography (#${d.hasId})</em>` : ''}
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseleave', () => {
        tooltip.transition().duration(500).style('opacity', 0);
      });
    
    // Cleanup
    return () => {
      tooltip.remove();
    };
  }, [nodes, edges, dimensions, onNodeClick, selectedNode]);
  
  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current) {
        const { width, height } = svgRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return (
    <svg 
      ref={svgRef}
      className="hierarchical-graph"
      width="100%"
      height="100%"
    />
  );
};

/**
 * Calculate hierarchical layout positions
 * Y-axis based on position in chain (0 = bottom, higher = top)
 * X-axis spread nodes within same level
 */
function calculateHierarchicalLayout(nodes, edges, width, height) {
  // Group nodes by position
  const levels = new Map();
  nodes.forEach(node => {
    if (!levels.has(node.position)) {
      levels.set(node.position, []);
    }
    levels.get(node.position).push(node);
  });
  
  // Calculate positions
  const nodePositions = new Map();
  const maxPosition = Math.max(...nodes.map(n => n.position));
  const levelHeight = height / (maxPosition + 2);
  
  levels.forEach((levelNodes, position) => {
    const y = height - ((position + 1) * levelHeight); // Bottom to top
    
    // Increased spacing - use more of the width and add padding
    const levelWidth = width * 0.9; // Use 90% of width instead of 80%
    const startX = (width - levelWidth) / 2;
    
    // Calculate spacing based on number of nodes
    // Add minimum spacing to prevent overlap
    const minSpacing = 150; // Minimum pixels between nodes
    const calculatedSpacing = levelWidth / (levelNodes.length + 2);
    const nodeSpacing = Math.max(minSpacing, calculatedSpacing);
    
    // If nodes would overflow, scale down
    const totalWidth = nodeSpacing * (levelNodes.length + 1);
    const scale = totalWidth > levelWidth ? levelWidth / totalWidth : 1;
    
    levelNodes.forEach((node, index) => {
      const x = startX + ((index + 1) * nodeSpacing * scale);
      nodePositions.set(node.id, { x, y });
    });
  });
  
  return { nodePositions, levels };
}

export default HierarchicalGraph;