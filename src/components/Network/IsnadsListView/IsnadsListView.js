import React, { useState, useMemo, useRef, useEffect } from 'react';
import { List } from 'react-window';
import { Download, Search, X } from 'lucide-react';
import './IsnadsListView.css';

const toArray = (x) =>
  Array.isArray(x) ? x : x && typeof x === 'object' ? Object.keys(x).map(k => x[k]) : [];
const S = (v) => (v == null ? '' : String(v));

function Row({ index, style, items, onViewChange }) {
  const row = items[index];
  if (!row) return <div style={style}>…</div>;

  const names = Array.isArray(row.names) ? row.names : [];
  const seq = Array.isArray(row.sequence) ? row.sequence : [];
  const hasIds = Array.isArray(row.has_ids) ? row.has_ids : [];

  return (
    <div className="isnad-row" style={style}>
      <div className="isnad-header">
        <span className="isnad-id">{S(row.isnad_id)}</span>
        <span className="isnad-meta">
          Length: {row.length ?? names.length} |{' '}
          Bio:{' '}
          <span className="bio-link" onClick={() => (window.location.href = `/bio/${S(row.bio_id)}`)}>
            #{S(row.bio_id)} — {S(row.bio_name)}
          </span>{' '}
          | Source: {S(row.source)}
        </span>
      </div>

      <div className="isnad-chain">
        {names.map((name, idx) => (
          <React.Fragment key={idx}>
            <span
              className="person-name"
              onClick={() => onViewChange?.('transmitter', S(seq[idx] ?? ''))}
              title={`Transmitter ID: ${S(seq[idx] ?? '')}`}
            >
              {S(name)}
              {hasIds[idx] ? <span className="has-bio-indicator">★</span> : null}
            </span>
            {idx < names.length - 1 && <span className="chain-arrow"> → </span>}
          </React.Fragment>
        ))}
      </div>

      {S(row.full_text) && (
        <div className="isnad-text">
          {S(row.full_text).slice(0, 200)}
          {S(row.full_text).length > 200 && '…'}
        </div>
      )}
    </div>
  );
}

const IsnadsListView = ({ data = {}, filterPersonId, onViewChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPersonFilter, setSelectedPersonFilter] = useState(filterPersonId || '');
  const [listHeight, setListHeight] = useState(600);
  const containerRef = useRef(null);

  useEffect(() => {
    const upd = () => setListHeight(Math.max(400, (containerRef.current?.clientHeight ?? 600) - 12));
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);

  const allIsnads = useMemo(() => {
    const src = toArray(data?.isnads);
    const out = [];
    for (const isnad of src) {
      if (!isnad) continue;
      const occs = toArray(isnad.occurrences);
      const seq = Array.isArray(isnad.sequence) ? isnad.sequence : [];
      const names = Array.isArray(isnad.names) ? isnad.names.map(S) : [];
      const hasIds = Array.isArray(isnad.has_ids) ? isnad.has_ids : [];
      for (const occ of occs) {
        if (!occ) continue;
        out.push({
          isnad_id: isnad.isnad_id ?? '',
          sequence: seq,
          names,
          has_ids: hasIds,
          length: isnad.length ?? names.length,
          bio_id: occ.bio_id ?? '',
          bio_name: S(occ.bio_name),
          source: S(occ.source),
          full_text: S(occ.full_text),
        });
      }
    }
    return out;
  }, [data]);

  const allPersons = useMemo(() => {
    const seen = new Map();
    for (const p of toArray(data?.profiles)) {
      if (!p) continue;
      const id = S(p.person_id);
      if (!id) continue;
      if (!seen.has(id)) seen.set(id, { person_id: id, name: S(p.name) });
    }
    const arr = Array.from(seen.values());
    arr.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    return arr;
  }, [data]);

  const filteredIsnads = useMemo(() => {
    let f = allIsnads;
    if (selectedPersonFilter) {
      const pid = Number(selectedPersonFilter);
      f = f.filter((r) => Array.isArray(r.sequence) && r.sequence.includes(pid));
    }
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      f = f.filter((r) => {
        const inNames = Array.isArray(r.names) && r.names.some((n) => S(n).toLowerCase().includes(term));
        return inNames || S(r.bio_name).toLowerCase().includes(term) || S(r.source).toLowerCase().includes(term);
      });
    }
    return f;
  }, [allIsnads, selectedPersonFilter, searchTerm]);

  const handleExport = () => {
    const headers = ['Isnad ID', 'Length', 'Bio ID', 'Bio Name', 'Source', 'Full Isnad', 'Text'];
    const rows = filteredIsnads.map((r) => [
      S(r.isnad_id),
      r.length ?? '',
      S(r.bio_id),
      S(r.bio_name),
      S(r.source),
      (Array.isArray(r.names) ? r.names : []).map(S).join(' → '),
      S(r.full_text).replace(/"/g, '""'),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const suffix = selectedPersonFilter
      ? `_person_${selectedPersonFilter}`
      : searchTerm
      ? `_search_${searchTerm.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}`
      : '_all';
    a.download = `isnads${suffix}.csv`;
    a.click();
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedPersonFilter('');
  };

  const total = allIsnads.length;
  const shown = filteredIsnads.length;

  if (!toArray(data?.isnads).length) {
    return (
      <div className="isnads-list-view">
        <div className="error-message">
          <h2>No Data Available</h2>
          <p>Ensure the JSON network files are generated and passed in as props.</p>
        </div>
      </div>
    );
  }

  const rowProps = { items: filteredIsnads, onViewChange }; // never null/undefined
  const components = {};                                     // never null/undefined

  return (
    <div className="isnads-list-view">
      <div className="isnads-list-header">
        <h2>All Isnads</h2>
        <div className="isnads-count">Showing {shown} of {total} isnads</div>
      </div>

      {/* Controls */}
      <div className="isnads-controls">
        <div className="filter-section">
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by name, biography, or source..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="clear-search" onClick={() => setSearchTerm('')}>
                <X size={16} />
              </button>
            )}
          </div>

          <div className="person-filter">
            <label>Filter by person:</label>
            <select value={selectedPersonFilter} onChange={(e) => setSelectedPersonFilter(e.target.value)}>
              <option value="">All persons</option>
              {allPersons.map((p) => (
                <option key={p.person_id} value={p.person_id}>
                  {p.name} (#{p.person_id})
                </option>
              ))}
            </select>
          </div>

          {(searchTerm || selectedPersonFilter) && (
            <button className="clear-filters-btn" onClick={handleClearFilters}>
              Clear Filters
            </button>
          )}
        </div>

        <button className="export-btn" onClick={handleExport} disabled={shown === 0}>
          <Download size={16} />
          Export {shown ? `(${shown})` : ''}
        </button>
      </div>

      <div className="isnads-list-container" ref={containerRef}>
        {shown === 0 ? (
          <div className="no-isnads">No isnads match your filters.</div>
        ) : (
          <List
            rowComponent={Row}
            rowCount={shown}
            rowHeight={150}
            rowProps={rowProps}
            components={components}
            style={{ height: listHeight, width: '100%' }}  // object, not null
            overscanCount={3}
          />
        )}
      </div>
    </div>
  );
};

export default IsnadsListView;
