import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';

const EncyclopediaExcerpt = ({ excerpts }) => {
  const [activeTab, setActiveTab] = useState(0);

  console.log('EncyclopediaExcerpt received excerpts:', excerpts);

  if (!excerpts || excerpts.length === 0) {
    console.log('No excerpts to display');
    return null;
  }

  const currentExcerpt = excerpts[activeTab];

  if (!currentExcerpt) {
    console.log('Current excerpt is undefined, activeTab:', activeTab);
    return null;
  }

  return (
    <div style={{ marginBottom: '30px' }}>
      <h2>Encyclopedia Overview</h2>
      
      {/* Tabs */}
      <div style={{ 
        borderBottom: '2px solid #e0e0e0', 
        marginBottom: '20px',
        display: 'flex',
        gap: '10px'
      }}>
        {excerpts.map((excerpt, idx) => (
          <button
            key={idx}
            onClick={() => setActiveTab(idx)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === idx ? '#333' : 'transparent',
              color: activeTab === idx ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              fontSize: '14px',
              fontWeight: activeTab === idx ? 'bold' : 'normal'
            }}
          >
            {excerpt.source}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{
        background: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        padding: '20px'
      }}>
        <div style={{
          fontSize: '15px',
          lineHeight: '1.7',
          color: '#333',
          marginBottom: '20px'
        }}>
          {currentExcerpt.excerpt}
        </div>

        {/* Metadata */}
        <div style={{
          paddingTop: '15px',
          borderTop: '1px solid #e0e0e0',
          fontSize: '13px',
          color: '#666'
        }}>
          <div style={{ marginBottom: '5px' }}>
            <strong>Source:</strong> {currentExcerpt.source}
          </div>
          {currentExcerpt.authors && currentExcerpt.authors.length > 0 && (
            <div style={{ marginBottom: '5px' }}>
              <strong>Author{currentExcerpt.authors.length > 1 ? 's' : ''}:</strong> {currentExcerpt.authors.join(', ')}
            </div>
          )}
          <div>
            <a 
              href={currentExcerpt.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                color: '#1976d2',
                textDecoration: 'none'
              }}
            >
              Read full article <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EncyclopediaExcerpt;