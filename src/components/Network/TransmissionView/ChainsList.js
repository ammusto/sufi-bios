import React from 'react';
import { X } from 'lucide-react';

/**
 * Chains list overlay
 * Shows all chains with details
 */
const ChainsList = ({ chains, onClose }) => {
  return (
    <div className="chains-list-overlay">
      <div className="chains-list-header">
        <h3>All Chains ({chains.length})</h3>
        <button className="close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      
      <div className="chains-list-content">
        {chains.map(chain => (
          <div key={chain.chain_id} className="chain-card">
            <div className="chain-card-header">
              <span className="chain-id">{chain.chain_id}</span>
              <span className="chain-length">Length: {chain.length}</span>
            </div>
            
            <div className="chain-sequence">
              {chain.names.map((name, idx) => (
                <React.Fragment key={idx}>
                  {name.split(' ').slice(0, 3).join(' ')}
                  {idx < chain.names.length - 1 && ' → '}
                </React.Fragment>
              ))}
            </div>
            
            <div className="chain-bios">
              <strong>Appears in:</strong> {chain.unique_bio_ids.length} biographies
              <br />
              <strong>Sources:</strong> {chain.sources.join(', ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChainsList;