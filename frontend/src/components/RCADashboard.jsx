import { useState } from 'react';
import { runRCA } from '../api';
import axios from 'axios';

const BASE = 'http://localhost:8000';

const EXAMPLES = [
  'Pump P-101 showing high vibration alarm',
  'Compressor C-201 discharge temperature exceeding limit',
  'Boiler B-202 pressure fluctuation during startup',
];

const FAILURE_TYPES = ['vibration', 'wear', 'leak', 'overheating', 'corrosion', 'failure', 'crack'];

export default function RCADashboard() {
  const [symptom, setSymptom] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('rca');

  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState('');
  const [failure, setFailure] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const analyze = async (s) => {
    const sym = s || symptom.trim();
    if (!sym) return;
    setSymptom(sym);
    setLoading(true);
    setError('');
    setResult(null);
    setActiveTab('rca');
    try {
      const data = await runRCA(sym);
      setResult(data);
    } catch (e) {
      setError('Could not reach backend. Make sure the server is running.');
    }
    setLoading(false);
  };

  const search = async (overrideQuery) => {
    setSearching(true);
    setActiveTab('search');
    try {
      const params = new URLSearchParams();
      const q = overrideQuery ?? query;
      if (q) params.append('q', q);
      if (equipment) params.append('equipment', equipment);
      if (failure) params.append('failure', failure);
      const { data } = await axios.get(`${BASE}/search?${params}`);
      setSearchResults(data.results || []);
      setSearchTotal(data.total || 0);
      setSearched(true);
    } catch (e) {
      console.error(e);
    }
    setSearching(false);
  };

  const highlight = (text, term) => {
    if (!term) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    return text.split(regex).map((part, i) =>
      regex.test(part)
        ? <mark key={i} style={{ background: 'var(--amber)', color: '#000', borderRadius: 2, padding: '0 2px' }}>{part}</mark>
        : part
    );
  };

  const sevColor = (s) => {
    if (s === 'CRITICAL') return 'var(--red)';
    if (s === 'HIGH') return 'var(--amber)';
    if (s === 'MEDIUM') return 'var(--yellow)';
    return 'var(--green)';
  };

  return (
    <div>
      <div className="page-title">Root Cause Analysis</div>
      <div className="page-sub">Analyze failure symptoms and search related documents side by side.</div>

      <div className="card">
        <div className="result-label" style={{ marginBottom: 8 }}>Describe the symptom</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
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
            placeholder="e.g. Pump P-101 showing high vibration alarm"
            value={symptom}
            onChange={e => setSymptom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && analyze()}
            onFocus={e => e.target.style.borderColor = 'var(--amber)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <button className="btn btn-primary" onClick={() => analyze()} disabled={loading || !symptom.trim()}>
            {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Analyzing</> : '⚡ Analyze'}
          </button>
        </div>

        <div className="result-label" style={{ marginBottom: 8 }}>Try an example</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {EXAMPLES.map(ex => (
            <button key={ex} className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => analyze(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="result-label" style={{ marginBottom: 10 }}>🔍 Search related documents</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
          <input
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '7px 10px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font)',
              fontSize: 12,
              outline: 'none',
            }}
            placeholder="Keyword search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            onFocus={e => e.target.style.borderColor = 'var(--amber)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <input
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '7px 10px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font)',
              fontSize: 12,
              outline: 'none',
            }}
            placeholder="Equipment ID (e.g. P-101)"
            value={equipment}
            onChange={e => setEquipment(e.target.value)}
            onFocus={e => e.target.style.borderColor = 'var(--amber)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <select
            style={{
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
            onChange={e => setFailure(e.target.value)}
          >
            <option value="">All failure types</option>
            {FAILURE_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => search()} disabled={searching}>
            {searching ? <><div className="spinner" style={{ width: 12, height: 12 }} /> Searching...</> : '🔍 Search Documents'}
          </button>
          {['bearing', 'lubrication', 'vibration', 'inspection'].map(s => (
            <button key={s} className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { setQuery(s); search(s); }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {(result || searched) && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {result && (
            <button
              className={`tab ${activeTab === 'rca' ? 'active' : ''}`}
              onClick={() => setActiveTab('rca')}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                border: '1px solid var(--border)',
                cursor: 'pointer',
                background: activeTab === 'rca' ? 'var(--text-primary)' : 'transparent',
                color: activeTab === 'rca' ? 'var(--bg-base)' : 'var(--text-secondary)',
              }}
            >
              ⚡ RCA Results {result?.possible_causes?.length ? `(${result.possible_causes.length})` : ''}
            </button>
          )}
          {searched && (
            <button
              className={`tab ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                border: '1px solid var(--border)',
                cursor: 'pointer',
                background: activeTab === 'search' ? 'var(--text-primary)' : 'transparent',
                color: activeTab === 'search' ? 'var(--bg-base)' : 'var(--text-secondary)',
              }}
            >
              🔍 Search Results ({searchTotal})
            </button>
          )}
        </div>
      )}

      {activeTab === 'rca' && result && (
        <div>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div className="result-label">Symptom analyzed</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>
                  {result.symptom}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--red)', fontWeight: 500 }}>⚡ Immediate action: </span>
                  {result.immediate_action}
                </div>
              </div>
              <div className={`severity-badge sev-${result.severity}`} style={{ whiteSpace: 'nowrap' }}>
                {result.severity}
              </div>
            </div>

            <button
              className="btn btn-ghost"
              style={{ marginTop: 12, fontSize: 12 }}
              onClick={() => { setQuery(result.symptom); search(result.symptom); }}
            >
              🔍 Search related documents for this symptom
            </button>
          </div>

          <div className="result-label" style={{ marginBottom: 10 }}>Probable causes</div>
          {result.possible_causes?.map((cause, i) => (
            <div key={i} className="cause-item">
              <div className="cause-header">
                <div className="cause-title">
                  <span style={{ color: 'var(--text-dim)', fontSize: 11, marginRight: 8 }}>#{i + 1}</span>
                  {cause.cause}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: sevColor(result.severity), whiteSpace: 'nowrap', marginLeft: 12 }}>
                  {cause.confidence}%
                </div>
              </div>
              <div className="confidence-bar-bg">
                <div className="confidence-bar-fill" style={{ width: `${cause.confidence}%` }} />
              </div>
              <div className="cause-meta">
                <span>Evidence: </span>{cause.evidence}<br />
                <span>Recommendation: </span>
                <span style={{ color: 'var(--amber)' }}>{cause.recommendation}</span>
              </div>
              <button
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '2px 8px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
                onClick={() => { setQuery(cause.cause); search(cause.cause); }}
              >
                🔍 Find documents about this cause
              </button>
            </div>
          ))}

          {result.sources?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="result-label" style={{ marginBottom: 6 }}>Sources used</div>
              <div className="tag-row">
                {[...new Set(result.sources.map(s => s.filename))].map(f => (
                  <span key={f} className="source-tag">📄 {f}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'search' && searched && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            {searchTotal} result{searchTotal !== 1 ? 's' : ''} found
            {equipment && <span> · Equipment: <span style={{ color: 'var(--amber)' }}>{equipment}</span></span>}
            {failure && <span> · Failure: <span style={{ color: 'var(--amber)' }}>{failure}</span></span>}
          </div>

          {searchResults.map((r, i) => (
            <div key={i} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  📄 {r.filename}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Page {r.page}</span>
              </div>
              {r.entities?.equipment_ids?.length > 0 && (
                <div className="tag-row" style={{ marginBottom: 8 }}>
                  {r.entities.equipment_ids.map(id => (
                    <span key={id} className="tag" style={{ cursor: 'pointer' }} onClick={() => { setEquipment(id); search(); }}>
                      {id}
                    </span>
                  ))}
                  {r.entities.failure_keywords?.map(k => (
                    <span key={k} className="tag" style={{ color: 'var(--amber)' }}>{k}</span>
                  ))}
                </div>
              )}
              <div style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                background: 'var(--bg-elevated)',
                padding: '10px 12px',
                borderRadius: 6,
              }}>
                {highlight(r.text, query)}
              </div>
            </div>
          ))}

          {searchResults.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <div className="empty-text">No results found. Try different keywords or remove filters.</div>
            </div>
          )}
        </div>
      )}

      {!result && !loading && !searched && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <div className="empty-text">Enter a symptom to run RCA or search documents above</div>
        </div>
      )}
    </div>
  );
}
