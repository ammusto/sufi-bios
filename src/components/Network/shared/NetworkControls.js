import React from 'react';
import { Download, Maximize2 } from 'lucide-react';

const NetworkControls = ({ 
  orientation, 
  onOrientationChange, 
  showPeerConnections, 
  onPeerConnectionsChange,
  onExport,
  onFullscreen 
}) => {
  return (
    <div style={{
      display: 'flex',
      gap: '15px',
      padding: '12px 16px',
      background: 'white',
      border: '1px solid #e0e0e0',
      borderRadius: '6px',
      fontSize: '14px'
    }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={showPeerConnections}
          onChange={(e) => onPeerConnectionsChange(e.target.checked)}
        />
        <span>Show Peer Connections</span>
      </label>
      
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>Orientation:</span>
        <select 
          value={orientation} 
          onChange={(e) => onOrientationChange(e.target.value)}
          style={{
            padding: '4px 8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            background: 'white',
            cursor: 'pointer'
          }}
        >
          <option value="left">Left (90° CCW)</option>
          <option value="right">Right (90° CW)</option>
          <option value="down">Down</option>
          <option value="up">Up (180°)</option>
        </select>
      </label>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
        {onFullscreen && (
          <button
            onClick={onFullscreen}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            <Maximize2 size={14} />
            Fullscreen
          </button>
        )}
        
        {onExport && (
          <button
            onClick={onExport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            <Download size={14} />
            Export
          </button>
        )}
      </div>
    </div>
  );
};

export default NetworkControls;