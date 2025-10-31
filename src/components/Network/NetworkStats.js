import React, { useEffect, useState } from 'react';
import { TrendingUp, Users, Share2, Calendar, Award, BarChart2 } from 'lucide-react';
import './NetworkStats.css';

const NetworkStats = ({ 
  registry, 
  relationships, 
  metrics,
  keyFigures,
  temporal,
  currentFilters = null,
  selectedPerson = null 
}) => {
  const [stats, setStats] = useState({
    totalPeople: 0,
    totalEdges: 0,
    totalIsnads: 0,
    avgDegree: 0,
    density: 0,
    sourceCounts: {},
    relTypeCounts: {},
    dateRange: null,
    topFigures: []
  });

  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    if (!registry || !relationships) return;

    // Calculate basic stats
    const totalPeople = Object.keys(registry).length;
    const totalEdges = relationships.edges.length;
    const totalIsnads = relationships.isnad_chains.length;

    // Calculate source distribution
    const sourceCounts = {};
    Object.values(registry).forEach(person => {
      person.sources?.forEach(source => {
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      });
    });

    // Calculate relationship type distribution
    const relTypeCounts = {};
    relationships.edges.forEach(edge => {
      const type = edge.type || 'unknown';
      relTypeCounts[type] = (relTypeCounts[type] || 0) + 1;
    });

    // Calculate degree statistics
    const degrees = {};
    Object.keys(registry).forEach(id => {
      degrees[id] = 0;
    });
    
    relationships.edges.forEach(edge => {
      if (degrees[edge.source] !== undefined) degrees[edge.source]++;
      if (degrees[edge.target] !== undefined) degrees[edge.target]++;
    });

    const degreeValues = Object.values(degrees);
    const avgDegree = degreeValues.length > 0 
      ? degreeValues.reduce((a, b) => a + b, 0) / degreeValues.length 
      : 0;

    // Calculate density
    const possibleEdges = totalPeople * (totalPeople - 1);
    const density = possibleEdges > 0 ? totalEdges / possibleEdges : 0;

    // Get date range
    let dateRange = null;
    if (temporal) {
      dateRange = {
        min: temporal.min_year,
        max: temporal.max_year
      };
    }

    // Get top figures
    let topFigures = [];
    if (keyFigures?.by_degree) {
      topFigures = keyFigures.by_degree.slice(0, 5);
    } else if (metrics) {
      // Calculate from metrics if keyFigures not available
      const sorted = Object.entries(metrics)
        .sort((a, b) => (b[1].total_degree || 0) - (a[1].total_degree || 0))
        .slice(0, 5)
        .map(([id, data]) => ({
          id,
          name: registry[id]?.canonical || `Person ${id}`,
          value: data.total_degree || 0
        }));
      topFigures = sorted;
    }

    setStats({
      totalPeople,
      totalEdges,
      totalIsnads,
      avgDegree,
      density,
      sourceCounts,
      relTypeCounts,
      dateRange,
      topFigures
    });
  }, [registry, relationships, metrics, keyFigures, temporal]);

  // Calculate person-specific stats
  const getPersonStats = () => {
    if (!selectedPerson || !metrics || !registry) return null;

    const personMetrics = metrics[selectedPerson];
    const personData = registry[selectedPerson];
    
    if (!personMetrics || !personData) return null;

    // Count relationships by type
    const relCounts = { teacher: 0, student: 0, companion: 0, isnad: 0 };
    relationships.edges.forEach(edge => {
      if (edge.source === selectedPerson || edge.target === selectedPerson) {
        const type = edge.type?.split('_')[0] || 'other';
        relCounts[type] = (relCounts[type] || 0) + 1;
      }
    });

    // Count isnad appearances
    let isnadCount = 0;
    relationships.isnad_chains.forEach(chain => {
      if (chain.chain.map(String).includes(selectedPerson)) {
        isnadCount++;
      }
    });

    return {
      name: personData.canonical,
      variants: personData.variants?.length || 0,
      sources: personData.sources || [],
      deathDate: personData.death_date,
      metrics: personMetrics,
      relCounts,
      isnadCount
    };
  };

  const personStats = getPersonStats();

  // Format number with commas
  const formatNumber = (num) => {
    return num.toLocaleString();
  };

  // Format percentage
  const formatPercent = (num) => {
    return `${(num * 100).toFixed(2)}%`;
  };

  return (
    <div className="network-stats-panel">
      <div className="stats-header">
        <h3><BarChart2 size={18} /> Network Statistics</h3>
      </div>

      {/* Tab navigation */}
      <div className="stats-tabs">
        <button 
          className={`tab ${selectedTab === 'overview' ? 'active' : ''}`}
          onClick={() => setSelectedTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab ${selectedTab === 'distribution' ? 'active' : ''}`}
          onClick={() => setSelectedTab('distribution')}
        >
          Distribution
        </button>
        <button 
          className={`tab ${selectedTab === 'top' ? 'active' : ''}`}
          onClick={() => setSelectedTab('top')}
        >
          Top Figures
        </button>
        {personStats && (
          <button 
            className={`tab ${selectedTab === 'person' ? 'active' : ''}`}
            onClick={() => setSelectedTab('person')}
          >
            Selected Person
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="stats-content">
        {/* Overview tab */}
        {selectedTab === 'overview' && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <Users size={20} />
              </div>
              <div className="stat-info">
                <div className="stat-value">{formatNumber(stats.totalPeople)}</div>
                <div className="stat-label">Total People</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <Share2 size={20} />
              </div>
              <div className="stat-info">
                <div className="stat-value">{formatNumber(stats.totalEdges)}</div>
                <div className="stat-label">Relationships</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <TrendingUp size={20} />
              </div>
              <div className="stat-info">
                <div className="stat-value">{formatNumber(stats.totalIsnads)}</div>
                <div className="stat-label">Isnad Chains</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <BarChart2 size={20} />
              </div>
              <div className="stat-info">
                <div className="stat-value">{stats.avgDegree.toFixed(2)}</div>
                <div className="stat-label">Avg Connections</div>
              </div>
            </div>

            {stats.dateRange && (
              <div className="stat-card wide">
                <div className="stat-icon">
                  <Calendar size={20} />
                </div>
                <div className="stat-info">
                  <div className="stat-value">
                    {stats.dateRange.min} - {stats.dateRange.max} AH
                  </div>
                  <div className="stat-label">Date Range</div>
                </div>
              </div>
            )}

            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-value">{formatPercent(stats.density)}</div>
                <div className="stat-label">Network Density</div>
              </div>
            </div>
          </div>
        )}

        {/* Distribution tab */}
        {selectedTab === 'distribution' && (
          <div className="distribution-stats">
            <div className="distribution-section">
              <h4>By Source</h4>
              <div className="distribution-bars">
                {Object.entries(stats.sourceCounts).map(([source, count]) => (
                  <div key={source} className="bar-item">
                    <div className="bar-label">
                      <span>{source}</span>
                      <span>{count}</span>
                    </div>
                    <div className="bar-track">
                      <div 
                        className={`bar-fill ${source}`}
                        style={{ width: `${(count / stats.totalPeople) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="distribution-section">
              <h4>By Relationship Type</h4>
              <div className="distribution-bars">
                {Object.entries(stats.relTypeCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([type, count]) => (
                    <div key={type} className="bar-item">
                      <div className="bar-label">
                        <span>{type.replace(/_/g, ' ')}</span>
                        <span>{count}</span>
                      </div>
                      <div className="bar-track">
                        <div 
                          className="bar-fill"
                          style={{ width: `${(count / stats.totalEdges) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Top figures tab */}
        {selectedTab === 'top' && (
          <div className="top-figures">
            <h4><Award size={16} /> Most Connected People</h4>
            <div className="figures-list">
              {stats.topFigures.map((figure, index) => (
                <div key={figure.id} className="figure-item">
                  <div className="figure-rank">{index + 1}</div>
                  <div className="figure-info">
                    <div className="figure-name">{figure.name}</div>
                    <div className="figure-connections">
                      {figure.value} connections
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Person stats tab */}
        {selectedTab === 'person' && personStats && (
          <div className="person-stats">
            <h4>{personStats.name}</h4>
            
            <div className="person-details">
              <div className="detail-item">
                <span className="detail-label">Name Variants:</span>
                <span className="detail-value">{personStats.variants}</span>
              </div>
              
              <div className="detail-item">
                <span className="detail-label">Sources:</span>
                <span className="detail-value">
                  {personStats.sources.join(', ')}
                </span>
              </div>

              {personStats.deathDate && (
                <div className="detail-item">
                  <span className="detail-label">Death Date:</span>
                  <span className="detail-value">
                    {personStats.deathDate.year_hijri} AH
                  </span>
                </div>
              )}
            </div>

            <h5>Network Metrics</h5>
            <div className="metrics-grid">
              <div className="metric">
                <span className="metric-label">Degree:</span>
                <span className="metric-value">
                  {personStats.metrics.total_degree || 0}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Betweenness:</span>
                <span className="metric-value">
                  {personStats.metrics.betweenness?.toFixed(4) || 0}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">PageRank:</span>
                <span className="metric-value">
                  {personStats.metrics.pagerank?.toFixed(4) || 0}
                </span>
              </div>
            </div>

            <h5>Relationships</h5>
            <div className="relationship-counts">
              {Object.entries(personStats.relCounts).map(([type, count]) => (
                count > 0 && (
                  <div key={type} className="rel-count">
                    <span>{type}:</span>
                    <span>{count}</span>
                  </div>
                )
              ))}
              {personStats.isnadCount > 0 && (
                <div className="rel-count">
                  <span>Isnad appearances:</span>
                  <span>{personStats.isnadCount}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkStats;