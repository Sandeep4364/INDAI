import { useState } from 'react';
import axios from 'axios';
import { BASE } from '../api';

export default function GraphViewer() {
  const [loading, setLoading] = useState(false);
  const [built, setBuilt] = useState(false);
  const [error, setError] = useState('');

  const buildGraph = async () => {
    setLoading(true);
    setError('');
    try {
      await axios.post(`${BASE}/graph/build`);
      setBuilt(true);
    } catch (e) {
      setError('Failed to build graph. Make sure documents are ingested and Neo4j is connected.');
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="page-title">Knowledge Graph</div>
      <div className="page-sub">
        Visual map of equipment, failures, documents and dates extracted from your industrial documents.
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={buildGraph} disabled={loading}>
          {loading
            ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Building graph...</>
            : '🔗 Build Knowledge Graph'}
        </button>

        {built && (
          <a
            href={`${BASE}/graph/view`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost"
          >
            🌐 Open Full Graph
          </a>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {built && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <iframe
            src={`${BASE}/graph/view`}
            style={{ width: '100%', height: 560, border: 'none', background: '#0d1117' }}
            title="IndAI Knowledge Graph"
          />
        </div>
      )}

      {!built && !loading && (
        <>
          <div className="empty-state">
            <div className="empty-icon">🕸️</div>
            <div className="empty-text">Click "Build Knowledge Graph" to generate the graph from ingested documents</div>
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <div className="result-label" style={{ marginBottom: 10 }}>What this graph shows</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { color: '#F0A500', label: 'Equipment nodes', desc: 'P-101, C-201, B-202, PRV-101...' },
                { color: '#4A7FA5', label: 'Document nodes', desc: 'Maintenance reports, inspection records, SOPs' },
                { color: '#F85149', label: 'Failure nodes', desc: 'Vibration, wear, corrosion, overheating, leak' },
                { color: '#3FB950', label: 'Date nodes', desc: 'Inspection dates, maintenance dates' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}