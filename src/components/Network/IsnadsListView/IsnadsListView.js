import React, { useState, useMemo, useRef, useEffect } from 'react';
import { List } from 'react-window';
import { Download, Search, X } from 'lucide-react';
import './IsnadsListView.css';

const toArray = (x) => {
  if (Array.isArray(x)) return x;
  if (x && typeof x === 'object') {
    const out = [];
    for (const k in x) if (Object.prototype.hasOwnProperty.call(x, k)) {
      const v = x[k];
      if (v != null) out.push(v);
    }
    return out;
  }
  return [];
};
const s = (v) => (v == null ? '' : String(v));

const IsnadsListView = ({ data = {}, filterPersonId, onViewChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPersonFilter, setSelectedPersonFilter] = useState(filterPersonId || '');
  const [listHeight, setListHeight] = useState(600);
  const containerRef = useRef(null);

  useEffect(() => {
    const updateHeight = () => {
      const h = containerRef.current?.clientHeight ?? 600;
      setListHeight(h > 200 ? h : 600);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const allIsnads = useMemo(() => {
    const src = toArray(data?.isnads);
    const out = [];
    for (const isnad of src) {
      if (!isnad) continue;
      const occs = toArray(isnad.occurrences);
      const seq = Array.isArray(isnad.sequence) ? isnad.sequence : [];
      const names = Array.isArray(isnad.names) ? isnad.names.map(s) : [];
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
          bio_name: s(occ.bio_name),
          source: s(occ.source),
          full_text: s(occ.full_text),
        });
      }
    }
    return out;
  }, [data]);

  const allPersons = useMemo(() => {
    // Map by id without Object.values
    const seen = new Map();
    const profiles = toArray(data?.profiles);
    for (const p of profiles) {
      if (!p) continue;
      const id = s(p.person_id);
      if (!id) continue;
      if (!seen.has(id)) seen.set(id, { person_id: id, name: s(p.name) });
    }
    const arr = Array.from(seen.values());
    // localeCompare tolerates empty strings
    arr.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    return arr;
  }, [data]);

  const filteredIsnads = useMemo(() => {
    let filtered = allIsnads;
    if (selectedPersonFilter) {
      const pid = Number(selectedPersonFilter);
      filtered = filtered.filter((row) => Array.isArray(row.sequence) && row.sequence.includes(pid));
    }
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      filtered = filtered.filter((row) => {
        const hitNames = Array.isArray(row.names) && row.names.some((n) => s(n).toLowerCase().includes(term));
        const hitBio = s(row.bio_name).toLowerCase().includes(term);
        return hitNames || hitBio;
      });
    }
    return filtered;
  }, [allIsnads, selectedPersonFilter, searchTerm]);

  const handleExport = () => {
    const headers = ['Isnad ID', 'Length', 'Bio ID', 'Bio Name', 'Source', 'Full Isnad', 'Text'];
    const rows = filteredIsnads.map((row) => [
      s(row.isnad_id),
      row.length ?? '',
      s(row.bio_id),
      s(row.bio_name),
      s(row.source),
      (Array.isArray(row.names) ? row.names : []).map(s).join(' → '),
      s(row.full_text).replace(/"/g, '""'),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const suffix = selectedPersonFilter
      ? `_person_${selectedPersonFilter}`
      : searchTerm
      ? `_search_${searchTerm.slice(0, 20)}`
      : '_all';
    a.download = `isnads${suffix}.csv`;
    a.click();
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedPersonFilter('');
  };

  const IsnadRow = ({ index, style }) => {
    const row = filteredIsnads[index];
    if (!row) return <div style={style}>…</div>;
    const names = Array.isArray(row.names) ? row.names : [];
    const seq = Array.isArray(row.sequence) ? row.sequence : [];
    const hasIds = Array.isArray(row.has_ids) ? row.has_ids : [];
    return (
      <div className="isnad-row" style={style}>
        <div className="isnad-header">
          <span className="isnad-id">{s(row.isnad_id)}</span>
          <span className="isnad-meta">
            Length: {row.length ?? names.length} |{' '}
            Bio:{' '}
            <span className="bio-link" onClick={() => (window.location.href = `/bio/${s(row.bio_id)}`)}>
              #{s(row.bio_id)} - {s(row.bio_name)}
            </span>{' '}
            | Source: {s(row.source)}
          </span>
        </div>
        <div className="isnad-chain">
          {names.map((name, idx) => (
            <React.Fragment key={idx}>
              <span
                className="person-name"
                onClick={() => onViewChange?.('transmitter', s(seq[idx] ?? ''))}
                title={`Click to view transmitter profile (ID: ${s(seq[idx] ?? '')})`}
              >
                {s(name)}
                {hasIds[idx] ? <span className="has-bio-indicator">★</span> : null}
              </span>
              {idx < names.length - 1 && <span className="chain-arrow"> → </span>}
            </React.Fragment>
          ))}
        </div>
        {s(row.full_text) && (
          <div className="isnad-text">
            {s(row.full_text).slice(0, 200)}
            {s(row.full_text).length > 200 && '…'}
          </div>
        )}
      </div>
    );
  };

  const total = allIsnads.length;
  const shown = filteredIsnads.length;

  return (
    <div className="isnads-list-view">
      <div className="isnads-list-header">
        <h2>All Isnads</h2>
        <div className="isnads-count">Showing {shown} of {total} isnads</div>
      </div>

      <div className="isnads-controls">
        <div className="filter-section">
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by name or biography..."
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
          Export {shown > 0 ? `(${shown})` : ''}
        </button>
      </div>

      <div className="isnads-list-container" ref={containerRef}>
        {shown === 0 ? (
          <div className="no-isnads">No isnads match your filters.</div>
        ) : (
          <List
            height={listHeight}
            itemCount={shown}
            itemSize={150}
            width="100%"
            itemKey={(index) => `${s(filteredIsnads[index]?.isnad_id)}-${index}`}
          >
            {IsnadRow}
          </List>
        )}
      </div>
    </div>
  );
};

export default IsnadsListView;
