import React, { useState } from 'react';
import { Search } from 'lucide-react';

const SearchBar = ({ searchTerm, onSearchChange }) => {
  const [localSearch, setLocalSearch] = useState(searchTerm);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearchChange(localSearch);
  };

  return (
    <div className="search-section">
      <form onSubmit={handleSubmit} className="search-main">
        <input
          type="text"
          className="search-input"
          placeholder="Search by name (Arabic or transliteration)..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
        />
        <button type="submit" className="search-button">
          <Search size={16} /> Search
        </button>
      </form>
    </div>
  );
};

export default SearchBar;