import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { 
  NetworkGraph, 
  NetworkFilters, 
  NetworkStats,
  NetworkLegend,
  loadNetworkData,
  buildCytoscapeElements,
  getEgoNetwork,
  getBioNetwork,
  getTransmissionNetwork
} from '../components/Network';
import Loading from '../components/common/Loading';
import './Network.css';

const Network = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Data states
  const [registry, setRegistry] = useState(null);
  const [relationships, setRelationships] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [keyFigures, setKeyFigures] = useState(null);
  const [temporal, setTemporal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const dataLoadedRef = useRef(false);
  
  // View states
  const [elements, setElements] = useState({ nodes: [], edges: [] });
  const [filters, setFilters] = useState({});
  const [selectedNode, setSelectedNode] = useState(null);
  const [viewType, setViewType] = useState(searchParams.get('view') || 'full');
  const [layout, setLayout] = useState('fcose');
  const [showFilters, setShowFilters] = useState(true);
  const [showStats, setShowStats] = useState(true);

  // Load network data on mount - ONLY ONCE
  useEffect(() => {
    // Prevent multiple loads
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;

    const loadData = async () => {
      try {
        setLoading(true);
        console.log('Loading network data...');
        
        // Load core data
        const data = await loadNetworkData('full');
        
        if (!data.registry || !data.relationships) {
          throw new Error('Core network data is missing');
        }
        
        console.log('Loaded registry:', Object.keys(data.registry).length, 'people');
        console.log('Loaded relationships:', data.relationships.edges.length, 'edges');
        
        setRegistry(data.registry);
        setRelationships(data.relationships);
        setMetrics(data.metrics || null);
        setKeyFigures(data.keyFigures || null);
        setTemporal(data.temporal || null);
        
        setError(null);
      } catch (err) {
        console.error('Failed to load network data:', err);
        setError('Failed to load network data. Please check that data files are in public/data/ directory.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []); // Empty dependency array - run only once

  // Build network elements based on view type and filters
  useEffect(() => {
    if (!registry || !relationships) return;

    let newElements = { nodes: [], edges: [] };
    
    // Get view parameters from URL
    const personId = searchParams.get('person');
    const bioId = searchParams.get('bio');
    const source = searchParams.get('source');
    const degree = parseInt(searchParams.get('degree')) || 1;

    switch (viewType) {
      case 'ego':
        if (personId) {
          newElements = getEgoNetwork(personId, registry, relationships, degree);
        }
        break;
        
      case 'bio':
        if (bioId) {
          newElements = getBioNetwork(bioId, registry, relationships);
        }
        break;
        
      case 'transmission':
        if (personId) {
          newElements = getTransmissionNetwork(personId, registry, relationships);
        }
        break;
        
      case 'source':
        newElements = buildCytoscapeElements(registry, relationships, {
          filterSource: source || 'sulami',
          maxNodes: 500
        });
        break;
        
      case 'full':
      default:
        // For full network, limit initial nodes for performance
        newElements = buildCytoscapeElements(registry, relationships, {
          maxNodes: showFilters ? null : 300
        });
        break;
    }

    // Apply filters
    if (filters && Object.keys(filters).length > 0) {
      newElements = applyFilters(newElements, filters);
    }

    setElements(newElements);
  }, [registry, relationships, viewType, filters, searchParams, showFilters]);

  // Apply filters to elements
  const applyFilters = useCallback((elements, filters) => {
    let filteredNodes = [...elements.nodes];
    let filteredEdges = [...elements.edges];

    // Search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filteredNodes = filteredNodes.filter(node => 
        node.data.label?.toLowerCase().includes(searchLower) ||
        node.data.variants?.some(v => v.toLowerCase().includes(searchLower))
      );
      
      // Keep only edges between filtered nodes
      const nodeIds = new Set(filteredNodes.map(n => n.data.id));
      filteredEdges = filteredEdges.filter(edge => 
        nodeIds.has(edge.data.source) && nodeIds.has(edge.data.target)
      );
    }

    // Source filter
    if (filters.sources && filters.sources.length > 0) {
      filteredNodes = filteredNodes.filter(node =>
        node.data.sources?.some(s => filters.sources.includes(s))
      );
      
      const nodeIds = new Set(filteredNodes.map(n => n.data.id));
      filteredEdges = filteredEdges.filter(edge =>
        nodeIds.has(edge.data.source) && nodeIds.has(edge.data.target)
      );
    }

    // Relationship type filter
    if (filters.relationshipTypes && filters.relationshipTypes.length > 0) {
      filteredEdges = filteredEdges.filter(edge =>
        filters.relationshipTypes.includes(edge.data.type)
      );
    }

    // Date range filter
    if (filters.dateRange?.min || filters.dateRange?.max) {
      filteredNodes = filteredNodes.filter(node => {
        if (!node.data.deathDate?.year_hijri) return false;
        const year = parseInt(node.data.deathDate.year_hijri);
        const minOk = !filters.dateRange.min || year >= filters.dateRange.min;
        const maxOk = !filters.dateRange.max || year <= filters.dateRange.max;
        return minOk && maxOk;
      });
      
      const nodeIds = new Set(filteredNodes.map(n => n.data.id));
      filteredEdges = filteredEdges.filter(edge =>
        nodeIds.has(edge.data.source) && nodeIds.has(edge.data.target)
      );
    }

    // Has death date filter
    if (filters.hasDeathDate !== null && filters.hasDeathDate !== undefined) {
      filteredNodes = filteredNodes.filter(node =>
        filters.hasDeathDate 
          ? node.data.deathDate?.year_hijri 
          : !node.data.deathDate?.year_hijri
      );
      
      const nodeIds = new Set(filteredNodes.map(n => n.data.id));
      filteredEdges = filteredEdges.filter(edge =>
        nodeIds.has(edge.data.source) && nodeIds.has(edge.data.target)
      );
    }

    // Minimum degree filter
    if (filters.minDegree > 0) {
      const degrees = {};
      filteredNodes.forEach(node => {
        degrees[node.data.id] = 0;
      });
      
      filteredEdges.forEach(edge => {
        if (degrees[edge.data.source] !== undefined) degrees[edge.data.source]++;
        if (degrees[edge.data.target] !== undefined) degrees[edge.data.target]++;
      });
      
      filteredNodes = filteredNodes.filter(node =>
        degrees[node.data.id] >= filters.minDegree
      );
      
      const nodeIds = new Set(filteredNodes.map(n => n.data.id));
      filteredEdges = filteredEdges.filter(edge =>
        nodeIds.has(edge.data.source) && nodeIds.has(edge.data.target)
      );
    }

    return { nodes: filteredNodes, edges: filteredEdges };
  }, []);

  // Handle node selection
  const handleNodeSelect = useCallback((nodeData) => {
    setSelectedNode(nodeData.id);
    
    // Update URL params
    const params = new URLSearchParams(searchParams);
    params.set('selected', nodeData.id);
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  // Handle view type change
  const handleViewChange = useCallback((newView) => {
    setViewType(newView);
    const params = new URLSearchParams(searchParams);
    params.set('view', newView);
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  if (loading) {
    return (
      <Layout>
        <Loading />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="error-container">
          <h2>Error Loading Network</h2>
          <p>{error}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="network-page">
        {/* Page header */}
        <div className="network-header">
          <h1>Sufi Networks Visualization</h1>
          <div className="view-selector">
            <select value={viewType} onChange={(e) => handleViewChange(e.target.value)}>
              <option value="full">Full Network</option>
              <option value="source">By Source</option>
              <option value="ego">Ego Network</option>
              <option value="bio">Biography Network</option>
              <option value="transmission">Transmission Network</option>
            </select>
            
            <div className="toggle-buttons">
              <button 
                className={`toggle-btn ${showFilters ? 'active' : ''}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                Filters
              </button>
              <button 
                className={`toggle-btn ${showStats ? 'active' : ''}`}
                onClick={() => setShowStats(!showStats)}
              >
                Stats
              </button>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="network-content">
          {/* Left sidebar - Filters */}
          {showFilters && (
            <div className="network-sidebar left">
              <NetworkFilters
                registry={registry}
                relationships={relationships}
                onFiltersChange={setFilters}
                showAdvanced={true}
              />
            </div>
          )}

          {/* Center - Network Graph */}
          <div className="network-main">
            <NetworkGraph
              elements={elements}
              onNodeSelect={handleNodeSelect}
              layout={layout}
              height="600px"
              showStats={false}
              highlightNode={selectedNode}
            />
            <NetworkLegend
              showSources={true}
              showRelationships={true}
              showMetrics={metrics !== null}
              position="top-right"
            />
          </div>

          {/* Right sidebar - Stats */}
          {showStats && (
            <div className="network-sidebar right">
              <NetworkStats
                registry={registry}
                relationships={relationships}
                metrics={metrics}
                keyFigures={keyFigures}
                temporal={temporal}
                currentFilters={filters}
                selectedPerson={selectedNode}
              />
            </div>
          )}
        </div>

        {/* Network summary */}
        <div className="network-summary">
          <p>
            Showing {elements.nodes.length} people and {elements.edges.length} relationships
            {filters.searchTerm && ` matching "${filters.searchTerm}"`}
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Network;