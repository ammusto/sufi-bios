import React, { useMemo } from 'react';

const BibliographySection = ({ articleData }) => {
  // Sort articles by source alphabetically
  const sortedArticleData = useMemo(() => {
    return [...articleData].sort((a, b) => 
      (a.source || '').localeCompare(b.source || '')
    );
  }, [articleData]);

  // Flatten all bibliographies with source prefixes
  const allBibliography = useMemo(() => {
    const bibliography = [];
    
    sortedArticleData.forEach(article => {
      if (article.bibliography && Array.isArray(article.bibliography)) {
        article.bibliography.forEach(entry => {
          bibliography.push({
            source: article.source,
            entry: entry
          });
        });
      }
    });
    
    return bibliography;
  }, [sortedArticleData]);

  if (allBibliography.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: '30px' }}>
      <h2>Bibliography</h2>
      <div style={{ 
        background: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        padding: '20px'
      }}>
        {allBibliography.map((item, index) => (
          <div 
            key={index}
            style={{ 
              marginBottom: '10px',
              fontSize: '14px',
              lineHeight: '1.6'
            }}
          >
            <strong>[{item.source}]</strong> {item.entry}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BibliographySection;