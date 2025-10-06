import React, { useMemo, useEffect } from 'react';
import SearchBar from './SearchBar';
import BioListItem from './BioListItem';
import Pagination from './Pagination';
import { searchMatches } from '../../utils/textNormalization';
import { ITEMS_PER_PAGE } from '../../utils/constants';

const BioList = ({ data, currentPage, searchTerm, onSearchChange, onPageChange }) => {
  const { bios, info } = data;

  // DEBUG: Log the data
  useEffect(() => {
    console.log('=== BioList Debug ===');
    console.log('Total bios:', bios?.length);
    console.log('First bio object:', bios?.[0]);
    console.log('First bio keys:', bios?.[0] ? Object.keys(bios[0]) : 'no bio');
    console.log('First bio bio_id:', bios?.[0]?.bio_id);
    console.log('Total info items:', info?.length);
    console.log('First info object:', info?.[0]);
  }, [bios, info]);

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

  // DEBUG: Log paginated bios
  useEffect(() => {
    console.log('=== Pagination Debug ===');
    console.log('Paginated bios count:', paginatedBios.length);
    console.log('First paginated bio:', paginatedBios[0]);
    console.log('Bios with articles (first 10):', Array.from(biosWithArticles).slice(0, 10));
  }, [paginatedBios, biosWithArticles]);

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
            {paginatedBios.map((bio, index) => {
              // DEBUG: Log each bio being rendered
              if (index === 0) {
                console.log('Rendering first bio:', bio);
                console.log('bio.bio_id:', bio.bio_id);
                console.log('typeof bio.bio_id:', typeof bio.bio_id);
              }
              
              return (
                <BioListItem
                  key={bio.bio_id || index}
                  bio={bio}
                  hasArticles={biosWithArticles.has(bio.bio_id)}
                />
              );
            })}
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