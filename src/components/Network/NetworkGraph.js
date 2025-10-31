import React, { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import cola from 'cytoscape-cola';
import { calculateNetworkStats } from '../../utils/networkDataLoader';
import './NetworkGraph.css';

// Register layout extensions
cytoscape.use(fcose);
cytoscape.use(cola);

const NetworkGraph = ({ 
  elements, 
  onNodeSelect, 
  onEdgeSelect,
  layout = 'fcose',
  height = '600px',
  showStats = true,
  highlightNode = null,
  styleConfig = {}
}) => {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [stats, setStats] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Default styles
  const defaultStyle = [
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
        'width': 30,
        'height': 30,
        'border-width': 2,
        'border-color': '#666'
      }
    },
    {
      selector: 'node:selected',
      style: {
        'background-color': '#ff6b6b',
        'border-color': '#ff6b6b',
        'border-width': 3,
        'width': 40,
        'height': 40
      }
    },
    {
      selector: 'node.highlighted',
      style: {
        'background-color': '#4dabf7',
        'border-color': '#339af0',
        'border-width': 3,
        'width': 40,
        'height': 40
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
    },
    // Edge styles
    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': '#ccc',
        'target-arrow-color': '#ccc',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'opacity': 0.7
      }
    },
    {
      selector: 'edge:selected',
      style: {
        'width': 4,
        'line-color': '#ff6b6b',
        'target-arrow-color': '#ff6b6b',
        'opacity': 1
      }
    },
    // Relationship type styles
    {
      selector: 'edge.teacher_student',
      style: {
        'line-color': '#4c6ef5',
        'target-arrow-color': '#4c6ef5'
      }
    },
    {
      selector: 'edge.companion',
      style: {
        'line-color': '#15aabf',
        'target-arrow-color': '#15aabf',
        'target-arrow-shape': 'none'
      }
    },
    {
      selector: 'edge.isnad_transmission',
      style: {
        'line-color': '#fab005',
        'target-arrow-color': '#fab005',
        'line-style': 'dashed'
      }
    },
    {
      selector: 'edge.associate',
      style: {
        'line-color': '#ae3ec9',
        'target-arrow-color': '#ae3ec9',
        'target-arrow-shape': 'none',
        'line-style': 'dotted'
      }
    },
    // Hover effects
    {
      selector: 'node.hover',
      style: {
        'background-color': '#ffd43b',
        'border-color': '#fab005',
        'z-index': 999
      }
    },
    {
      selector: 'edge.hover',
      style: {
        'line-color': '#ff6b6b',
        'width': 3,
        'z-index': 999
      }
    }
  ];

  // Layout configurations
  const layoutConfigs = {
    fcose: {
      name: 'fcose',
      quality: 'default',
      randomize: true,
      animate: true,
      animationDuration: 1000,
      animationEasing: 'ease-out',
      fit: true,
      padding: 50,
      nodeDimensionsIncludeLabels: true,
      uniformNodeDimensions: false,
      packComponents: true,
      nodeRepulsion: 4500,
      idealEdgeLength: 50,
      edgeElasticity: 0.45,
      nestingFactor: 0.1,
      gravity: 0.25,
      numIter: 2500,
      tile: true,
      tilingPaddingVertical: 10,
      tilingPaddingHorizontal: 10,
      gravityRangeCompound: 1.5,
      gravityCompound: 1.0,
      stop: function() { setIsLoading(false); }
    },
    cola: {
      name: 'cola',
      animate: true,
      randomize: false,
      fit: true,
      padding: 50,
      nodeSpacing: 50,
      edgeLength: 100,
      maxSimulationTime: 4000,
      stop: function() { setIsLoading(false); }
    },
    circle: {
      name: 'circle',
      fit: true,
      padding: 50,
      animate: true,
      animationDuration: 1000,
      radius: undefined,
      startAngle: 3 / 2 * Math.PI,
      sweep: undefined,
      clockwise: true,
      sort: undefined,
      stop: function() { setIsLoading(false); }
    },
    concentric: {
      name: 'concentric',
      fit: true,
      padding: 50,
      animate: true,
      animationDuration: 1000,
      concentric: function(node) {
        return node.degree();
      },
      levelWidth: function() {
        return 2;
      },
      stop: function() { setIsLoading(false); }
    },
    breadthfirst: {
      name: 'breadthfirst',
      fit: true,
      directed: false,
      padding: 50,
      circle: false,
      grid: false,
      spacingFactor: 1.25,
      animate: true,
      animationDuration: 1000,
      stop: function() { setIsLoading(false); }
    }
  };

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current || !elements) return;

    setIsLoading(true);

    // Create Cytoscape instance
    const cy = cytoscape({
      container: containerRef.current,
      elements: [...elements.nodes, ...elements.edges],
      style: [...defaultStyle, ...(styleConfig.styles || [])],
      layout: layoutConfigs[layout] || layoutConfigs.fcose,
      minZoom: 0.1,
      maxZoom: 3,
      wheelSensitivity: 0.2,
      boxSelectionEnabled: true,
      autounselectify: false,
      selectionType: 'single'
    });

    cyRef.current = cy;

    // Event handlers
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      setSelectedNode(node.data());
      setSelectedEdge(null);
      if (onNodeSelect) {
        onNodeSelect(node.data());
      }
    });

    cy.on('tap', 'edge', (evt) => {
      const edge = evt.target;
      setSelectedEdge(edge.data());
      setSelectedNode(null);
      if (onEdgeSelect) {
        onEdgeSelect(edge.data());
      }
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
        setSelectedEdge(null);
      }
    });

    // Hover effects
    cy.on('mouseover', 'node', (evt) => {
      evt.target.addClass('hover');
      containerRef.current.style.cursor = 'pointer';
    });

    cy.on('mouseout', 'node', (evt) => {
      evt.target.removeClass('hover');
      containerRef.current.style.cursor = 'default';
    });

    cy.on('mouseover', 'edge', (evt) => {
      evt.target.addClass('hover');
      containerRef.current.style.cursor = 'pointer';
    });

    cy.on('mouseout', 'edge', (evt) => {
      evt.target.removeClass('hover');
      containerRef.current.style.cursor = 'default';
    });

    // Calculate stats
    if (showStats) {
      const networkStats = calculateNetworkStats(elements);
      setStats(networkStats);
    }

    return () => {
      cy.destroy();
    };
  }, [elements, layout, onNodeSelect, onEdgeSelect, showStats, styleConfig]);

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
  }, []);

  const fitView = useCallback(() => {
    if (!cyRef.current) return;
    cyRef.current.fit(50);
  }, []);

  const resetView = useCallback(() => {
    if (!cyRef.current) return;
    cyRef.current.reset();
  }, []);

  const exportImage = useCallback(() => {
    if (!cyRef.current) return;
    
    const png64 = cyRef.current.png({
      output: 'blob',
      bg: 'white',
      scale: 2
    });
    
    // Create download link
    const link = document.createElement('a');
    link.href = URL.createObjectURL(png64);
    link.download = 'network-graph.png';
    link.click();
  }, []);

  return (
    <div className="network-graph-container">
      {isLoading && (
        <div className="network-loading">
          <div className="loading-spinner"></div>
          <div>Rendering network...</div>
        </div>
      )}
      
      <div className="network-controls">
        <div className="control-group">
          <label>Layout:</label>
          <select onChange={(e) => changeLayout(e.target.value)} defaultValue={layout}>
            <option value="fcose">Force-Directed (fcose)</option>
            <option value="cola">Cola</option>
            <option value="circle">Circle</option>
            <option value="concentric">Concentric</option>
            <option value="breadthfirst">Breadth-First</option>
          </select>
        </div>
        
        <div className="control-buttons">
          <button onClick={fitView}>Fit View</button>
          <button onClick={resetView}>Reset</button>
          <button onClick={exportImage}>Export Image</button>
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
            <span className="stat-label">Density:</span>
            <span className="stat-value">{stats.density.toFixed(4)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Avg Degree:</span>
            <span className="stat-value">{stats.avgDegree.toFixed(2)}</span>
          </div>
        </div>
      )}

      {selectedNode && (
        <div className="selection-info">
          <h4>Selected Node</h4>
          <div className="info-item">
            <strong>Name:</strong> {selectedNode.label}
          </div>
          {selectedNode.deathDate && (
            <div className="info-item">
              <strong>Death:</strong> {selectedNode.deathDate.year_hijri} AH
            </div>
          )}
          {selectedNode.sources && selectedNode.sources.length > 0 && (
            <div className="info-item">
              <strong>Sources:</strong> {selectedNode.sources.join(', ')}
            </div>
          )}
        </div>
      )}

      {selectedEdge && (
        <div className="selection-info">
          <h4>Selected Edge</h4>
          <div className="info-item">
            <strong>Type:</strong> {selectedEdge.type}
          </div>
          <div className="info-item">
            <strong>Source Text:</strong> {selectedEdge.textSource}
          </div>
          {selectedEdge.context && (
            <div className="info-item">
              <strong>Context:</strong> {selectedEdge.context}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NetworkGraph;