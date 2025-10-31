import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import { NetworkGraph } from '../components/Network';
import Loading from '../components/common/Loading';

const NetworkSimple = () => {
  const [elements, setElements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nodeCount, setNodeCount] = useState(50); // Start with just 50 nodes

  useEffect(() => {
    const loadSimpleNetwork = async () => {
      try {
        setLoading(true);
        
        // Load only the essential data
        const baseUrl = process.env.PUBLIC_URL || '';
        
        console.log('Loading simple network...');
        
        // Fetch with timeout
        const fetchWithTimeout = (url, timeout = 5000) => {
          return Promise.race([
            fetch(url),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
          ]);
        };
        
        const [registryResponse, relationshipsResponse] = await Promise.all([
          fetchWithTimeout(`${baseUrl}/data/names-registry.json`),
          fetchWithTimeout(`${baseUrl}/data/relationships.json`)
        ]);

        if (!registryResponse.ok || !relationshipsResponse.ok) {
          throw new Error('Failed to load data files');
        }

        const registry = await registryResponse.json();
        const relationships = await relationshipsResponse.json();

        console.log('Loaded registry:', Object.keys(registry).length);
        console.log('Loaded relationships:', relationships.edges.length);

        // Build limited elements for testing
        const nodes = [];
        const edges = [];
        const nodeIds = Object.keys(registry).slice(0, nodeCount);
        const nodeSet = new Set(nodeIds);

        // Add nodes
        nodeIds.forEach(id => {
          const person = registry[id];
          nodes.push({
            data: {
              id: id,
              label: person.canonical || `Person ${id}`,
              sources: person.sources || []
            },
            classes: person.sources?.join(' ') || ''
          });
        });

        // Add edges (only between our limited nodes)
        relationships.edges.forEach((edge, index) => {
          if (index > 500) return; // Limit edges for performance
          
          const source = String(edge.source);
          const target = String(edge.target);
          
          if (nodeSet.has(source) && nodeSet.has(target)) {
            edges.push({
              data: {
                id: `e${index}`,
                source: source,
                target: target,
                type: edge.type || 'unknown'
              },
              classes: edge.type || ''
            });
          }
        });

        console.log(`Created ${nodes.length} nodes and ${edges.length} edges`);
        
        setElements({ nodes, edges });
        setError(null);
      } catch (err) {
        console.error('Error loading network:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadSimpleNetwork();
  }, [nodeCount]);

  const handleNodeCountChange = (e) => {
    const count = parseInt(e.target.value);
    setNodeCount(count);
    setLoading(true);
  };

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <Loading />
          <p style={{ marginTop: '20px' }}>Loading network data...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h2>Error Loading Network</h2>
          <p>{error}</p>
          <p style={{ marginTop: '20px', color: '#666' }}>
            Make sure the data files are in the public/data/ directory:
            <br />
            - names-registry.json
            <br />
            - relationships.json
          </p>
        </div>
      </Layout>
    );
  }

  if (!elements) {
    return (
      <Layout>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <p>No network data available</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ padding: '20px' }}>
        <h1>Simple Network Visualization (Testing)</h1>
        
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          background: '#f0f0f0', 
          borderRadius: '4px' 
        }}>
          <label>
            Number of nodes to display: 
            <select 
              value={nodeCount} 
              onChange={handleNodeCountChange}
              style={{ marginLeft: '10px', padding: '4px' }}
            >
              <option value="10">10 nodes</option>
              <option value="25">25 nodes</option>
              <option value="50">50 nodes</option>
              <option value="100">100 nodes</option>
              <option value="200">200 nodes</option>
              <option value="500">500 nodes</option>
            </select>
          </label>
          <p style={{ margin: '10px 0 0', fontSize: '14px', color: '#666' }}>
            Currently showing: {elements.nodes.length} nodes, {elements.edges.length} edges
          </p>
        </div>

        <NetworkGraph
          elements={elements}
          height="600px"
          layout="fcose"
          showStats={true}
        />
      </div>
    </Layout>
  );
};

export default NetworkSimple;