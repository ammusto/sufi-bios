import React from 'react';
import { Network, Users, User, BookOpen } from 'lucide-react';

const NetworkControls = ({
  viewType,
  sourceFilter,
  degreeFilter,
  minWeight,
  onViewChange,
  onFilterChange
}) => {
  return (
    <div className="network-controls">
      <div className="view-selector">
        <button
          className={`view-button ${viewType === 'transmission' ? 'active' : ''}`}
          onClick={() => onViewChange('transmission')}
          title="Full Transmission Network"
        >
          <Network size={20} />
          <span>Transmission</span>
        </button>
        <button
          className={`view-button ${viewType === 'transmitter' ? 'active' : ''}`}
          onClick={() => onViewChange('transmitter')}
          title="Focus on Transmitter"
        >
          <User size={20} />
          <span>Transmitter</span>
        </button>
        <button
          className={`view-button ${viewType === 'bio-transmission' ? 'active' : ''}`}
          onClick={() => onViewChange('bio-transmission')}
          title="Biography Transmission"
        >
          <Users size={20} />
          <span>Bio Transmission</span>
        </button>
        <button
          className={`view-button ${viewType === 'bio-network' ? 'active' : ''}`}
          onClick={() => onViewChange('bio-network')}
          title="Biography Network"
        >
          <BookOpen size={20} />
          <span>Bio Network</span>
        </button>
      </div>
      
      <div className="filter-controls">
        <div className="filter-group">
          <label>Source:</label>
          <select 
            value={sourceFilter} 
            onChange={(e) => onFilterChange('source', e.target.value)}
          >
            <option value="all">All Sources</option>
            <option value="sulami">Sulamī</option>
            <option value="ansari">Anṣārī</option>
            <option value="hilya">Ḥilya</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>Degrees:</label>
          <select 
            value={degreeFilter} 
            onChange={(e) => onFilterChange('degree', e.target.value)}
          >
            <option value="1">1st Degree</option>
            <option value="2">2nd Degree</option>
            <option value="3">3rd Degree</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>Min Weight:</label>
          <input
            type="number"
            min="0"
            max="50"
            value={minWeight}
            onChange={(e) => onFilterChange('minWeight', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default NetworkControls;