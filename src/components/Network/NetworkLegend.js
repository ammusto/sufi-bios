import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import './NetworkLegend.css';

const NetworkLegend = ({ 
  showSources = true, 
  showRelationships = true,
  showMetrics = false,
  position = 'top-right' 
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={`network-legend ${position} ${isCollapsed ? 'collapsed' : ''}`}>
      <div 
        className="legend-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <span>Legend</span>
        {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </div>

      {!isCollapsed && (
        <div className="legend-content">
          {showSources && (
            <div className="legend-section">
              <div className="legend-title">Sources</div>
              <div className="legend-items">
                <div className="legend-item">
                  <div className="legend-node sulami"></div>
                  <span>Sulami</span>
                </div>
                <div className="legend-item">
                  <div className="legend-node ansari"></div>
                  <span>Ansari</span>
                </div>
                <div className="legend-item">
                  <div className="legend-node hilya"></div>
                  <span>Hilya</span>
                </div>
                <div className="legend-item">
                  <div className="legend-node multiple"></div>
                  <span>Multiple Sources</span>
                </div>
              </div>
            </div>
          )}

          {showRelationships && (
            <div className="legend-section">
              <div className="legend-title">Relationships</div>
              <div className="legend-items">
                <div className="legend-item">
                  <div className="legend-edge teacher"></div>
                  <span>Teacher → Student</span>
                </div>
                <div className="legend-item">
                  <div className="legend-edge companion"></div>
                  <span>Companions</span>
                </div>
                <div className="legend-item">
                  <div className="legend-edge isnad"></div>
                  <span>Isnad Chain</span>
                </div>
                <div className="legend-item">
                  <div className="legend-edge associate"></div>
                  <span>Associates</span>
                </div>
              </div>
            </div>
          )}

          {showMetrics && (
            <div className="legend-section">
              <div className="legend-title">Node Size</div>
              <div className="legend-items">
                <div className="legend-item">
                  <div className="size-demo">
                    <div className="size-node small"></div>
                    <div className="size-node medium"></div>
                    <div className="size-node large"></div>
                  </div>
                  <span>Degree/Importance</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NetworkLegend;