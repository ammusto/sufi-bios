import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

/**
 * Social network visualization
 * Radial layout with subject at center
 */
const SocialNetwork = ({ nodes, edges, onNodeClick, selectedNode }) => {
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  
  useEffect(() => {
    if (!nodes || !edges) return;
    
    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;
    
    svg.selectAll('*').remove();
    
    const g = svg.append('g');
    
    // Radial layout
    const nodePositions = new Map();
    const subject = nodes.find(n => n.type === 'subject');
    const associates = nodes.filter(n => n.type === 'associate');
    
    // Center subject
    nodePositions.set(subject.id, { x: width / 2, y: height / 2 });
    
    // Arrange associates in circle with better spacing
    const radius = Math.min(width, height) * 0.35;
    const angleStep = (2 * Math.PI) / associates.length;
    
    associates.forEach((node, i) => {
      const angle = i * angleStep;
      nodePositions.set(node.id, {
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius
      });
    });
    
    // Draw edges
    g.append('g')
      .selectAll('line')
      .data(edges)
      .enter().append('line')
      .attr('x1', d => nodePositions.get(d.source).x)
      .attr('y1', d => nodePositions.get(d.source).y)
      .attr('x2', d => nodePositions.get(d.target).x)
      .attr('y2', d => nodePositions.get(d.target).y)
      .attr('stroke', d => d.color)
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6);
    
    // Draw nodes
    const nodeGs = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .attr('transform', d => {
        const pos = nodePositions.get(d.id);
        return `translate(${pos.x}, ${pos.y})`;
      })
      .style('cursor', d => d.type === 'associate' ? 'pointer' : 'default')
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeClick(d);
      });
    
    nodeGs.append('circle')
      .attr('r', d => d.type === 'subject' ? 35 : 12)
      .attr('fill', d => {
        if (d.type === 'subject') return '#9C27B0';
        if (d.hasId) return '#4CAF50';
        return '#90A4AE';
      })
      .attr('stroke', d => selectedNode?.id === d.id ? '#333' : 'white')
      .attr('stroke-width', d => selectedNode?.id === d.id ? 3 : 2);
    
    // Labels above nodes
    nodeGs.append('text')
      .attr('x', 0)
      .attr('y', d => d.type === 'subject' ? -45 : -18)
      .attr('text-anchor', 'middle')
      .attr('font-size', d => d.type === 'subject' ? '14px' : '10px')
      .attr('font-weight', d => d.type === 'subject' || selectedNode?.id === d.id ? 'bold' : 'normal')
      .attr('fill', '#333')
      .style('text-shadow', '0 0 3px white, 0 0 3px white, 0 0 5px white')
      .text(d => {
        const name = d.name;
        if (d.type === 'subject') return name;
        return name.length > 20 ? name.substring(0, 20) + '...' : name;
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
    
    nodeGs
      .on('mouseenter', (event, d) => {
        if (d.type === 'associate') {
          tooltip.transition().duration(200).style('opacity', 0.9);
          tooltip.html(`
            <strong>${d.name}</strong><br/>
            ${d.hasId ? `<em>Has biography (#${d.hasId})</em><br/>` : ''}
            Sources: ${d.sources.join(', ')}
          `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        }
      })
      .on('mouseleave', () => {
        tooltip.transition().duration(500).style('opacity', 0);
      });
    
    // Zoom
    const zoom = d3.zoom()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);
    
    // Cleanup
    return () => {
      tooltip.remove();
    };
    
  }, [nodes, edges, dimensions, onNodeClick, selectedNode]);
  
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
      className="social-network"
      width="100%"
      height="100%"
    />
  );
};

export default SocialNetwork;