import { perfStart, perfEnd, perfMemory } from './performanceMonitor';

/**
 * Optimized Network Data Loader
 * Properly uses pre-computed indices and aggregates edges for performance
 */

/**
 * Load network data efficiently using all pre-computed indices
 */
export const loadNetworkData = async () => {
  try {
    const baseUrl = process.env.PUBLIC_URL || '';
    
    console.log('Loading optimized network data...');
    perfStart('loadNetworkData');
    
    // Load ALL files in parallel - we need them all
    const [registry, relationships, networkIndex, nodeMetrics] = await Promise.all([
      fetch(`${baseUrl}/data/names-registry.json`).then(r => r.json()),
      fetch(`${baseUrl}/data/relationships.json`).then(r => r.json()),
      fetch(`${baseUrl}/data/network-index.json`).then(r => r.json()),
      fetch(`${baseUrl}/data/node-metrics.json`).then(r => r.json())
    ]);
    
    perfEnd('loadNetworkData');
    console.log(`Loaded: ${Object.keys(registry).length} people, ${relationships.edges.length} edges, ${relationships.isnad_chains.length} isnads`);
    
    return {
      registry,
      relationships,
      networkIndex,
      metrics: nodeMetrics
    };
  } catch (error) {
    perfEnd('loadNetworkData');
    console.error('Error loading network data:', error);
    throw error;
  }
};

/**
 * Build Cytoscape elements with proper edge aggregation
 * Uses pre-computed indices and prevents duplicate edges
 */
export const buildCytoscapeElements = (registry, relationships, networkIndex, metrics, options = {}) => {
  const {
    maxNodes = null,
    minDegree = 0,
    sources = null
  } = options;

  perfStart('buildCytoscapeElements');
  console.log('Building optimized Cytoscape elements...');
  
  // Build nodes using metrics for sizing
  const nodes = [];
  const nodeSet = new Set();
  let nodeCount = 0;
  
  // Sort by degree if we need to limit nodes (show most connected first)
  const sortedPersonIds = Object.keys(registry).sort((a, b) => {
    const degreeA = metrics[a]?.total_degree || 0;
    const degreeB = metrics[b]?.total_degree || 0;
    return degreeB - degreeA;
  });

  for (const personId of sortedPersonIds) {
    const personData = registry[personId];
    const personMetrics = metrics[personId] || {};
    
    // Apply filters
    if (personMetrics.total_degree < minDegree) continue;
    if (sources && !personData.sources?.some(s => sources.includes(s))) continue;
    if (maxNodes && nodeCount >= maxNodes) break;
    
    nodeSet.add(personId);
    nodeCount++;
    
    // Use metrics for visual properties
    const nodeSize = Math.min(50, 20 + Math.log(personMetrics.total_degree + 1) * 5);
    
    nodes.push({
      data: {
        id: personId,
        label: personData.canonical || `Person ${personId}`,
        arabicName: personData.canonical,
        variants: personData.variants || [],
        sources: personData.sources || [],
        deathDate: personData.death_date,
        // Add metrics to node data
        degree: personMetrics.total_degree || 0,
        betweenness: personMetrics.betweenness || 0,
        pagerank: personMetrics.pagerank || 0,
        // Add visual properties as data attributes
        width: nodeSize,
        height: nodeSize
      },
      classes: personData.sources?.join(' ') || ''
    });
  }

  console.log(`Created ${nodes.length} nodes`);

  // Build aggregated edges
  perfStart('buildEdges');
  const edgeMap = new Map(); // Key: "source-target", Value: edge data
  const edges = [];
  
  // Helper to create edge key (always smaller ID first for consistency)
  const makeEdgeKey = (source, target) => {
    const s = String(source);
    const t = String(target);
    return s < t ? `${s}-${t}` : `${t}-${s}`;
  };

  // Process direct relationships
  for (const edge of relationships.edges) {
    const source = String(edge.source);
    const target = String(edge.target);
    
    // Skip if nodes not in our filtered set
    if (!nodeSet.has(source) || !nodeSet.has(target)) continue;
    
    const key = makeEdgeKey(source, target);
    
    if (!edgeMap.has(key)) {
      edgeMap.set(key, {
        source: source < target ? source : target,
        target: source < target ? target : source,
        count: 0,
        types: new Set(),
        sources: new Set(),
        contexts: []
      });
    }
    
    const edgeData = edgeMap.get(key);
    edgeData.count++;
    edgeData.types.add(edge.type || 'unknown');
    if (edge.text_source) edgeData.sources.add(edge.text_source);
    if (edge.context) edgeData.contexts.push(edge.context);
  }

  // Process isnad chains - just count connections, don't create duplicates
  for (const chain of relationships.isnad_chains) {
    const chainNodes = chain.chain.map(String);
    
    // For each consecutive pair in the chain
    for (let i = 0; i < chainNodes.length - 1; i++) {
      const source = chainNodes[i];
      const target = chainNodes[i + 1];
      
      // Skip if nodes not in our filtered set
      if (!nodeSet.has(source) || !nodeSet.has(target)) continue;
      
      const key = makeEdgeKey(source, target);
      
      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          source: source < target ? source : target,
          target: source < target ? target : source,
          count: 0,
          types: new Set(),
          sources: new Set(),
          contexts: []
        });
      }
      
      const edgeData = edgeMap.get(key);
      edgeData.count++;
      edgeData.types.add('isnad_transmission');
      if (chain.text_source) edgeData.sources.add(chain.text_source);
    }
  }

  // Convert edge map to Cytoscape edges with proper visual encoding
  let edgeId = 0;
  for (const [key, edgeData] of edgeMap.entries()) {
    // Calculate edge width based on count (logarithmic scale)
    const edgeWidth = Math.min(10, 1 + Math.log(edgeData.count) * 1.5);
    const edgeOpacity = Math.min(1, 0.3 + edgeData.count * 0.1);
    
    // Determine primary type for styling
    const primaryType = edgeData.types.has('teacher_student') ? 'teacher_student' :
                        edgeData.types.has('companion') ? 'companion' :
                        edgeData.types.has('isnad_transmission') ? 'isnad_transmission' :
                        Array.from(edgeData.types)[0];
    
    // Determine edge color based on type
    const edgeColor = primaryType === 'teacher_student' ? '#4c6ef5' :
                      primaryType === 'companion' ? '#15aabf' :
                      primaryType === 'isnad_transmission' ? '#fab005' :
                      '#999';
    
    edges.push({
      data: {
        id: `e${edgeId++}`,
        source: edgeData.source,
        target: edgeData.target,
        weight: edgeData.count,
        types: Array.from(edgeData.types),
        sources: Array.from(edgeData.sources),
        label: edgeData.count > 1 ? `×${edgeData.count}` : '',
        // Add the visual properties as data attributes
        width: edgeWidth,
        opacity: edgeOpacity,
        color: edgeColor
      },
      classes: `${primaryType} aggregated`
    });
  }

  perfEnd('buildEdges');
  console.log(`Created ${edges.length} aggregated edges from ${edgeMap.size} unique connections`);
  perfMemory();
  perfEnd('buildCytoscapeElements');

  return { nodes, edges };
};

/**
 * Get ego network using network index
 */
export const getEgoNetwork = (personId, registry, networkIndex, relationships, metrics, degree = 1) => {
  perfStart('getEgoNetwork');
  
  const includedNodes = new Set([String(personId)]);
  const queue = [{ id: String(personId), level: 0 }];
  const visited = new Set();

  while (queue.length > 0) {
    const { id, level } = queue.shift();
    
    if (visited.has(id) || level >= degree) continue;
    visited.add(id);

    // Use network index for fast lookup
    const personIndex = networkIndex.by_person[id];
    if (!personIndex) continue;

    // Get connected people from relationships
    for (const edge of relationships.edges) {
      const source = String(edge.source);
      const target = String(edge.target);
      
      if (source === id && !includedNodes.has(target)) {
        includedNodes.add(target);
        if (level + 1 < degree) {
          queue.push({ id: target, level: level + 1 });
        }
      } else if (target === id && !includedNodes.has(source)) {
        includedNodes.add(source);
        if (level + 1 < degree) {
          queue.push({ id: source, level: level + 1 });
        }
      }
    }
  }

  // Build elements for ego network
  const filteredRegistry = {};
  for (const id of includedNodes) {
    if (registry[id]) {
      filteredRegistry[id] = registry[id];
    }
  }

  perfEnd('getEgoNetwork');
  return buildCytoscapeElements(filteredRegistry, relationships, networkIndex, metrics);
};

/**
 * Calculate network statistics efficiently
 */
export const calculateNetworkStats = (elements, metrics) => {
  const stats = {
    nodeCount: elements.nodes.length,
    edgeCount: elements.edges.length,
    totalConnections: 0,
    avgDegree: 0,
    density: 0,
    maxConnections: 0,
    avgConnections: 0
  };

  // Sum up total connections (weights)
  elements.edges.forEach(edge => {
    stats.totalConnections += edge.data.weight || 1;
    stats.maxConnections = Math.max(stats.maxConnections, edge.data.weight || 1);
  });

  // Calculate average connections per edge
  stats.avgConnections = stats.edgeCount > 0 ? stats.totalConnections / stats.edgeCount : 0;

  // Calculate density
  if (stats.nodeCount > 1) {
    const possibleEdges = stats.nodeCount * (stats.nodeCount - 1) / 2;
    stats.density = stats.edgeCount / possibleEdges;
  }

  // Calculate average degree from node data
  let totalDegree = 0;
  elements.nodes.forEach(node => {
    totalDegree += node.data.degree || 0;
  });
  stats.avgDegree = stats.nodeCount > 0 ? totalDegree / stats.nodeCount : 0;

  return stats;
};