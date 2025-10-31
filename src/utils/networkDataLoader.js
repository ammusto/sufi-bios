import { SOURCE_NAMES } from './constants';
import { perfStart, perfEnd, perfMemory } from './performanceMonitor';

/**
 * Load network data from static JSON files
 */
export const loadNetworkData = async (dataType = 'full') => {
  try {
    const baseUrl = process.env.PUBLIC_URL || '';
    
    console.log('Starting to load network data, type:', dataType);
    perfStart('loadNetworkData');
    
    // Always load these core files
    perfStart('loadCoreFiles');
    const corePromises = [
      fetch(`${baseUrl}/data/names-registry.json`)
        .then(r => {
          if (!r.ok) throw new Error(`Failed to load names-registry.json: ${r.status}`);
          return r.json();
        }),
      fetch(`${baseUrl}/data/relationships.json`)
        .then(r => {
          if (!r.ok) throw new Error(`Failed to load relationships.json: ${r.status}`);
          return r.json();
        }),
      fetch(`${baseUrl}/data/network-index.json`)
        .then(r => {
          if (!r.ok) {
            console.warn('network-index.json not found, continuing without it');
            return null;
          }
          return r.json();
        })
        .catch(() => {
          console.warn('network-index.json not found, continuing without it');
          return null;
        })
    ];

    const [registry, relationships, networkIndex] = await Promise.all(corePromises);
    perfEnd('loadCoreFiles');
    
    console.log(`Loaded core data: ${Object.keys(registry || {}).length} people, ${relationships?.edges?.length || 0} edges`);
    perfMemory();

    // Initialize optional data
    let metrics = null;
    let communities = null;
    let temporal = null;
    let places = null;
    let keyFigures = null;

    // Load optional files only if requested and don't let them block
    if (dataType === 'full' || dataType === 'metrics') {
      perfStart('loadOptionalFiles');
      
      // Load each optional file separately to avoid blocking on any one
      const optionalPromises = [];
      
      optionalPromises.push(
        fetch(`${baseUrl}/data/node-metrics.json`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => {
            console.log('node-metrics.json not found');
            return null;
          })
      );
      
      optionalPromises.push(
        fetch(`${baseUrl}/data/communities.json`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => {
            console.log('communities.json not found');
            return null;
          })
      );
      
      optionalPromises.push(
        fetch(`${baseUrl}/data/temporal-analysis.json`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => {
            console.log('temporal-analysis.json not found');
            return null;
          })
      );
      
      optionalPromises.push(
        fetch(`${baseUrl}/data/key-figures.json`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => {
            console.log('key-figures.json not found');
            return null;
          })
      );

      // Wait for all optional files but don't fail if any are missing
      const optionalResults = await Promise.allSettled(optionalPromises);
      
      metrics = optionalResults[0].status === 'fulfilled' ? optionalResults[0].value : null;
      communities = optionalResults[1].status === 'fulfilled' ? optionalResults[1].value : null;
      temporal = optionalResults[2].status === 'fulfilled' ? optionalResults[2].value : null;
      keyFigures = optionalResults[3].status === 'fulfilled' ? optionalResults[3].value : null;
      
      perfEnd('loadOptionalFiles');
    }

    if (dataType === 'geographic') {
      perfStart('loadGeographic');
      try {
        places = await fetch(`${baseUrl}/data/places.json`)
          .then(r => r.ok ? r.json() : null);
      } catch {
        console.log('places.json not found');
      }
      perfEnd('loadGeographic');
    }

    perfEnd('loadNetworkData');
    console.log('Successfully loaded network data');
    
    return {
      registry,
      relationships,
      networkIndex,
      metrics,
      communities,
      temporal,
      keyFigures,
      places
    };
  } catch (error) {
    perfEnd('loadNetworkData');
    console.error('Error loading network data:', error);
    throw error;
  }
};

/**
 * Convert our data format to Cytoscape elements
 */
export const buildCytoscapeElements = (registry, relationships, options = {}) => {
  const {
    filterSource = null,
    filterBioId = null,
    filterPersonId = null,
    maxNodes = null,
    includedNodeIds = null,
    relationshipTypes = null
  } = options;

  console.log('Building Cytoscape elements with options:', options);

  const nodes = [];
  const edges = [];
  const nodeSet = new Set();
  
  // If we have a specific set of nodes to include, use only those
  if (includedNodeIds && includedNodeIds.size > 0) {
    // Add only specified nodes
    for (const personId of includedNodeIds) {
      const personData = registry[personId];
      if (!personData) continue;
      
      nodeSet.add(personId);
      nodes.push({
        data: {
          id: personId,
          label: personData.canonical || `Person ${personId}`,
          arabicName: personData.canonical,
          variants: personData.variants || [],
          sources: personData.sources || [],
          deathDate: personData.death_date,
          places: personData.places || [],
          bioIds: personData.bio_ids || []
        },
        classes: personData.sources?.join(' ') || ''
      });
    }
  } else {
    // Build nodes from registry with filters
    let nodeCount = 0;
    for (const [personId, personData] of Object.entries(registry)) {
      // Apply filters
      if (filterSource && !personData.sources?.includes(filterSource)) continue;
      if (filterPersonId && personId !== filterPersonId) continue;
      
      // Check max nodes limit
      if (maxNodes && nodeCount >= maxNodes) break;
      
      nodeSet.add(personId);
      nodeCount++;
      
      nodes.push({
        data: {
          id: personId,
          label: personData.canonical || `Person ${personId}`,
          arabicName: personData.canonical,
          variants: personData.variants || [],
          sources: personData.sources || [],
          deathDate: personData.death_date,
          places: personData.places || [],
          bioIds: personData.bio_ids || []
        },
        classes: personData.sources?.join(' ') || ''
      });
    }
  }

  console.log(`Created ${nodes.length} nodes`);

  // Build edges from relationships
  let edgeId = 0;
  let edgeCount = 0;
  const maxEdges = maxNodes ? maxNodes * 10 : 10000; // Limit edges for performance
  
  // Process direct relationships
  for (const edge of relationships.edges) {
    if (edgeCount >= maxEdges) break;
    
    const source = String(edge.source);
    const target = String(edge.target);
    
    // Skip if source node not in our set
    if (!nodeSet.has(source)) continue;
    
    // Check if target is a person ID
    if (nodeSet.has(target)) {
      // Direct person-to-person edge
      if (relationshipTypes && !relationshipTypes.includes(edge.type)) continue;
      if (filterSource && edge.text_source !== filterSource) continue;
      
      edges.push({
        data: {
          id: `e${edgeId++}`,
          source: source,
          target: target,
          type: edge.type || 'unknown',
          textSource: edge.text_source,
          bioId: edge.bio_id,
          context: edge.context || ''
        },
        classes: `${edge.type || 'unknown'} ${edge.text_source || ''}`
      });
      edgeCount++;
    }
  }

  // Process isnad chains (limit to prevent performance issues)
  let chainCount = 0;
  const maxChains = maxNodes ? Math.min(100, relationships.isnad_chains.length) : relationships.isnad_chains.length;
  
  for (let i = 0; i < Math.min(maxChains, relationships.isnad_chains.length); i++) {
    const chain = relationships.isnad_chains[i];
    
    // Apply filters
    if (filterSource && chain.text_source !== filterSource) continue;
    if (filterBioId && chain.bio_id !== filterBioId) continue;
    
    // Create edges between consecutive people in chain
    for (let j = 0; j < chain.chain.length - 1; j++) {
      if (edgeCount >= maxEdges) break;
      
      const source = String(chain.chain[j]);
      const target = String(chain.chain[j + 1]);
      
      if (!nodeSet.has(source) || !nodeSet.has(target)) continue;
      
      edges.push({
        data: {
          id: `e${edgeId++}`,
          source: source,
          target: target,
          type: 'isnad_transmission',
          textSource: chain.text_source,
          bioId: chain.bio_id,
          chainId: chain.id,
          chainType: chain.type
        },
        classes: `isnad ${chain.text_source || ''}`
      });
      edgeCount++;
    }
    
    chainCount++;
    if (chainCount >= maxChains) break;
  }

  console.log(`Created ${edges.length} edges`);

  return { nodes, edges };
};

/**
 * Get ego network for a specific person
 */
export const getEgoNetwork = (personId, registry, relationships, degree = 1) => {
  const includedNodes = new Set([String(personId)]);
  const visitedNodes = new Set();
  const queue = [{ id: String(personId), level: 0 }];

  while (queue.length > 0) {
    const { id, level } = queue.shift();
    
    if (visitedNodes.has(id) || level >= degree) continue;
    visitedNodes.add(id);

    // Find all edges involving this person
    for (const edge of relationships.edges) {
      const source = String(edge.source);
      const target = String(edge.target);
      
      if (source === id && !includedNodes.has(target)) {
        includedNodes.add(target);
        if (level + 1 < degree) {
          queue.push({ id: target, level: level + 1 });
        }
      }
      
      if (target === id && !includedNodes.has(source)) {
        includedNodes.add(source);
        if (level + 1 < degree) {
          queue.push({ id: source, level: level + 1 });
        }
      }
    }

    // Also check isnad chains
    for (const chain of relationships.isnad_chains) {
      const chainIds = chain.chain.map(String);
      const idx = chainIds.indexOf(id);
      
      if (idx !== -1) {
        // Add neighbors in chain
        if (idx > 0 && !includedNodes.has(chainIds[idx - 1])) {
          includedNodes.add(chainIds[idx - 1]);
          if (level + 1 < degree) {
            queue.push({ id: chainIds[idx - 1], level: level + 1 });
          }
        }
        if (idx < chainIds.length - 1 && !includedNodes.has(chainIds[idx + 1])) {
          includedNodes.add(chainIds[idx + 1]);
          if (level + 1 < degree) {
            queue.push({ id: chainIds[idx + 1], level: level + 1 });
          }
        }
      }
    }
  }

  return buildCytoscapeElements(registry, relationships, { includedNodeIds: includedNodes });
};

/**
 * Get network for a specific bio
 */
export const getBioNetwork = (bioId, registry, relationships) => {
  // Find all people mentioned in this biography
  const includedNodes = new Set();
  
  // Add people directly related to this bio
  for (const edge of relationships.edges) {
    if (edge.bio_id === bioId) {
      includedNodes.add(String(edge.source));
      includedNodes.add(String(edge.target));
    }
  }

  // Add people in isnad chains for this bio
  for (const chain of relationships.isnad_chains) {
    if (chain.bio_id === bioId) {
      chain.chain.forEach(id => includedNodes.add(String(id)));
    }
  }

  // Find the main person of this biography
  const mainPerson = Object.entries(registry).find(([id, data]) => 
    data.bio_ids?.includes(bioId)
  );
  
  if (mainPerson) {
    includedNodes.add(mainPerson[0]);
  }

  return buildCytoscapeElements(registry, relationships, { includedNodeIds: includedNodes });
};

/**
 * Get transmission network for a person (all isnads they appear in)
 */
export const getTransmissionNetwork = (personId, registry, relationships) => {
  const includedNodes = new Set([String(personId)]);
  const relevantChains = [];

  // Find all chains containing this person
  for (const chain of relationships.isnad_chains) {
    if (chain.chain.map(String).includes(String(personId))) {
      relevantChains.push(chain);
      chain.chain.forEach(id => includedNodes.add(String(id)));
    }
  }

  const elements = buildCytoscapeElements(registry, relationships, { includedNodeIds: includedNodes });
  
  // Add chain metadata to elements
  elements.chains = relevantChains;
  
  return elements;
};

/**
 * Calculate network statistics
 */
export const calculateNetworkStats = (elements) => {
  const stats = {
    nodeCount: elements.nodes.length,
    edgeCount: elements.edges.length,
    density: 0,
    avgDegree: 0,
    sources: new Set(),
    relationshipTypes: new Set(),
    dateRange: { min: null, max: null }
  };

  // Calculate density
  if (stats.nodeCount > 1) {
    const possibleEdges = stats.nodeCount * (stats.nodeCount - 1);
    stats.density = stats.edgeCount / possibleEdges;
  }

  // Calculate average degree and collect metadata
  const degrees = {};
  elements.nodes.forEach(node => {
    degrees[node.data.id] = 0;
    node.data.sources?.forEach(s => stats.sources.add(s));
    
    // Track date range
    if (node.data.deathDate?.year_hijri) {
      const year = parseInt(node.data.deathDate.year_hijri);
      if (!stats.dateRange.min || year < stats.dateRange.min) {
        stats.dateRange.min = year;
      }
      if (!stats.dateRange.max || year > stats.dateRange.max) {
        stats.dateRange.max = year;
      }
    }
  });

  elements.edges.forEach(edge => {
    degrees[edge.data.source]++;
    degrees[edge.data.target]++;
    stats.relationshipTypes.add(edge.data.type);
  });

  const degreeValues = Object.values(degrees);
  if (degreeValues.length > 0) {
    stats.avgDegree = degreeValues.reduce((a, b) => a + b, 0) / degreeValues.length;
  }

  stats.sources = Array.from(stats.sources);
  stats.relationshipTypes = Array.from(stats.relationshipTypes);

  return stats;
};