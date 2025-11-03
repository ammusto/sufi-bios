import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

/**
 * Hierarchical graph visualization for aggregated transmission network
 * - One node per person (aggregated across all isnads)
 * - Layered by average position
 * - Edge thickness = number of isnads sharing that connection
 * - Click node = highlight ALL isnads passing through that person
 */
const HierarchicalGraph = ({ nodes, edges, isnads, sourceFilter, onNodeClick, selectedNode }) => {
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [transform, setTransform] = useState(d3.zoomIdentity); // Store zoom state
  
  useEffect(() => {
    if (!nodes || !edges || nodes.length === 0) return;
    
    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;
    
    // Clear previous but preserve transform
    svg.selectAll('*').remove();
    
    // Create main group
    const g = svg.append('g');
    gRef.current = g;
    
    // Apply stored transform
    g.attr('transform', transform);
    
    // Calculate layout
    const layout = calculateAggregatedLayout(nodes, edges, width, height);
    
    // Build isnad membership map for complete highlighting
    const nodeToIsnads = buildIsnadMembership(isnads, sourceFilter, nodes);
    
    // Scales
    const nodeScale = d3.scaleSqrt()
      .domain([1, d3.max(nodes, d => d.isnadCount)])
      .range([6, 25]);
    
    const edgeScale = d3.scaleLinear()
      .domain([1, d3.max(edges, e => e.weight)])
      .range([1, 8]);
    
    // Color scale
    const colorMap = {
      'hilya': '#2ecc71',
      'sulami': '#e74c3c',
      'ansari': '#3498db'
    };
    
    // Draw edges
    const edgeLayer = g.append('g').attr('class', 'edges');
    
    const edgeSel = edgeLayer.selectAll('path')
      .data(edges)
      .enter().append('path')
      .attr('class', 'transmission-edge')
      .attr('d', d => {
        const source = layout.nodePositions.get(d.source);
        const target = layout.nodePositions.get(d.target);
        if (!source || !target) return '';
        
        // Curved path
        const midX = (source.x + target.x) / 2;
        const controlY = (source.y + target.y) / 2;
        
        return `M ${source.x},${source.y} 
                Q ${midX},${controlY} ${target.x},${target.y}`;
      })
      .attr('stroke', '#999')
      .attr('stroke-width', d => edgeScale(d.weight))
      .attr('stroke-opacity', 0.5)
      .attr('fill', 'none')
      .style('cursor', 'pointer');
    
    // Draw nodes
    const nodeLayer = g.append('g').attr('class', 'nodes');
    
    const nodeSel = nodeLayer.selectAll('g')
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
    
    nodeSel.append('circle')
      .attr('class', 'node-circle')
      .attr('r', d => nodeScale(d.isnadCount))
      .attr('fill', d => {
        if (d.hasId) return '#4CAF50'; // Has biography
        return colorMap[d.texts[0]] || '#95a5a6';
      })
      .attr('stroke', d => selectedNode?.id === d.id ? '#333' : '#fff')
      .attr('stroke-width', d => selectedNode?.id === d.id ? 3 : 2);
    
    // Labels for significant nodes
    const labelLayer = g.append('g').attr('class', 'labels');
    
    const labelThreshold = d3.quantile(
      nodes.map(n => n.isnadCount).sort(d3.ascending),
      0.85
    ) || 10;
    
    labelLayer.selectAll('text')
      .data(nodes.filter(d => d.isnadCount >= labelThreshold || selectedNode?.id === d.id))
      .enter().append('text')
      .attr('class', 'node-label')
      .attr('transform', d => {
        const pos = layout.nodePositions.get(d.id);
        return `translate(${pos.x}, ${pos.y})`;
      })
      .attr('x', 0)
      .attr('y', d => -(nodeScale(d.isnadCount) + 8))
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#333')
      .attr('font-weight', d => selectedNode?.id === d.id ? 'bold' : 'normal')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 0 3px white, 0 0 3px white, 0 0 5px white')
      .text(d => {
        const name = d.name || '';
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
      .style('font-size', '12px')
      .style('z-index', '1000');
    
    nodeSel
      .on('mouseenter', (event, d) => {
        const numIsnads = nodeToIsnads.get(d.id)?.size || 0;
        tooltip.transition().duration(150).style('opacity', 0.9);
        tooltip.html(`
          <strong>${d.name}</strong><br/>
          Appearances: ${d.isnadCount}<br/>
          Avg position: ${d.avgPosition.toFixed(1)}<br/>
          ${d.hasId ? `<em>Has biography (#${d.hasId})</em><br/>` : ''}
          <em>Appears in ${numIsnads} unique isnad${numIsnads !== 1 ? 's' : ''}</em>
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseleave', () => {
        tooltip.transition().duration(250).style('opacity', 0);
      });
    
    edgeSel
      .on('mouseenter', (event, d) => {
        tooltip.transition().duration(150).style('opacity', 0.9);
        const sourceNode = nodes.find(n => n.id === d.source);
        const targetNode = nodes.find(n => n.id === d.target);
        tooltip.html(`
          <strong>${sourceNode?.name || 'Unknown'} → ${targetNode?.name || 'Unknown'}</strong><br/>
          Shared isnads: ${d.weight}<br/>
          Unique isnad count: ${d.isnadIds.length}
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseleave', () => {
        tooltip.transition().duration(250).style('opacity', 0);
      });
    
    // COMPLETE ISNAD HIGHLIGHTING
    const applyHighlight = () => {
      if (!selectedNode) {
        // No selection - show all at normal opacity
        edgeSel
          .attr('stroke-opacity', 0.5)
          .attr('stroke-width', d => edgeScale(d.weight));
        nodeSel.selectAll('circle').attr('opacity', 1.0);
        return;
      }
      
      // Get all isnads containing selected node
      const selectedIsnads = nodeToIsnads.get(selectedNode.id) || new Set();
      
      // Collect all nodes in those isnads
      const highlightNodes = new Set([selectedNode.id]);
      selectedIsnads.forEach(isnadId => {
        const isnad = isnads[isnadId];
        if (isnad) {
          isnad.sequence.forEach(pid => highlightNodes.add(pid));
        }
      });
      
      // Collect all edges in those isnads
      const highlightEdges = new Set();
      selectedIsnads.forEach(isnadId => {
        const isnad = isnads[isnadId];
        if (isnad) {
          const seq = isnad.sequence;
          for (let i = 0; i < seq.length - 1; i++) {
            highlightEdges.add(`${seq[i]}->${seq[i+1]}`);
          }
        }
      });
      
      // Apply highlighting
      edgeSel
        .attr('stroke-opacity', d => {
          const edgeKey = `${d.source}->${d.target}`;
          return highlightEdges.has(edgeKey) ? 0.9 : 0.08;
        })
        .attr('stroke-width', d => {
          const edgeKey = `${d.source}->${d.target}`;
          return highlightEdges.has(edgeKey) ? edgeScale(d.weight) * 1.3 : edgeScale(d.weight) * 0.8;
        });
      
      nodeSel.selectAll('circle')
        .attr('opacity', d => highlightNodes.has(d.id) ? 1.0 : 0.15);
    };
    
    applyHighlight();
    
    // Background click to deselect
    svg.on('click', (event) => {
      if (event.target === svg.node()) {
        onNodeClick(null);
      }
    });
    
    // Zoom with transform preservation
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setTransform(event.transform); // Store transform
      });
    
    svg.call(zoom);
    
    // Cleanup
    return () => {
      tooltip.remove();
    };
    
  }, [nodes, edges, isnads, sourceFilter, dimensions, onNodeClick, selectedNode]);
  
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
 * Build map of person_id -> Set of isnad_ids they appear in
 */
function buildIsnadMembership(isnads, sourceFilter, nodes) {
  const nodeToIsnads = new Map();
  
  // Initialize
  nodes.forEach(node => {
    nodeToIsnads.set(node.id, new Set());
  });
  
  // Fill from isnads
  Object.entries(isnads).forEach(([isnadId, isnad]) => {
    // Only include isnads from current source
    if (!isnad.sources.includes(sourceFilter)) return;
    
    isnad.sequence.forEach(personId => {
      if (nodeToIsnads.has(personId)) {
        nodeToIsnads.get(personId).add(isnadId);
      }
    });
  });
  
  return nodeToIsnads;
}

/**
 * Calculate layout for aggregated nodes
 * Layer by average position, spread within layers
 */
function calculateAggregatedLayout(nodes, edges, width, height) {
  // Group nodes by layer (rounded average position)
  const layers = new Map();
  
  nodes.forEach(node => {
    const layer = Math.round(node.avgPosition);
    if (!layers.has(layer)) {
      layers.set(layer, []);
    }
    layers.get(layer).push(node);
  });
  
  // Sort nodes within each layer by isnad count (descending)
  layers.forEach((layerNodes, layer) => {
    layerNodes.sort((a, b) => b.isnadCount - a.isnadCount);
  });
  
  // Calculate positions
  const nodePositions = new Map();
  const layerKeys = Array.from(layers.keys()).sort((a, b) => a - b);
  
  const minLayer = layerKeys[0] || 0;
  const maxLayer = layerKeys[layerKeys.length - 1] || 0;
  const layerRange = maxLayer - minLayer || 1;
  
  const padding = 80;
  const usableWidth = width - 2 * padding;
  const usableHeight = height - 2 * padding;
  
  layerKeys.forEach(layer => {
    const layerNodes = layers.get(layer);
    const numNodes = layerNodes.length;
    
    // X position based on layer
    const x = padding + (layer - minLayer) / layerRange * usableWidth;
    
    // Y positions spread vertically
    const verticalSpacing = Math.min(80, usableHeight / Math.max(numNodes, 1)) + 25;
    const totalHeight = (numNodes - 1) * verticalSpacing;
    const startY = (height - totalHeight) / 2;
    
    layerNodes.forEach((node, idx) => {
      const y = startY + idx * verticalSpacing;
      nodePositions.set(node.id, { x, y });
    });
  });
  
  return { nodePositions, layers };
}

export default HierarchicalGraph;