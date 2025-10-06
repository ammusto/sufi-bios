import React from 'react';
import { Star } from 'lucide-react';
import { Link } from 'react-router-dom';

const BioListItem = ({ bio, hasArticles }) => {
  return (
    <div className="search-result">
      <Link to={`/bio/${bio.bio_id}`} className="title-link">
        <div className="title-section">
          {bio.name_ar && (
            <div className="title-arabic">
              {bio.name_ar}
              {hasArticles && (
                <Star 
                  size={20} 
                  fill="#FFD700" 
                  stroke="#FFD700" 
                  style={{ display: 'inline', marginLeft: '8px', verticalAlign: 'middle' }} 
                />
              )}
            </div>
          )}
          {bio.name_lat && (
            <div className="title-turkish">{bio.name_lat}</div>
          )}
        </div>
      </Link>
      
      <div className="details-grid">
        <div className="details-column">
          {bio.hilya && (
            <div className="result-field">
              <span className="field-label">Hilya:</span>
              <span className="field-value">{bio.hilya}</span>
            </div>
          )}
          {bio.sulami && (
            <div className="result-field">
              <span className="field-label">Sulami:</span>
              <span className="field-value">{bio.sulami}</span>
            </div>
          )}
        </div>
        
        <div className="details-column">
          {bio.ansari && (
            <div className="result-field">
              <span className="field-label">Ansari:</span>
              <span className="field-value">{bio.ansari}</span>
            </div>
          )}
          {bio.manaqib && (
            <div className="result-field">
              <span className="field-label">Manaqib:</span>
              <span className="field-value">{bio.manaqib}</span>
            </div>
          )}
        </div>
        
        <div className="details-column">
          {bio.attar && (
            <div className="result-field">
              <span className="field-label">Attar:</span>
              <span className="field-value">{bio.attar}</span>
            </div>
          )}
          {bio.jami && (
            <div className="result-field">
              <span className="field-label">Jami:</span>
              <span className="field-value">{bio.jami}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BioListItem;