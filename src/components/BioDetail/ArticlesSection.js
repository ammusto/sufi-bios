import React, { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { SOURCE_NAMES } from '../../utils/constants';

const ArticlesSection = ({ articles, articleData }) => {
  // Sort articles alphabetically by source
  const sortedArticles = useMemo(() => {
    return [...articles].sort((a, b) => {
      const sourceA = articleData.find(d => d.id === a.id)?.source || '';
      const sourceB = articleData.find(d => d.id === b.id)?.source || '';
      return sourceA.localeCompare(sourceB);
    });
  }, [articles, articleData]);

  return (
    <div style={{ marginBottom: '30px' }}>
      <h2>Encyclopedia Articles</h2>
      <div style={{ 
        background: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        padding: '20px'
      }}>
        {sortedArticles.map(article => {
          const data = articleData.find(d => d.id === article.id);
          if (!data) return null;

          const sourceName = SOURCE_NAMES[data.source] || data.source;
          const authors = data.authors?.join(', ') || 'Unknown';
          const published = data.published || 'N/A';

          return (
            <div 
              key={article.id} 
              style={{ 
                marginBottom: '15px',
                paddingBottom: '15px',
                borderBottom: '1px solid #f0f0f0'
              }}
            >
              <div style={{ marginBottom: '5px' }}>
                <strong>[{data.source}]</strong> {sourceName}
              </div>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                By {authors} ({published})
              </div>
              <a 
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ 
                  color: '#1976d2',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                {article.title} <ExternalLink size={14} />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ArticlesSection;