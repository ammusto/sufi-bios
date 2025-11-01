import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const ChainFlowGraph = ({ data, onNodeClick, selectedNode }) => {
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    if (!data || !data.nodes || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;

    svg.selectAll('*').remove();

    const g = svg.append('g');

    // defs
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

    // layout (pure columns, no radial)
    const layout = calculateSugiyamaLayout(data, width, height);
    const centerId = data.centerPersonId;

    // weighted degrees
    const inW  = new Map(data.nodes.map(n => [n.id, 0]));
    const outW = new Map(data.nodes.map(n => [n.id, 0]));
    data.edges.forEach(e => {
      const w = e.weight ?? 1;
      if (outW.has(e.source)) outW.set(e.source, outW.get(e.source) + w);
      if (inW.has(e.target))  inW.set(e.target,  inW.get(e.target)  + w);
    });

    const weightedDegree = new Map(
      data.nodes.map(n => [n.id, (inW.get(n.id) ?? 0) + (outW.get(n.id) ?? 0)])
    );

    // top 20% thresholds (use 0.9 as in your last snippet)
    const pct = 0.9;
    const inP  = (d3.quantile([...inW.values()].sort(d3.ascending), pct)  ?? 0);
    const outP = (d3.quantile([...outW.values()].sort(d3.ascending), pct) ?? 0);

    // radius scale
    const degValues = Array.from(weightedDegree.values());
    const rScale = d3.scaleSqrt()
      .domain([Math.min(...degValues, 0), Math.max(...degValues, 1)])
      .range([6, 26]);

    // radii map
    const radiusOf = buildRadiusMap(data.nodes, centerId, rScale, weightedDegree);

    // ASSIGN TRACKS TO EDGES
    const edgesWithTracks = assignEdgeTracks(data.edges, layout, data.nodes);

    // EDGES (orthogonal elbows with tracks)
    const edgeLayer = g.append('g').attr('class', 'edges');
    
    edgeLayer.selectAll('path')
      .data(edgesWithTracks)
      .enter()
      .append('path')
      .attr('class', 'chain-edge')
      .attr('d', d => {
        const s = layout.nodePositions.get(d.source);
        const t = layout.nodePositions.get(d.target);
        if (!s || !t) return '';
        const rs = radiusOf.get(d.source) ?? 6;
        const rt = radiusOf.get(d.target) ?? 6;
        return orthogonalPath(s, t, rs, rt, { 
          dxPad: 8, 
          prefer: 'mid',
          track: d.track,
          trackSpacing: 14
        });
      })
      .attr('stroke', '#999')
      .attr('stroke-width', 1.6)
      .attr('stroke-opacity', 0.55)
      .attr('fill', 'none')
      .attr('marker-end', 'url(#arrow)');

    // NODES
    const nodeLayer = g.append('g').attr('class', 'nodes');
    const nodeGroups = nodeLayer.selectAll('g.node-group')
      .data(data.nodes)
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .attr('transform', d => {
        const p = layout.nodePositions.get(d.id);
        return `translate(${p.x}, ${p.y})`;
      })
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeClick?.(d);
      });

    nodeGroups.append('circle')
      .attr('class', 'node-circle')
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

    // LABELS (last/above)
    const showLabel = d =>
      d.id === centerId ||
      selectedNode?.id === d.id ||
      (inW.get(d.id)  ?? 0) >= inP ||
      (outW.get(d.id) ?? 0) >= outP;

    const labelLayer = g.append('g').attr('class', 'labels');
    
    labelLayer.selectAll('text.node-label')
      .data(data.nodes.filter(showLabel))
      .enter()
      .append('text')
      .attr('class', 'node-label')
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
        const base = (d.id === centerId || d.type === 'center')
          ? name
          : (name.length > 25 ? name.slice(0, 25) + '…' : name);
        const w = weightedDegree.get(d.id) ?? 0;
        return w > 1 ? `${base} ×${w}` : base;
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
      .style('font-size', '12px');

    nodeGroups
      .on('mouseenter', (event, d) => {
        const win  = inW.get(d.id)  ?? 0;
        const wout = outW.get(d.id) ?? 0;
        const wtot = weightedDegree.get(d.id) ?? 0;
        tooltip.transition().duration(150).style('opacity', 0.9);
        tooltip.html(`
          <strong>${d.name || ''}</strong><br/>
          ${(d.id === centerId || d.type === 'center') ? '<em>Focus Person</em>' : d.isUpstream ? 'Upstream' : d.isDownstream ? 'Downstream' : ''}<br/>
          ${d.hasId ? `Has biography (#${d.hasId})<br/>` : ''}
          Upstream (in): ${win}<br/>
          Downstream (out): ${wout}<br/>
          Weighted total: ${wtot}
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseleave', () => {
        tooltip.transition().duration(250).style('opacity', 0);
      });

    // ZOOM
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    return () => tooltip.remove();
  }, [data, dimensions, onNodeClick, selectedNode]);

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
    <svg ref={svgRef} className="chain-flow-graph" width="100%" height="100%" />
  );
};

/* ============================== helpers ============================== */

function buildRadiusMap(nodes, centerId, rScale, weightedDegree) {
  const m = new Map();
  nodes.forEach(n => {
    const w = weightedDegree.get(n.id) ?? 0;
    const r = (n.id === centerId || n.type === 'center') ? Math.max(20, rScale(w)) : rScale(w);
    m.set(n.id, r);
  });
  return m;
}

/**
 * Assign track numbers to edges to prevent overlapping vertical segments
 */
function assignEdgeTracks(edges, layout, nodes) {
  // Get layer for each node
  const nodeLayer = new Map();
  nodes.forEach(n => {
    const pos = layout.nodePositions.get(n.id);
    if (pos) {
      // Approximate layer based on X position
      nodeLayer.set(n.id, Math.round(pos.x / 100));
    }
  });

  // Group edges by (source_layer, target_layer) pair
  const groups = new Map();
  
  edges.forEach(edge => {
    const sLayer = nodeLayer.get(edge.source) ?? 0;
    const tLayer = nodeLayer.get(edge.target) ?? 0;
    const key = `${sLayer}-${tLayer}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(edge);
  });

  // For each group, sort by Y positions and assign tracks
  const edgesWithTracks = [];
  
  groups.forEach((groupEdges, key) => {
    // Sort by source Y, then target Y
    groupEdges.sort((a, b) => {
      const sA = layout.nodePositions.get(a.source);
      const sB = layout.nodePositions.get(b.source);
      const tA = layout.nodePositions.get(a.target);
      const tB = layout.nodePositions.get(b.target);
      
      if (!sA || !sB || !tA || !tB) return 0;
      
      // Sort by average Y position of source and target
      const avgA = (sA.y + tA.y) / 2;
      const avgB = (sB.y + tB.y) / 2;
      
      return avgA - avgB;
    });
    
    // Assign track numbers (centered around 0)
    const numEdges = groupEdges.length;
    const offset = Math.floor(numEdges / 2);
    
    groupEdges.forEach((edge, idx) => {
      edgesWithTracks.push({
        ...edge,
        track: idx - offset
      });
    });
  });

  return edgesWithTracks;
}

/**
 * Orthogonal elbow path with start/end padded by node radii
 * Now with track offset to prevent overlapping
 */
function orthogonalPath(s, t, rs, rt, opts = {}) {
  const { dxPad = 8, prefer = 'mid', track = 0, trackSpacing = 14 } = opts;
  
  if (!s || !t) return '';

  const dir = Math.sign(t.x - s.x) || 1; // +1 right, -1 left
  
  // Start and end points (padded by node radii)
  const s0 = { x: s.x + dir * (rs + dxPad), y: s.y };
  const t0 = { x: t.x - dir * (rt + dxPad), y: t.y };

  // Calculate base middle X
  let mx;
  if (prefer === 'source') {
    mx = s0.x + dir * Math.max(40, Math.abs(t0.x - s0.x) * 0.35);
  } else if (prefer === 'target') {
    mx = t0.x - dir * Math.max(40, Math.abs(t0.x - s0.x) * 0.35);
  } else {
    mx = (s0.x + t0.x) / 2;
  }

  if (Math.abs(t0.x - s0.x) < 4) {
    mx = s0.x + dir * 40;
  }

  // APPLY TRACK OFFSET
  mx = mx + (dir * track * trackSpacing);

  return `M${s0.x},${s0.y} L${mx},${s0.y} L${mx},${t0.y} L${t0.x},${t0.y}`;
}

/* ============================== layout (columns only) ============================== */

function calculateSugiyamaLayout(data, width, height) {
  const { nodes, edges, centerPersonId } = data;

  // adjacency
  const outgoing = new Map(), incoming = new Map();
  nodes.forEach(n => { outgoing.set(n.id, []); incoming.set(n.id, []); });
  edges.forEach(e => { outgoing.get(e.source).push(e.target); incoming.get(e.target).push(e.source); });

  const center = centerPersonId;

  // BFS
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

  // signed layers
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

  // group by layer + seed order
  const degree = new Map(nodes.map(n => [n.id, incoming.get(n.id).length + outgoing.get(n.id).length]));
  const layers = new Map();
  
  nodes.forEach(n => {
    const L = layerOf.get(n.id);
    if (!layers.has(L)) layers.set(L, []);
    layers.get(L).push(n.id);
  });

  for (const [L, arr] of layers.entries()) {
    arr.sort((a,b) => {
      const da = degree.get(a), db = degree.get(b);
      if (db !== da) return db - da;
      const na = (nodes.find(x=>x.id===a)?.name || '');
      const nb = (nodes.find(x=>x.id===b)?.name || '');
      return na.localeCompare(nb, 'en');
    });
  }

  const sortedLayers = [...layers.keys()].sort((a,b)=>a-b);
  const minL = Math.min(...sortedLayers), maxL = Math.max(...sortedLayers);

  // barycenter sweeps for all |L|>=1 (columns everywhere)
  const baryOrder = (ids, neighborMap, refIdx) =>
    ids.map(id => {
      const idxs = (neighborMap.get(id) || [])
        .map(v => refIdx.get(v))
        .filter(i => i !== undefined)
        .sort((a,b)=>a-b);
      if (!idxs.length) return [id, Number.POSITIVE_INFINITY];
      const m = idxs.length & 1
        ? idxs[(idxs.length-1)/2]
        : (idxs[idxs.length/2-1] + idxs[idxs.length/2]) / 2;
      return [id, m];
    }).sort((a,b)=>a[1]-b[1]).map(([id])=>id);

  const iters = 3;
  for (let it = 0; it < iters; it++) {
    // Forward sweep (left to right)
    for (let L = Math.max(1, minL+1); L <= maxL; L++) {
      if (!layers.has(L) || !layers.has(L-1)) continue;
      const refIdx = new Map(layers.get(L-1).map((id,i)=>[id,i]));
      layers.set(L, baryOrder(layers.get(L), incoming, refIdx));
    }
    // Backward sweep (right to left)
    for (let L = Math.min(-1, maxL-1); L >= minL; L--) {
      if (!layers.has(L) || !layers.has(L+1)) continue;
      const refIdx = new Map(layers.get(L+1).map((id,i)=>[id,i]));
      layers.set(L, baryOrder(layers.get(L), outgoing, refIdx));
    }
    // Additional sweeps for better convergence
    for (let L = Math.min(1, maxL-1); L >= minL; L--) {
      if (!layers.has(L) || !layers.has(L+1)) continue;
      const refIdx = new Map(layers.get(L+1).map((id,i)=>[id,i]));
      layers.set(L, baryOrder(layers.get(L), outgoing, refIdx));
    }
    for (let L = Math.max(-1, minL+1); L <= maxL; L++) {
      if (!layers.has(L) || !layers.has(L-1)) continue;
      const refIdx = new Map(layers.get(L-1).map((id,i)=>[id,i]));
      layers.set(L, baryOrder(layers.get(L), incoming, refIdx));
    }
  }

  // geometry (columns for all layers)
  const W = width, H = height;
  const centerX = W / 2, centerY = H / 2;
  const colPad = 80, baseDx = 160;

  const nodeY = new Map();
  nodeY.set(center, centerY);

  if (layers.has(0)) {
    const arr0 = layers.get(0);
    const idx = arr0.indexOf(center);
    if (idx > 0) { arr0.splice(idx,1); arr0.unshift(center); }
    if (arr0.length > 1) {
      const vs = 42, start = centerY - ((arr0.length-1)*vs)/2;
      arr0.forEach((id,i) => { if (id!==center) nodeY.set(id, start + i*vs); });
    }
  }

  const nodePositions = new Map();
  nodePositions.set(center, { x: centerX, y: centerY });
  
  if (layers.has(0)) {
    layers.get(0).forEach(id => {
      if (!nodePositions.has(id)) nodePositions.set(id, { x: centerX + 2, y: nodeY.get(id) ?? centerY });
    });
  }

  const verticalSpread = n => Math.max(46, Math.min(110, (H * 0.9) / Math.max(1,n)));

  const placeColumn = (ids, L) => {
    if (!ids.length) return;
    const distanceFromCenter = Math.abs(L);
    const x = L < 0
      ? centerX - (distanceFromCenter * baseDx + colPad)
      : centerX + (distanceFromCenter * baseDx + colPad);

    const nbrLayer = (L > 0) ? L - 1 : L + 1;
    const vs = verticalSpread(ids.length);
    const total = (ids.length - 1) * vs;
    let start = centerY - total / 2;

    // initial packing
    ids.forEach((id,i) => nodeY.set(id, start + i*vs));

    // relax toward neighbor medians
    const lambda = 0.55;
    ids.forEach(id => {
      const nbrs = (L > 0 ? incoming.get(id) : outgoing.get(id))
        .filter(v => (layerOf.get(v) === nbrLayer));
      const ys = nbrs.map(v => nodeY.get(v)).filter(y => y !== undefined).sort((a,b)=>a-b);
      if (!ys.length) return;
      const m = ys.length & 1 ? ys[(ys.length-1)/2] : (ys[ys.length/2-1]+ys[ys.length/2])/2;
      nodeY.set(id, nodeY.get(id)*(1-lambda) + m*lambda);
    });

    // re-pack to keep spacing/order deterministically
    start = centerY - total/2;
    ids.forEach((id,i) => nodeY.set(id, start + i*vs));

    ids.forEach(id => nodePositions.set(id, { x, y: nodeY.get(id) }));
  };

  const posLayers = sortedLayers.filter(L => L > 0).sort((a,b)=>a-b);
  const negLayers = sortedLayers.filter(L => L < 0).sort((a,b)=>b-a);
  
  posLayers.forEach(L => placeColumn(layers.get(L), L));
  negLayers.forEach(L => placeColumn(layers.get(L), L));

  return { nodePositions, layers };
}

export default ChainFlowGraph;