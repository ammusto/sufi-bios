import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import cola from 'cytoscape-cola';
import { calculateNetworkStats } from '../../utils/networkDataLoader';
import './NetworkGraph.css';

// Register layout extensions
cytoscape.use(fcose);
cytoscape.use(cola);

// Cache for layout positions
const layoutCache = new Map();

const NetworkGraph = ({ 
  elements, 
  onNodeSelect, 
  onEdgeSelect,
  layout = 'fcose',
  height = '600px',
  showStats = true,
  highlightNode = null,
  metrics = null
}) => {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [layoutProgress, setLayoutProgress] = useState(0);

  // Generate cache key for current element set
  const cacheKey = useMemo(() => {
    if (!elements) return null;
    return `${elements.nodes.length}-${elements.edges.length}-${layout}`;
  }, [elements, layout]);

  // Optimized styles with edge aggregation support
  const cytoscapeStyle = useMemo(() => [
    // Node styles
    {
      selector: 'node',
      style: {
        'background-color': '#666',
        'label': 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': '12px',
        'color': '#fff',
        'text-outline-width': 2,
        'text-outline-color': '#666',
        'border-width': 2,
        'border-color': '#666',
        // Use fixed size initially, can enhance later
        'width': 30,
        'height': 30
      }
    },
    {
      selector: 'node[width]',
      style: {
        'width': 'data(width)',
        'height': 'data(height)'
      }
    },
    {
      selector: 'node:selected',
      style: {
        'background-color': '#ff6b6b',
        'border-color': '#ff6b6b',
        'border-width': 3,
        'z-index': 999
      }
    },
    // Edge styles
    {
      selector: 'edge',
      style: {
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'width': 2,
        'line-color': '#ccc',
        'target-arrow-color': '#ccc',
        'opacity': 0.6
      }
    },
    {
      selector: 'edge[width]',
      style: {
        'width': 'data(width)'
      }
    },
    {
      selector: 'edge[opacity]',
      style: {
        'opacity': 'data(opacity)'
      }
    },
    {
      selector: 'edge[color]',
      style: {
        'line-color': 'data(color)',
        'target-arrow-color': 'data(color)'
      }
    },
    {
      selector: 'edge[label]',
      style: {
        'label': 'data(label)',
        'font-size': '10px',
        'text-background-color': 'white',
        'text-background-opacity': 0.8,
        'text-background-padding': 2
      }
    },
    // Source-specific node colors
    {
      selector: 'node.sulami',
      style: {
        'background-color': '#51cf66',
        'border-color': '#40c057'
      }
    },
    {
      selector: 'node.ansari',
      style: {
        'background-color': '#ff8787',
        'border-color': '#fa5252'
      }
    },
    {
      selector: 'node.hilya',
      style: {
        'background-color': '#69db7c',
        'border-color': '#51cf66'
      }
    }
  ], []);

  // Optimized layout configurations
  const layoutConfigs = useMemo(() => ({
    fcose: {
      name: 'fcose',
      quality: 'default', // Use 'default' instead of 'proof' for faster layout
      randomize: !layoutCache.has(cacheKey),
      animate: false, // No animation for initial layout
      fit: true,
      padding: 50,
      nodeDimensionsIncludeLabels: false,
      uniformNodeDimensions: false,
      packComponents: true,
      // Simplified force settings for better performance
      nodeRepulsion: 4500,
      idealEdgeLength: 50,
      edgeElasticity: 0.45,
      nestingFactor: 0.1,
      gravity: 0.25,
      numIter: 1000, // Reduced iterations for faster initial layout
      tile: true,
      tilingPaddingVertical: 10,
      tilingPaddingHorizontal: 10,
      stop: function() { 
        setIsLoading(false);
        setLayoutProgress(100);
        // Cache the layout
        if (cyRef.current && cacheKey) {
          const positions = {};
          cyRef.current.nodes().forEach(node => {
            positions[node.id()] = node.position();
          });
          layoutCache.set(cacheKey, positions);
          console.log(`Cached layout for ${cacheKey}`);
        }
      }
    },
    cose: {
      name: 'cose',
      animate: false,
      randomize: true,
      fit: true,
      padding: 50,
      nodeRepulsion: 400000,
      idealEdgeLength: 100,
      edgeElasticity: 100,
      nestingFactor: 5,
      gravity: 80,
      numIter: 1000,
      initialTemp: 200,
      coolingFactor: 0.95,
      minTemp: 1.0,
      stop: function() {
        setIsLoading(false);
        setLayoutProgress(100);
      }
    },
    preset: {
      name: 'preset',
      positions: layoutCache.get(cacheKey) || undefined,
      animate: true,
      animationDuration: 500,
      fit: true,
      padding: 50,
      stop: function() { 
        setIsLoading(false);
        setLayoutProgress(100);
      }
    }
  }), [cacheKey]);

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current || !elements || elements.nodes.length === 0) return;

    console.log(`Initializing Cytoscape with ${elements.nodes.length} nodes, ${elements.edges.length} edges`);
    setIsLoading(true);
    setLayoutProgress(0);

    // Check if we have cached positions
    const hasCache = layoutCache.has(cacheKey);
    if (hasCache) {
      console.log('Using cached layout positions');
    }

    // Create Cytoscape instance
    const cy = cytoscape({
      container: containerRef.current,
      elements: [...elements.nodes, ...elements.edges],
      style: cytoscapeStyle,
      // Use cached layout if available
      layout: hasCache ? layoutConfigs.preset : layoutConfigs[layout],
      minZoom: 0.1,
      maxZoom: 3,
      wheelSensitivity: 0.2,
      boxSelectionEnabled: true,
      autounselectify: false,
      selectionType: 'single',
      // Performance optimizations
      textureOnViewport: true,
      motionBlur: true,
      motionBlurOpacity: 0.2,
      pixelRatio: 'auto'
    });

    cyRef.current = cy;

    // Event handlers
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      if (onNodeSelect) {
        onNodeSelect(node.data());
      }
    });

    cy.on('tap', 'edge', (evt) => {
      const edge = evt.target;
      if (onEdgeSelect) {
        onEdgeSelect(edge.data());
      }
    });

    // Calculate stats
    if (showStats && metrics) {
      const networkStats = calculateNetworkStats(elements, metrics);
      setStats(networkStats);
    }

    // Layout progress tracking
    if (!hasCache) {
      const progressInterval = setInterval(() => {
        setLayoutProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      cy.one('layoutstop', () => {
        clearInterval(progressInterval);
        setLayoutProgress(100);
      });
    }

    return () => {
      cy.destroy();
    };
  }, [elements, layout, onNodeSelect, onEdgeSelect, showStats, cytoscapeStyle, layoutConfigs, cacheKey, metrics]);

  // Handle highlighting
  useEffect(() => {
    if (!cyRef.current) return;

    cyRef.current.nodes().removeClass('highlighted');
    
    if (highlightNode) {
      const node = cyRef.current.getElementById(highlightNode);
      if (node) {
        node.addClass('highlighted');
        
        // Center on highlighted node
        cyRef.current.animate({
          center: { eles: node },
          zoom: 1.5
        }, {
          duration: 500
        });
      }
    }
  }, [highlightNode]);

  // Layout controls
  const changeLayout = useCallback((newLayout) => {
    if (!cyRef.current) return;
    
    setIsLoading(true);
    const layoutConfig = layoutConfigs[newLayout] || layoutConfigs.fcose;
    cyRef.current.layout(layoutConfig).run();
  }, [layoutConfigs]);

  const fitView = useCallback(() => {
    if (!cyRef.current) return;
    cyRef.current.fit(50);
  }, []);

  const resetView = useCallback(() => {
    if (!cyRef.current) return;
    cyRef.current.reset();
  }, []);

  const clearCache = useCallback(() => {
    layoutCache.clear();
    console.log('Layout cache cleared');
    if (cyRef.current) {
      setIsLoading(true);
      cyRef.current.layout(layoutConfigs[layout]).run();
    }
  }, [layout, layoutConfigs]);

  return (
    <div className="network-graph-container">
      {isLoading && (
        <div className="network-loading">
          <div className="loading-spinner"></div>
          <div>Calculating layout... {layoutProgress}%</div>
          <div className="loading-progress">
            <div className="loading-progress-bar" style={{ width: `${layoutProgress}%` }}></div>
          </div>
        </div>
      )}
      
      <div className="network-controls">
        <div className="control-group">
          <label>Layout:</label>
          <select onChange={(e) => changeLayout(e.target.value)} defaultValue={layout}>
            <option value="fcose">Force-Directed (fcose)</option>
            <option value="cose">Force-Directed (cose)</option>
            <option value="preset">Cached</option>
          </select>
        </div>
        
        <div className="control-buttons">
          <button onClick={fitView}>Fit View</button>
          <button onClick={resetView}>Reset</button>
          <button onClick={clearCache}>Clear Cache</button>
        </div>
      </div>

      <div 
        ref={containerRef} 
        className="cytoscape-container"
        style={{ height, width: '100%' }}
      />

      {showStats && stats && (
        <div className="network-stats">
          <div className="stat">
            <span className="stat-label">Nodes:</span>
            <span className="stat-value">{stats.nodeCount}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Edges:</span>
            <span className="stat-value">{stats.edgeCount}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Total Connections:</span>
            <span className="stat-value">{stats.totalConnections}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Max per Edge:</span>
            <span className="stat-value">{stats.maxConnections}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Avg Degree:</span>
            <span className="stat-value">{stats.avgDegree.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkGraph;