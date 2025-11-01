import React from 'react';
import { X, Download, ArrowRight, BookOpen } from 'lucide-react';

/**
 * Stats panel for displaying node/person details
 * Shows transmission activity, chains, and action buttons
 */
const StatsPanel = ({ node, profile, chains, onClose, onAction, viewType }) => {
  if (!profile) return null;
  
  const { transmission_activity, chain_details } = profile;
  
  const handleExport = () => {
    // Prepare CSV data
    const headers = ['Chain ID', 'Position', 'Bio ID', 'Bio Name', 'Source', 'Full Chain', 'Text'];
    const rows = chain_details.map(detail => [
      detail.chain_id,
      detail.position,
      detail.bio_id,
      detail.bio_name,
      detail.source,
      detail.full_chain_names.join(' → '),
      detail.full_text.replace(/"/g, '""') // Escape quotes
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `person_${profile.person_id}_chains.csv`;
    link.click();
  };
  
  return (
    <div className="stats-panel">
      <div className="stats-header">
        <h3>{profile.name}</h3>
        <button className="close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      
      <div className="stats-content">
        <div className="stats-section">
          <h4>Overview</h4>
          <div className="stat-item">
            <span className="label">Person ID:</span>
            <span className="value">{profile.person_id}</span>
          </div>
          {profile.has_id && (
            <div className="stat-item">
              <span className="label">Biography ID:</span>
              <span className="value">{profile.has_id}</span>
            </div>
          )}
          <div className="stat-item">
            <span className="label">Total Chains:</span>
            <span className="value">{transmission_activity.total_chains}</span>
          </div>
          <div className="stat-item">
            <span className="label">Texts:</span>
            <span className="value">{transmission_activity.texts.join(', ')}</span>
          </div>
        </div>
        
        <div className="stats-section">
          <h4>Transmission Activity</h4>
          <div className="stat-item">
            <span className="label">Bio Subjects:</span>
            <span className="value">{transmission_activity.bio_subjects.length}</span>
          </div>
          <div className="stat-item">
            <span className="label">Upstream Contacts:</span>
            <span className="value">{transmission_activity.upstream.length}</span>
          </div>
          <div className="stat-item">
            <span className="label">Downstream Contacts:</span>
            <span className="value">{transmission_activity.downstream.length}</span>
          </div>
        </div>
        
        <div className="stats-section">
          <h4>Position Distribution</h4>
          {Object.entries(transmission_activity.positions)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([pos, count]) => (
              <div key={pos} className="position-bar">
                <span className="position-label">Position {pos}:</span>
                <div className="bar-container">
                  <div 
                    className="bar-fill" 
                    style={{ 
                      width: `${(count / transmission_activity.total_chains) * 100}%` 
                    }}
                  />
                  <span className="bar-value">{count}</span>
                </div>
              </div>
            ))}
        </div>
        
        <div className="stats-section">
          <h4>Appears in Chains For:</h4>
          <div className="bio-list">
            {Object.entries(transmission_activity.bio_names)
              .slice(0, 10)
              .map(([bioId, bioName]) => (
                <div key={bioId} className="bio-item">
                  <span className="bio-id">#{bioId}</span>
                  <span className="bio-name">{bioName}</span>
                </div>
              ))}
            {Object.keys(transmission_activity.bio_names).length > 10 && (
              <p className="more-items">
                ...and {Object.keys(transmission_activity.bio_names).length - 10} more
              </p>
            )}
          </div>
        </div>
        
        <div className="stats-section">
          <h4>Example Chains</h4>
          <div className="chain-examples">
            {chain_details.slice(0, 3).map((detail, idx) => (
              <div key={idx} className="chain-example">
                <div className="chain-path">
                  {detail.full_chain_names.map((name, i) => (
                    <React.Fragment key={i}>
                      <span 
                        className={i === detail.position ? 'highlight' : ''}
                      >
                        {name.split(' ').slice(0, 3).join(' ')}
                      </span>
                      {i < detail.full_chain_names.length - 1 && ' → '}
                    </React.Fragment>
                  ))}
                </div>
                <div className="chain-meta">
                  Bio #{detail.bio_id} ({detail.source})
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="stats-actions">
          <button 
            className="action-btn primary"
            onClick={() => onAction('focus-transmitter', node)}
          >
            <ArrowRight size={16} />
            Focus on Transmitter
          </button>
          
          {profile.has_id && (
            <button 
              className="action-btn secondary"
              onClick={() => onAction('view-biography', node)}
            >
              <BookOpen size={16} />
              View Biography
            </button>
          )}
          
          <button 
            className="action-btn export"
            onClick={handleExport}
          >
            <Download size={16} />
            Export All Chains (CSV)
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;