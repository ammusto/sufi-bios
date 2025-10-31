import React, { useState, useEffect } from 'react';
import { Search, Filter, X } from 'lucide-react';
import './NetworkFilters.css';

const NetworkFilters = ({
  registry,
  relationships,
  onFiltersChange,
  availableSources = ['sulami', 'ansari', 'hilya'],
  showAdvanced = true
}) => {
  // Filter state
  const [filters, setFilters] = useState({
    searchTerm: '',
    sources: [],
    relationshipTypes: [],
    dateRange: { min: null, max: null },
    hasDeathDate: null,
    minDegree: null,
    communities: []
  });

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [availableFilters, setAvailableFilters] = useState({
    relationshipTypes: [],
    dateRange: { min: null, max: null },
    communities: []
  });

  // Extract available filter options from data
  useEffect(() => {
    if (!relationships) return;

    // Get unique relationship types
    const relTypes = new Set();
    relationships.edges.forEach(edge => {
      if (edge.type) relTypes.add(edge.type);
    });
    
    // Get date range from registry
    let minYear = Infinity;
    let maxYear = -Infinity;
    
    Object.values(registry || {}).forEach(person => {
      if (person.death_date?.year_hijri) {
        const year = parseInt(person.death_date.year_hijri);
        if (year && year < minYear) minYear = year;
        if (year && year > maxYear) maxYear = year;
      }
    });

    setAvailableFilters({
      relationshipTypes: Array.from(relTypes).sort(),
      dateRange: {
        min: minYear === Infinity ? null : minYear,
        max: maxYear === -Infinity ? null : maxYear
      },
      communities: [] // Will be populated if community data is loaded
    });
  }, [registry, relationships]);

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    const newFilters = { ...filters, [filterType]: value };
    setFilters(newFilters);
    
    // Debounce search
    if (filterType === 'searchTerm') {
      clearTimeout(window.searchTimeout);
      window.searchTimeout = setTimeout(() => {
        onFiltersChange(newFilters);
      }, 300);
    } else {
      onFiltersChange(newFilters);
    }
  };

  // Handle source toggle
  const toggleSource = (source) => {
    const newSources = filters.sources.includes(source)
      ? filters.sources.filter(s => s !== source)
      : [...filters.sources, source];
    handleFilterChange('sources', newSources);
  };

  // Handle relationship type toggle
  const toggleRelationType = (type) => {
    const newTypes = filters.relationshipTypes.includes(type)
      ? filters.relationshipTypes.filter(t => t !== type)
      : [...filters.relationshipTypes, type];
    handleFilterChange('relationshipTypes', newTypes);
  };

  // Clear all filters
  const clearAllFilters = () => {
    const clearedFilters = {
      searchTerm: '',
      sources: [],
      relationshipTypes: [],
      dateRange: { min: null, max: null },
      hasDeathDate: null,
      minDegree: null,
      communities: []
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  // Check if any filters are active
  const hasActiveFilters = () => {
    return filters.searchTerm ||
           filters.sources.length > 0 ||
           filters.relationshipTypes.length > 0 ||
           filters.dateRange.min ||
           filters.dateRange.max ||
           filters.hasDeathDate !== null ||
           filters.minDegree ||
           filters.communities.length > 0;
  };

  // Format relationship type for display
  const formatRelationType = (type) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="network-filters">
      <div className="filters-header">
        <h3><Filter size={18} /> Network Filters</h3>
        {hasActiveFilters() && (
          <button className="clear-filters-btn" onClick={clearAllFilters}>
            <X size={14} /> Clear All
          </button>
        )}
      </div>

      {/* Search */}
      <div className="filter-section">
        <label className="filter-label">Search by Name</label>
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search for a person..."
            value={filters.searchTerm}
            onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
            className="search-input"
          />
          {filters.searchTerm && (
            <button
              className="clear-search"
              onClick={() => handleFilterChange('searchTerm', '')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Source filters */}
      <div className="filter-section">
        <label className="filter-label">Sources</label>
        <div className="checkbox-group">
          {availableSources.map(source => (
            <label key={source} className="checkbox-label">
              <input
                type="checkbox"
                checked={filters.sources.includes(source)}
                onChange={() => toggleSource(source)}
              />
              <span className={`source-badge ${source}`}>
                {source.charAt(0).toUpperCase() + source.slice(1)}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Relationship type filters */}
      <div className="filter-section">
        <label className="filter-label">Relationship Types</label>
        <div className="checkbox-group">
          {availableFilters.relationshipTypes.map(type => (
            <label key={type} className="checkbox-label">
              <input
                type="checkbox"
                checked={filters.relationshipTypes.includes(type)}
                onChange={() => toggleRelationType(type)}
              />
              <span>{formatRelationType(type)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <>
          <button
            className="advanced-toggle"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          >
            {isAdvancedOpen ? '− Hide' : '+ Show'} Advanced Filters
          </button>

          {isAdvancedOpen && (
            <div className="advanced-filters">
              {/* Date range filter */}
              {availableFilters.dateRange.min && (
                <div className="filter-section">
                  <label className="filter-label">Death Date Range (Hijri)</label>
                  <div className="date-range-inputs">
                    <input
                      type="number"
                      placeholder="Min year"
                      min={availableFilters.dateRange.min}
                      max={availableFilters.dateRange.max}
                      value={filters.dateRange.min || ''}
                      onChange={(e) => handleFilterChange('dateRange', {
                        ...filters.dateRange,
                        min: e.target.value ? parseInt(e.target.value) : null
                      })}
                      className="date-input"
                    />
                    <span>—</span>
                    <input
                      type="number"
                      placeholder="Max year"
                      min={availableFilters.dateRange.min}
                      max={availableFilters.dateRange.max}
                      value={filters.dateRange.max || ''}
                      onChange={(e) => handleFilterChange('dateRange', {
                        ...filters.dateRange,
                        max: e.target.value ? parseInt(e.target.value) : null
                      })}
                      className="date-input"
                    />
                  </div>
                </div>
              )}

              {/* Has death date filter */}
              <div className="filter-section">
                <label className="filter-label">Death Date Status</label>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="deathDate"
                      checked={filters.hasDeathDate === null}
                      onChange={() => handleFilterChange('hasDeathDate', null)}
                    />
                    <span>All</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="deathDate"
                      checked={filters.hasDeathDate === true}
                      onChange={() => handleFilterChange('hasDeathDate', true)}
                    />
                    <span>Has Date</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="deathDate"
                      checked={filters.hasDeathDate === false}
                      onChange={() => handleFilterChange('hasDeathDate', false)}
                    />
                    <span>No Date</span>
                  </label>
                </div>
              </div>

              {/* Minimum degree filter */}
              <div className="filter-section">
                <label className="filter-label">
                  Minimum Connections: {filters.minDegree || 0}
                </label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={filters.minDegree || 0}
                  onChange={(e) => handleFilterChange('minDegree', parseInt(e.target.value))}
                  className="range-input"
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Active filters summary */}
      {hasActiveFilters() && (
        <div className="active-filters">
          <label className="filter-label">Active Filters:</label>
          <div className="filter-tags">
            {filters.searchTerm && (
              <span className="filter-tag">
                Search: "{filters.searchTerm}"
                <button onClick={() => handleFilterChange('searchTerm', '')}>
                  <X size={12} />
                </button>
              </span>
            )}
            {filters.sources.map(source => (
              <span key={source} className="filter-tag">
                {source}
                <button onClick={() => toggleSource(source)}>
                  <X size={12} />
                </button>
              </span>
            ))}
            {filters.relationshipTypes.map(type => (
              <span key={type} className="filter-tag">
                {formatRelationType(type)}
                <button onClick={() => toggleRelationType(type)}>
                  <X size={12} />
                </button>
              </span>
            ))}
            {(filters.dateRange.min || filters.dateRange.max) && (
              <span className="filter-tag">
                Date: {filters.dateRange.min || '?'} - {filters.dateRange.max || '?'}
                <button onClick={() => handleFilterChange('dateRange', { min: null, max: null })}>
                  <X size={12} />
                </button>
              </span>
            )}
            {filters.minDegree > 0 && (
              <span className="filter-tag">
                Min Degree: {filters.minDegree}
                <button onClick={() => handleFilterChange('minDegree', null)}>
                  <X size={12} />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkFilters;