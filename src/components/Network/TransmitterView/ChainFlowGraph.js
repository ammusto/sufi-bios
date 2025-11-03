import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

/**
 * ChainFlowGraph — layered, curved edges, click-only highlighting,
 * multi-column packing for dense ±1 layers.
 * 
 * FIXES:
 * - Preserve zoom transform (no re-centering on selection)
 * - Fix x# label to show unique isnad count (not weighted degree)
 * - Improved barycenter positioning to reduce edge crossover
 */
const ChainFlowGraph = ({ data, isnadDetails, onNodeClick, selectedNode, showPeerConnections = true }) => {
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [transform, setTransform] = useState(d3.zoomIdentity); // Store zoom state

  useEffect(() => {
    if (!data || !data.nodes || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;

    svg.selectAll('*').remove();

    const g = svg.append('g');
    
    // Apply stored transform
    g.attr('transform', transform);

    // Background to capture whitespace clicks
    g.append('rect')
      .attr('x', 0).attr('y', 0).attr('width', width).attr('height', height)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all')
      .on('click', () => onNodeClick?.(null));

    // Markers
    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#999');

    // Layout
    const layout = calculateLayoutWithFirstLayerColumns(data, width, height);
    const centerId = data.centerPersonId;

    // FIX: Calculate UNIQUE isnad count per person (not weighted degree)
    const personToUniqueIsnads = new Map();
    if (isnadDetails) {
      isnadDetails.forEach(detail => {
        const pid = detail.full_isnad[detail.position];
        if (!personToUniqueIsnads.has(pid)) {
          personToUniqueIsnads.set(pid, new Set());
        }
        personToUniqueIsnads.get(pid).add(detail.isnad_id);
      });
    }

    // Calculate weights for edge thickness only
    const inW  = new Map(data.nodes.map(n => [n.id, 0]));
    const outW = new Map(data.nodes.map(n => [n.id, 0]));
    data.edges.forEach(e => {
      const w = e.weight ?? 1;
      outW.set(e.source, (outW.get(e.source) ?? 0) + w);
      inW .set(e.target, (inW .get(e.target) ?? 0) + w);
    });

    const weightedDegree = new Map(
      data.nodes.map(n => [n.id, (inW.get(n.id) ?? 0) + (outW.get(n.id) ?? 0)])
    );

    const degVals = Array.from(weightedDegree.values());
    const rScale = d3.scaleSqrt()
      .domain([Math.min(...degVals, 0), Math.max(...degVals, 1)])
      .range([6, 26]);

    const radiusOf = new Map(
      data.nodes.map(n => {
        const w = weightedDegree.get(n.id) ?? 0;
        const r = (n.id === centerId || n.type === 'center') ? Math.max(20, rScale(w)) : rScale(w);
        return [n.id, r];
      })
    );

    // Build isnad membership map for complete isnad highlighting
    const nodeToIsnads = new Map(data.nodes.map(n => [n.id, new Set()]));
    const isnadToNodes = new Map();
    const isnadToEdges = new Map();
    
    if (isnadDetails) {
      isnadDetails.forEach((detail, isnadIdx) => {
        const { full_isnad } = detail;
        const isnadId = `isnad_${isnadIdx}`;
        
        // Track nodes in this isnad
        isnadToNodes.set(isnadId, new Set(full_isnad));
        
        // Track edges in this isnad
        const isnadEdges = new Set();
        for (let i = 0; i < full_isnad.length - 1; i++) {
          const edgeKey = `${full_isnad[i]}->${full_isnad[i + 1]}`;
          isnadEdges.add(edgeKey);
        }
        isnadToEdges.set(isnadId, isnadEdges);
        
        // Map each node to isnads it belongs to
        full_isnad.forEach(nodeId => {
          nodeToIsnads.get(nodeId)?.add(isnadId);
        });
      });
    }

    // Separate hierarchical edges from peer edges
    const hierarchicalEdges = [];
    const peerEdges = [];
    
    data.edges.forEach(edge => {
      const sLayer = layout.layerOf.get(edge.source);
      const tLayer = layout.layerOf.get(edge.target);
      
      if (!Number.isFinite(sLayer) || !Number.isFinite(tLayer)) {
        hierarchicalEdges.push(edge);
        return;
      }
      
      const layerDiff = Math.abs(sLayer - tLayer);
      
      // Adjacent levels (L to L±1) = hierarchical isnad
      if (layerDiff === 1) {
        hierarchicalEdges.push(edge);
      } else {
        // Same level OR skips levels = peer connection
        peerEdges.push(edge);
      }
    });

    // EDGES
    const edgeLayer = g.append('g').attr('class', 'edges');
    
    // Draw hierarchical edges (always shown)
    const hierarchicalEdgeSel = edgeLayer.selectAll('path.hierarchical-edge')
      .data(hierarchicalEdges)
      .enter()
      .append('path')
      .attr('class', 'edge hierarchical-edge')
      .attr('d', d => {
        const s = layout.nodePositions.get(d.source);
        const t = layout.nodePositions.get(d.target);
        if (!s || !t) return '';
        const rs = radiusOf.get(d.source) ?? 6;
        const rt = radiusOf.get(d.target) ?? 6;
        const sL = layout.layerOf.get(d.source);
        const tL = layout.layerOf.get(d.target);
        const sameLayer = Number.isFinite(sL) && sL === tL;
        return sameLayer
          ? peerCurvePath(s, t, rs, rt, { layer: sL })
          : interLayerCurvePath(s, t, rs, rt);
      })
      .attr('stroke', '#999')
      .attr('stroke-width', 1.6)
      .attr('stroke-opacity', 0.55)
      .attr('fill', 'none')
      .attr('marker-end', 'url(#arrow)');

    // Draw peer edges (toggleable - same level or level-skipping)
    const peerEdgeSel = edgeLayer.selectAll('path.peer-edge')
      .data(showPeerConnections ? peerEdges : [])
      .enter()
      .append('path')
      .attr('class', 'edge peer-edge')
      .attr('d', d => {
        const s = layout.nodePositions.get(d.source);
        const t = layout.nodePositions.get(d.target);
        if (!s || !t) return '';
        const rs = radiusOf.get(d.source) ?? 6;
        const rt = radiusOf.get(d.target) ?? 6;
        const sL = layout.layerOf.get(d.source);
        const tL = layout.layerOf.get(d.target);
        const sameLayer = Number.isFinite(sL) && sL === tL;
        return sameLayer
          ? peerCurvePath(s, t, rs, rt, { layer: sL })
          : interLayerCurvePath(s, t, rs, rt);
      })
      .attr('stroke', '#FF9800')  // Orange for peer
      .attr('stroke-width', 1.4)
      .attr('stroke-opacity', 0.4)
      .attr('fill', 'none')
      .attr('stroke-dasharray', '4,2')  // Dashed
      .attr('marker-end', 'url(#arrow)');

    // Combine for highlighting
    const allEdges = [...hierarchicalEdgeSel.nodes(), ...peerEdgeSel.nodes()];
    const edgeSel = d3.selectAll(allEdges);

    // NODES
    const nodeLayer = g.append('g').attr('class', 'nodes');
    const nodeSel = nodeLayer.selectAll('g.node')
      .data(data.nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => {
        const p = layout.nodePositions.get(d.id);
        return `translate(${p.x}, ${p.y})`;
      })
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeClick?.(d);
      });

    nodeSel.append('circle')
      .attr('r', d => radiusOf.get(d.id) ?? 8)
      .attr('fill', d => {
        if (d.type === 'center' || d.id === centerId) return '#FF5722';
        if (d.hasId) return '#4CAF50';
        if (d.isUpstream) return '#81C784';
        if (d.isDownstream) return '#64B5F6';
        return '#999';
      })
      .attr('stroke', d => selectedNode?.id === d.id ? '#333' : '#fff')
      .attr('stroke-width', d => selectedNode?.id === d.id ? 3 : 2);

    // LABELS - FIX: Show unique isnad count
    const pct = 0.9;
    const inP  = d3.quantile([...inW.values()].sort(d3.ascending), pct)  ?? 0;
    const outP = d3.quantile([...outW.values()].sort(d3.ascending), pct) ?? 0;

    const showLabel = d =>
      d.id === centerId ||
      selectedNode?.id === d.id ||
      (inW.get(d.id)  ?? 0) >= inP ||
      (outW.get(d.id) ?? 0) >= outP;

    const labelLayer = g.append('g').attr('class', 'labels');
    labelLayer.selectAll('text.label')
      .data(data.nodes.filter(showLabel))
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('transform', d => {
        const p = layout.nodePositions.get(d.id);
        return `translate(${p.x}, ${p.y})`;
      })
      .attr('x', 0)
      .attr('y', d => (d.id === centerId || d.type === 'center') ? -28 : -15)
      .attr('text-anchor', 'middle')
      .attr('font-size', d => (d.id === centerId || d.type === 'center') ? '14px' : '11px')
      .attr('font-weight', 'bold')
      .attr('fill', '#333')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 0 3px white, 0 0 3px white, 0 0 5px white')
      .text(d => {
        const name = d.name || '';
        const base = (d.id === centerId || d.type === 'center') ? name : (name.length > 25 ? name.slice(0, 25) + '…' : name);
        // FIX: Use unique isnad count instead of weighted degree
        const uniqueIsnadCount = personToUniqueIsnads.get(d.id)?.size || 0;
        return uniqueIsnadCount > 1 ? `${base} ×${uniqueIsnadCount}` : base;
      });

    // TOOLTIP
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
        const win  = inW.get(d.id)  ?? 0;
        const wout = outW.get(d.id) ?? 0;
        const wtot = weightedDegree.get(d.id) ?? 0;
        const layer = layout.layerOf.get(d.id);
        const numIsnads = nodeToIsnads.get(d.id)?.size || 0;
        const uniqueIsnadCount = personToUniqueIsnads.get(d.id)?.size || 0;
        
        tooltip.transition().duration(150).style('opacity', 0.9);
        tooltip.html(`
          <strong>${d.name || 'Unknown'}</strong><br/>
          ${(d.id === centerId || d.type === 'center') ? '<em>Focus Person</em><br/>' : ''}
          ${Number.isFinite(layer) ? `Layer: ${layer > 0 ? '+' : ''}${layer}<br/>` : ''}
          ${d.hasId ? `<em>Has biography (#${d.hasId})</em><br/>` : ''}
          Unique isnads: ${uniqueIsnadCount}<br/>
          Upstream (in): ${win}<br/>
          Downstream (out): ${wout}<br/>
          <em>Appears in ${numIsnads} isnad${numIsnads !== 1 ? 's' : ''}</em>
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseleave', () => {
        tooltip.transition().duration(250).style('opacity', 0);
      });

    // COMPLETE ISNAD HIGHLIGHTING
    const applyHighlight = () => {
      const activeId = selectedNode?.id || null;
      if (!activeId) {
        // No selection - show all at normal opacity
        hierarchicalEdgeSel
          .attr('stroke-opacity', 0.55)
          .attr('stroke-width', 1.6);
        peerEdgeSel
          .attr('stroke-opacity', 0.4)
          .attr('stroke-width', 1.4);
        nodeSel.selectAll('circle').attr('opacity', 1.0);
        return;
      }

      // Get all isnads that contain the selected node
      const selectedIsnads = nodeToIsnads.get(activeId) || new Set();
      
      // Collect all nodes in those isnads
      const highlightNodes = new Set([activeId]);
      selectedIsnads.forEach(isnadId => {
        const nodesInIsnad = isnadToNodes.get(isnadId);
        if (nodesInIsnad) {
          nodesInIsnad.forEach(nodeId => highlightNodes.add(nodeId));
        }
      });
      
      // Collect all edges in those isnads
      const highlightEdgeKeys = new Set();
      selectedIsnads.forEach(isnadId => {
        const edgesInIsnad = isnadToEdges.get(isnadId);
        if (edgesInIsnad) {
          edgesInIsnad.forEach(edgeKey => highlightEdgeKeys.add(edgeKey));
        }
      });

      // Highlight hierarchical edges
      hierarchicalEdgeSel
        .attr('stroke-opacity', d => {
          const edgeKey = `${d.source}->${d.target}`;
          return highlightEdgeKeys.has(edgeKey) ? 0.95 : 0.12;
        })
        .attr('stroke-width', d => {
          const edgeKey = `${d.source}->${d.target}`;
          return highlightEdgeKeys.has(edgeKey) ? 2.6 : 1.1;
        });

      // Highlight peer edges
      peerEdgeSel
        .attr('stroke-opacity', d => {
          const edgeKey = `${d.source}->${d.target}`;
          return highlightEdgeKeys.has(edgeKey) ? 0.85 : 0.08;
        })
        .attr('stroke-width', d => {
          const edgeKey = `${d.source}->${d.target}`;
          return highlightEdgeKeys.has(edgeKey) ? 2.4 : 1.0;
        });

      // Highlight nodes
      nodeSel.selectAll('circle')
        .attr('opacity', nd => highlightNodes.has(nd.id) ? 1.0 : 0.2);
    };
    applyHighlight();

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

  }, [data, isnadDetails, dimensions, onNodeClick, selectedNode, showPeerConnections, transform]);

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

  return <svg ref={svgRef} className="chain-flow-graph" width="100%" height="100%" />;
};

/* ============================== curved edge routing ============================== */

function interLayerCurvePath(s, t, rs, rt) {
  if (!s || !t) return '';
  const PAD = 8;
  const dir = Math.sign(t.x - s.x) || 1;
  const s0 = { x: s.x + dir * (rs + PAD), y: s.y };
  const t0 = { x: t.x - dir * (rt + PAD), y: t.y };
  const dx = Math.max(40, Math.abs(t0.x - s0.x) * 0.35);
  const dy = Math.abs(t0.y - s0.y);
  const spread = 0.15 * dy;
  const c1 = { x: s0.x + dir * dx, y: s0.y + (t0.y > s0.y ? +spread : -spread) };
  const c2 = { x: t0.x - dir * dx, y: t0.y + (t0.y > s0.y ? -spread : +spread) };
  return `M${s0.x},${s0.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${t0.x},${t0.y}`;
}

function peerCurvePath(s, t, rs, rt, { layer }) {
  if (!s || !t) return '';
  const PAD = 8;
  const dir = layer >= 0 ? 1 : -1;
  const s0 = { x: s.x + dir * (rs + PAD), y: s.y };
  const t0 = { x: t.x + dir * (rt + PAD), y: t.y };
  const dy = Math.abs(t0.y - s0.y);
  const dx = 40 + 0.25 * dy;
  const c1 = { x: s0.x + dir * dx, y: s0.y };
  const c2 = { x: t0.x + dir * dx, y: t0.y };
  return `M${s0.x},${s0.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${t0.x},${t0.y}`;
}

/* ============================== IMPROVED layout with better barycenter ============================== */

function calculateLayoutWithFirstLayerColumns(data, width, height) {
  const { nodes, edges, centerPersonId } = data;

  const outgoing = new Map(), incoming = new Map();
  nodes.forEach(n => { outgoing.set(n.id, []); incoming.set(n.id, []); });
  edges.forEach(e => { outgoing.get(e.source).push(e.target); incoming.get(e.target).push(e.source); });

  const center = centerPersonId;

  const bfs = (start, nbrs) => {
    const dist = new Map(nodes.map(n => [n.id, Infinity]));
    const q = [start]; dist.set(start, 0);
    while (q.length) {
      const u = q.shift();
      for (const v of nbrs.get(u)) if (dist.get(v) === Infinity) {
        dist.set(v, dist.get(u) + 1); q.push(v);
      }
    }
    return dist;
  };

  const fwd = bfs(center, outgoing);
  const back = bfs(center, incoming);

  const layerOf = new Map();
  nodes.forEach(n => {
    if (n.id === center) return layerOf.set(n.id, 0);
    const fd = fwd.get(n.id), bd = back.get(n.id);
    const hasF = fd !== Infinity, hasB = bd !== Infinity;
    if (hasF && !hasB) layerOf.set(n.id, +fd);
    else if (!hasF && hasB) layerOf.set(n.id, -bd);
    else if (hasF && hasB) layerOf.set(n.id, +fd);
    else layerOf.set(n.id, 9999);
  });

  const layers = new Map();
  nodes.forEach(n => {
    const L = layerOf.get(n.id);
    if (!layers.has(L)) layers.set(L, []);
    layers.get(L).push(n.id);
  });

  const nameOf = new Map(nodes.map(n => [n.id, n.name || '']));
  const degree = new Map(nodes.map(n => [n.id, incoming.get(n.id).length + outgoing.get(n.id).length]));
  
  // Initial sort by degree for center layer
  if (layers.has(0)) {
    const arr0 = layers.get(0);
    arr0.sort((a,b) => {
      const da = degree.get(a), db = degree.get(b);
      if (db !== da) return db - da;
      return nameOf.get(a).localeCompare(nameOf.get(b), 'en');
    });
  }

  const W = width, H = height;
  const centerX = W / 2, centerY = H / 2;
  const colPad = 80, baseDx = 160;
  const nodePositions = new Map();
  const nodeY = new Map();

  // Initialize center position
  nodePositions.set(center, { x: centerX, y: centerY });
  nodeY.set(center, centerY);
  
  // Place center layer with vertical spacing
  if (layers.has(0)) {
    const arr0 = layers.get(0);
    const idx0 = arr0.indexOf(center);
    if (idx0 > 0) { arr0.splice(idx0,1); arr0.unshift(center); }
    if (arr0.length > 1) {
      const vs = 42, start = centerY - ((arr0.length-1)*vs)/2;
      arr0.forEach((id,i) => { if (id !== center) nodeY.set(id, start + i*vs); });
      arr0.forEach(id => {
        if (!nodePositions.has(id)) nodePositions.set(id, { x: centerX + 2, y: nodeY.get(id) ?? centerY });
      });
    }
  }

  // Helper: calculate barycenter (average Y position of neighbors)
  const calculateBarycenter = (nodeId, neighborIds) => {
    const neighborYs = neighborIds
      .map(nid => nodeY.get(nid))
      .filter(y => y !== undefined);
    
    if (neighborYs.length === 0) return null;
    return neighborYs.reduce((sum, y) => sum + y, 0) / neighborYs.length;
  };

  // Helper: order layer by barycenter to minimize crossings
  const orderLayerByBarycenter = (layerIds, neighborMap) => {
    const barycenters = layerIds.map(id => {
      const neighbors = neighborMap.get(id) || [];
      const bc = calculateBarycenter(id, neighbors);
      return { id, barycenter: bc };
    });

    // Sort by barycenter (nulls at end)
    barycenters.sort((a, b) => {
      if (a.barycenter === null && b.barycenter === null) {
        // Both have no positioned neighbors, sort by degree then name
        const da = degree.get(a.id), db = degree.get(b.id);
        if (db !== da) return db - da;
        return nameOf.get(a.id).localeCompare(nameOf.get(b.id), 'en');
      }
      if (a.barycenter === null) return 1;
      if (b.barycenter === null) return -1;
      return a.barycenter - b.barycenter;
    });

    return barycenters.map(item => item.id);
  };

  const layer0 = layers.get(0) || [center];

  const packFirstLayer = (L) => {
    if (!layers.has(L)) return;
    let ids = layers.get(L).slice();
    if (!ids.length) return;

    const side = (L > 0) ? +1 : -1;
    const neighborMap = (L > 0) ? incoming : outgoing;

    // Order by barycenter to minimize crossings
    ids = orderLayerByBarycenter(ids, neighborMap);

    const rowSpacing = 38;
    const targetRows = Math.min(24, Math.max(8, Math.floor(0.9 * H / rowSpacing)));
    const K = Math.max(1, Math.ceil(ids.length / targetRows));

    const baseX = side === 1 ? (centerX + (baseDx + colPad)) : (centerX - (baseDx + colPad));
    const colGap = 120;
    const xForCol = (c) => baseX + side * (c * colGap);

    // Assign to columns while trying to keep similar Y positions together
    const cols = Array.from({ length: K }, () => ({ members: [] }));
    
    ids.forEach((id, i) => {
      const colIdx = Math.floor(i / targetRows) % K;
      cols[colIdx].members.push(id);
    });

    cols.forEach((c, ci) => {
      const n = c.members.length;
      if (!n) return;
      const total = (n - 1) * rowSpacing;
      let start = centerY - total / 2;
      c.members.forEach((id, j) => {
        const y = start + j * rowSpacing;
        nodeY.set(id, y);
        nodePositions.set(id, { x: xForCol(ci), y });
      });
    });
  };

  packFirstLayer(-1);
  packFirstLayer(+1);

  const verticalSpread = n => Math.max(46, Math.min(110, (H * 0.9) / Math.max(1,n)));

  const placeOuter = (L) => {
    if (!layers.has(L)) return;
    let ids = layers.get(L);
    if (!ids.length) return;

    const x = (L < 0)
      ? centerX - (Math.abs(L) * baseDx + colPad)
      : centerX + (Math.abs(L) * baseDx + colPad);

    const neighborMap = (L > 0) ? incoming : outgoing;

    // Order by barycenter to minimize crossings
    const orderedIds = orderLayerByBarycenter(ids, neighborMap);
    
    const vs = verticalSpread(orderedIds.length);
    const total = (orderedIds.length - 1) * vs;
    let start = centerY - total / 2;
    
    orderedIds.forEach((id, i) => {
      const y = start + i * vs;
      nodeY.set(id, y);
      nodePositions.set(id, { x, y });
    });
  };

  const layerKeys = [...layers.keys()];
  const posLayers = layerKeys.filter(L => L > 1).sort((a,b)=>a-b);
  const negLayers = layerKeys.filter(L => L < -1).sort((a,b)=>b-a);
  posLayers.forEach(placeOuter);
  negLayers.forEach(placeOuter);

  // Iterative refinement: multiple passes to minimize crossings
  const allLayersSorted = layerKeys
    .filter(L => L !== 0)
    .sort((a,b) => Math.abs(a) - Math.abs(b));
  
  // Do 5 refinement passes (increased from 3 for better edge optimization)
  for (let pass = 0; pass < 5; pass++) {
    // Forward pass (from center outward)
    allLayersSorted.forEach(L => {
      if (!layers.has(L)) return;
      const ids = layers.get(L);
      const neighborMap = (L > 0) ? incoming : outgoing;
      
      const orderedIds = orderLayerByBarycenter(ids, neighborMap);
      
      // Update Y positions maintaining same vertical spacing
      const vs = verticalSpread(orderedIds.length);
      const total = (orderedIds.length - 1) * vs;
      let start = centerY - total / 2;
      
      orderedIds.forEach((id, i) => {
        const y = start + i * vs;
        nodeY.set(id, y);
        const pos = nodePositions.get(id);
        if (pos) pos.y = y;
      });
    });
    
    // Backward pass (from outside toward center)
    allLayersSorted.slice().reverse().forEach(L => {
      if (!layers.has(L)) return;
      const ids = layers.get(L);
      const neighborMap = (L > 0) ? outgoing : incoming;
      
      const orderedIds = orderLayerByBarycenter(ids, neighborMap);
      
      // Update Y positions maintaining same vertical spacing
      const vs = verticalSpread(orderedIds.length);
      const total = (orderedIds.length - 1) * vs;
      let start = centerY - total / 2;
      
      orderedIds.forEach((id, i) => {
        const y = start + i * vs;
        nodeY.set(id, y);
        const pos = nodePositions.get(id);
        if (pos) pos.y = y;
      });
    });
  }

  if (layers.has(0)) {
    layers.get(0).forEach(id => {
      if (!nodePositions.has(id)) nodePositions.set(id, { x: centerX + 2, y: nodeY.get(id) ?? centerY });
    });
  }

  return { nodePositions, layers, layerOf, incoming, outgoing };
}

export default ChainFlowGraph;