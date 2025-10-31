import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { 
  NetworkGraph, 
  NetworkFilters, 
  NetworkStats,
  NetworkLegend
} from '../components/Network';
import { 
  loadNetworkData,
  buildCytoscapeElements,
  getEgoNetwork
} from '../utils/networkDataLoader';
import Loading from '../components/common/Loading';
import './Network.css';

const Network = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Data states
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const dataLoadedRef = useRef(false);
  
  // View states
  const [elements, setElements] = useState({ nodes: [], edges: [] });
  const [filters, setFilters] = useState({});
  const [selectedNode, setSelectedNode] = useState(null);
  const [viewType, setViewType] = useState(searchParams.get('view') || 'top');
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
        
        // Load all data with optimized loader
        const loadedData = await loadNetworkData();
        
        if (!loadedData.registry || !loadedData.relationships) {
          throw new Error('Core network data is missing');
        }
        
        console.log('Loaded registry:', Object.keys(loadedData.registry).length, 'people');
        console.log('Loaded relationships:', loadedData.relationships.edges.length, 'edges');
        console.log('Loaded network index:', loadedData.networkIndex ? 'Yes' : 'No');
        console.log('Loaded metrics:', loadedData.metrics ? 'Yes' : 'No');
        
        setData(loadedData);
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
    if (!data) return;

    let newElements = { nodes: [], edges: [] };
    
    // Get view parameters from URL
    const personId = searchParams.get('person');
    const source = searchParams.get('source');
    const degree = parseInt(searchParams.get('degree')) || 1;

    switch (viewType) {
      case 'ego':
        if (personId) {
          newElements = getEgoNetwork(
            personId, 
            data.registry, 
            data.networkIndex,
            data.relationships, 
            data.metrics,
            degree
          );
        }
        break;
        
      case 'source':
        newElements = buildCytoscapeElements(
          data.registry, 
          data.relationships,
          data.networkIndex,
          data.metrics,
          {
            sources: [source || 'sulami']
          }
        );
        break;
        
      case 'top':
        // Show top 500 most connected nodes
        newElements = buildCytoscapeElements(
          data.registry, 
          data.relationships,
          data.networkIndex,
          data.metrics,
          {
            maxNodes: 500
          }
        );
        break;
        
      case 'top1000':
        // Show top 1000 most connected nodes
        newElements = buildCytoscapeElements(
          data.registry, 
          data.relationships,
          data.networkIndex,
          data.metrics,
          {
            maxNodes: 1000
          }
        );
        break;
        
      case 'full':
      default:
        // Full network with all nodes
        newElements = buildCytoscapeElements(
          data.registry, 
          data.relationships,
          data.networkIndex,
          data.metrics,
          filters
        );
        break;
    }

    setElements(newElements);
  }, [data, viewType, filters, searchParams]);

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

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

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
              <option value="top">Top 500 Nodes (Recommended)</option>
              <option value="top1000">Top 1000 Nodes</option>
              <option value="full">Full Network (2900+ nodes)</option>
              <option value="source">By Source</option>
              <option value="ego">Ego Network</option>
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
                registry={data.registry}
                relationships={data.relationships}
                onFiltersChange={handleFiltersChange}
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
              metrics={data.metrics}
            />
            <NetworkLegend
              showSources={true}
              showRelationships={true}
              showMetrics={true}
              position="top-right"
            />
          </div>

          {/* Right sidebar - Stats */}
          {showStats && (
            <div className="network-sidebar right">
              <NetworkStats
                registry={data.registry}
                relationships={data.relationships}
                metrics={data.metrics}
                keyFigures={data.keyFigures}
                temporal={data.temporal}
                currentFilters={filters}
                selectedPerson={selectedNode}
              />
            </div>
          )}
        </div>

        {/* Network summary */}
        <div className="network-summary">
          <p>
            Showing {elements.nodes.length} people and {elements.edges.length} unique connections
            {elements.edges.reduce((sum, e) => sum + (e.data.weight || 1), 0) > elements.edges.length && 
              ` (${elements.edges.reduce((sum, e) => sum + (e.data.weight || 1), 0)} total relationships)`
            }
            {filters.searchTerm && ` matching "${filters.searchTerm}"`}
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Network;