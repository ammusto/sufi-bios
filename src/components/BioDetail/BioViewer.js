import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TABAQAT_SOURCES } from '../../utils/constants';
import { usePageNavigation } from '../../hooks/usePageNavigation';

const BioViewer = ({ bio, currentTab, onTabChange }) => {
  const availableSources = useMemo(() => {
    return TABAQAT_SOURCES.filter(source => bio[source.key]);
  }, [bio]);

  const initialPages = useMemo(() => {
    const pages = {};
    availableSources.forEach(source => {
      pages[source.key] = parseInt(bio[source.key]) || 1;
    });
    return pages;
  }, [availableSources, bio]);

  const { currentPages, nextPage, prevPage } = usePageNavigation(initialPages);

  const activeTab = currentTab || (availableSources[0]?.key || '');

  if (availableSources.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: '30px' }}>
      <h2>Tabaqat Sources</h2>
      
      <div style={{ 
        borderBottom: '2px solid #e0e0e0', 
        marginBottom: '20px',
        display: 'flex',
        gap: '10px'
      }}>
        {availableSources.map(source => (
          <button
            key={source.key}
            onClick={() => onTabChange(source.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === source.key ? '#333' : 'transparent',
              color: activeTab === source.key ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              fontSize: '14px',
              fontWeight: activeTab === source.key ? 'bold' : 'normal'
            }}
          >
            {source.label} (p. {bio[source.key]})
          </button>
        ))}
      </div>

      {activeTab && (
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '20px',
            marginBottom: '15px'
          }}>
            <button
              onClick={() => prevPage(activeTab)}
              disabled={currentPages[activeTab] === 1}
              className="page-button"
            >
              <ChevronLeft size={16} /> Previous
            </button>
            
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
              Page {currentPages[activeTab]}
            </span>
            
            <button
              onClick={() => nextPage(activeTab)}
              className="page-button"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ 
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            padding: '10px',
            background: '#f9f9f9',
            textAlign: 'center'
          }}>
            <img
              src={`/data/texts/${activeTab}/${currentPages[activeTab]}.png`}
              alt={`${activeTab} page ${currentPages[activeTab]}`}
              style={{ 
                maxWidth: '100%',
                height: 'auto',
                border: '1px solid #ddd'
              }}
              onError={(e) => {
                e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="400" height="300" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="16" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3EImage not found%3C/text%3E%3C/svg%3E';
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BioViewer;