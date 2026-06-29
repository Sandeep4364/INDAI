import { useState } from 'react';
import { runCompliance } from '../api';

const STATUS_ICON = { PASS: '✅', FAIL: '❌', WARNING: '⚠️', NOT_APPLICABLE: '➖' };

export default function ComplianceDash() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ran, setRan] = useState(false);

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await runCompliance();
      setReports(data.reports || []);
      setRan(true);
    } catch (e) {
      setError('Could not reach backend. Make sure the server is running.');
    }
    setLoading(false);
  };

  const scoreClass = (score) => {
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-mid';
    return 'score-low';
  };

  const statusColor = (status) => {
    if (status === 'COMPLIANT') return 'var(--green)';
    if (status === 'PARTIALLY_COMPLIANT') return 'var(--yellow)';
    if (status === 'NON_COMPLIANT') return 'var(--red)';
    return 'var(--text-secondary)';
  };

  return (
    <div>
      <div className="page-title">Compliance Audit</div>
      <div className="page-sub">Check all ingested documents against Factory Act, OISD 116, ISO 10816-3, IBR 1950, and PESO standards.</div>

      <div style={{ marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={run} disabled={loading}>
          {loading
            ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Running audit — this takes ~30s</>
            : '▶ Run Compliance Audit'}
        </button>
        {loading && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
            Checking each document against compliance standards...
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {reports.map((report, i) => (
        <div key={i} className="card" style={{ marginBottom: 16 }}>
          <div className="compliance-header">
            <div>
              <div className="result-label">Document</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                📄 {report.document}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: statusColor(report.overall_status) }}>
                {report.overall_status?.replace(/_/g, ' ')}
              </div>
            </div>
            <div className={`score-circle ${scoreClass(report.compliance_score)}`}>
              {report.compliance_score}
            </div>
          </div>

          {report.auditor_summary && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
              {report.auditor_summary}
            </div>
          )}

          {report.critical_issues?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div className="result-label" style={{ marginBottom: 6, color: 'var(--red)' }}>⚠ Critical issues</div>
              {report.critical_issues.map((issue, j) => (
                <div key={j} style={{ fontSize: 12, color: 'var(--red)', padding: '4px 0', paddingLeft: 12, borderLeft: '2px solid var(--red)', marginBottom: 4 }}>
                  {issue}
                </div>
              ))}
            </div>
          )}

          <div className="result-label" style={{ marginBottom: 8 }}>Standard findings</div>
          {report.findings?.map((f, j) => (
            <div key={j} className="finding-row">
              <div className="finding-icon">{STATUS_ICON[f.status] || '➖'}</div>
              <div className="finding-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="finding-standard">{f.standard}</div>
                  <span className={`status-badge st-${f.status}`}>{f.status?.replace(/_/g, ' ')}</span>
                </div>
                <div className="finding-obs">{f.observation}</div>
                {f.action_required && f.action_required !== 'None' && (
                  <div className="finding-action">→ {f.action_required}</div>
                )}
              </div>
            </div>
          ))}

          {report.next_inspection_due && report.next_inspection_due !== 'Not specified' && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-dim)', fontSize: 12 }}>
              <span style={{ color: 'var(--text-dim)' }}>Next inspection due: </span>
              <span style={{ color: 'var(--amber)', fontWeight: 500 }}>{report.next_inspection_due}</span>
            </div>
          )}
        </div>
      ))}

      {!ran && !loading && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-text">Click "Run Compliance Audit" to check all indexed documents</div>
        </div>
      )}
    </div>
  );
}
