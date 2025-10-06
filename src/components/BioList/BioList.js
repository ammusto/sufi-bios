import React, { useMemo } from 'react';
import SearchBar from './SearchBar';
import BioListItem from './BioListItem';
import Pagination from './Pagination';
import { searchMatches } from '../../utils/textNormalization';
import { ITEMS_PER_PAGE } from '../../utils/constants';

const BioList = ({ data, currentPage, searchTerm, onSearchChange, onPageChange }) => {
  const { bios, info } = data;

  // Filter bios by search term
  const filteredBios = useMemo(() => {
    if (!searchTerm) return bios;
    
    return bios.filter(bio => 
      searchMatches(bio.name_ar, searchTerm) ||
      searchMatches(bio.name_lat, searchTerm)
    );
  }, [bios, searchTerm]);

  // Create a set of bio_ids that have articles
  const biosWithArticles = useMemo(() => {
    return new Set(
      info
        .filter(item => item.cat === 'entity' && item.bio_id)
        .map(item => item.bio_id)
    );
  }, [info]);

  // Pagination
  const totalPages = Math.ceil(filteredBios.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedBios = filteredBios.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="container">
      <div className="header">
        <h1>Sufi Biographies</h1>
        <div className="stats">
          {filteredBios.length} biographies
          {searchTerm && ` (filtered from ${bios.length})`}
        </div>
      </div>

      <SearchBar searchTerm={searchTerm} onSearchChange={onSearchChange} />

      <div className="main-content">
        {paginatedBios.length === 0 ? (
          <div className="no-results">No biographies found</div>
        ) : (
          <div className="results-list">
            {paginatedBios.map(bio => (
              <BioListItem
                key={bio.bio_id}
                bio={bio}
                hasArticles={biosWithArticles.has(bio.bio_id)}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        )}
      </div>
    </div>
  );
};

export default BioList;