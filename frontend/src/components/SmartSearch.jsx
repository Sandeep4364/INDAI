import { useState } from 'react';
import axios from 'axios';

const BASE = 'http://localhost:8000';

export default function SmartSearch() {
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState('');
  const [failure, setFailure] = useState('');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const FAILURE_TYPES = ['vibration', 'wear', 'leak', 'overheating', 'corrosion', 'failure', 'crack'];

  const search = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (equipment) params.append('equipment', equipment);
      if (failure) params.append('failure', failure);
      const { data } = await axios.get(`${BASE}/search?${params}`);
      setResults(data.results || []);
      setTotal(data.total || 0);
      setSearched(true);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const highlight = (text, term) => {
    if (!term) return text;
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safe})`, 'gi');
    return text.split(regex).map((part, i) =>
      regex.test(part) ? (
        <mark
          key={i}
          style={{ background: 'var(--amber)', color: '#000', borderRadius: 2, padding: '0 2px' }}
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const clear = () => {
    setQuery('');
    setEquipment('');
    setFailure('');
    setResults([]);
    setSearched(false);
  };

  return (
    <div>
      <div className="page-title">Smart Search</div>
      <div className="page-sub">Search across all indexed documents by keyword, equipment ID, or failure type.</div>

      <div className="card">
        {/* Main search */}
        <div style={{ marginBottom: 12 }}>
          <div className="result-label" style={{ marginBottom: 6 }}>
            Search query
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{
                flex: 1,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '9px 12px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font)',
                fontSize: 13,
                outline: 'none',
              }}
              placeholder="e.g. bearing replacement, IBR inspection, vibration alarm..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              onFocus={(e) => (e.target.style.borderColor = 'var(--amber)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
        </div>

        {/* Filters row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <div className="result-label" style={{ marginBottom: 6 }}>
              Equipment ID
            </div>
            <input
              style={{
                width: '100%',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '7px 10px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font)',
                fontSize: 12,
                outline: 'none',
              }}
              placeholder="e.g. P-101, C-201, B-202"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = 'var(--amber)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
          <div>
            <div className="result-label" style={{ marginBottom: 6 }}>
              Failure type
            </div>
            <select
              style={{
                width: '100%',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '7px 10px',
                color: failure ? 'var(--text-primary)' : 'var(--text-dim)',
                fontFamily: 'var(--font)',
                fontSize: 12,
                outline: 'none',
              }}
              value={failure}
              onChange={(e) => setFailure(e.target.value)}
            >
              <option value="">All failure types</option>
              {FAILURE_TYPES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={search} disabled={loading}>
            {loading ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14 }} /> Searching...
              </>
            ) : (
              '🔍 Search'
            )}
          </button>
          {searched && (
            <button className="btn btn-ghost" onClick={clear}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div style={{ marginTop: 4, marginBottom: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
          {total} result{total !== 1 ? 's' : ''} found
          {equipment && (
            <span>
              {' '}
              · Equipment: <span style={{ color: 'var(--amber)' }}>{equipment}</span>
            </span>
          )}
          {failure && (
            <span>
              {' '}
              · Failure: <span style={{ color: 'var(--amber)' }}>{failure}</span>
            </span>
          )}
        </div>
      )}

      {results.map((r, i) => (
        <div key={i} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>📄 {r.filename}</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>Page {r.page}</span>
            </div>
          </div>

          {r.entities?.equipment_ids?.length > 0 && (
            <div className="tag-row" style={{ marginBottom: 8 }}>
              {r.entities.equipment_ids.map((id) => (
                <span
                  key={id}
                  className="tag"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setEquipment(id);
                    search();
                  }}
                >
                  {id}
                </span>
              ))}
              {r.entities.failure_keywords?.map((k) => (
                <span key={k} className="tag" style={{ color: 'var(--amber)' }}>
                  {k}
                </span>
              ))}
            </div>
          )}

          <div
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              background: 'var(--bg-elevated)',
              padding: '10px 12px',
              borderRadius: 6,
            }}
          >
            {highlight(r.text, query)}
          </div>
        </div>
      ))}

      {searched && results.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <div className="empty-text">No results found. Try different keywords or remove filters.</div>
        </div>
      )}

      {!searched && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="result-label" style={{ marginBottom: 8 }}>
            Quick searches
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['bearing replacement', 'vibration alarm', 'IBR inspection', 'lubrication overdue', 'pressure relief valve'].map(
              (s) => (
                <button
                  key={s}
                  className="btn btn-ghost"
                  style={{ fontSize: 11 }}
                  onClick={() => {
                    setQuery(s);
                    setTimeout(search, 100);
                  }}
                >
                  {s}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

