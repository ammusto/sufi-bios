import React, { useMemo } from 'react';

const BibliographySection = ({ articleData }) => {
  // Filter out nulls first, then sort articles by source alphabetically
  const sortedArticleData = useMemo(() => {
    return articleData
      .filter(article => article !== null && article !== undefined)
      .sort((a, b) => (a.source || '').localeCompare(b.source || ''));
  }, [articleData]);

  // Flatten all bibliographies with source prefixes
  const allBibliography = useMemo(() => {
    const bibliography = [];
    
    sortedArticleData.forEach(article => {
      let bibEntries = [];
      
      // Case 1: Bibliography at top level (like eweb_066)
      if (article.bibliography && Array.isArray(article.bibliography)) {
        bibEntries = article.bibliography;
      }
      // Case 2: Bibliography nested in parts array (like eweb_245)
      else if (article.parts && Array.isArray(article.parts)) {
        article.parts.forEach(part => {
          if (part.bibliography && Array.isArray(part.bibliography)) {
            bibEntries = bibEntries.concat(part.bibliography);
          }
        });
      }
      
      // Add all entries with source prefix
      bibEntries.forEach(entry => {
        bibliography.push({
          source: article.source,
          entry: entry
        });
      });
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