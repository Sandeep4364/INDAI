import { useState } from 'react';
import axios from 'axios';

const BASE = 'http://localhost:8000';

const PRIORITY_CONFIG = {
  CRITICAL: { color: '#F85149', bg: 'rgba(248,81,73,0.1)', border: 'rgba(248,81,73,0.3)', icon: '🔴' },
  HIGH: { color: '#F0A500', bg: 'rgba(240,165,0,0.1)', border: 'rgba(240,165,0,0.3)', icon: '🟠' },
  MEDIUM: { color: '#D29922', bg: 'rgba(210,153,34,0.1)', border: 'rgba(210,153,34,0.3)', icon: '🟡' },
  LOW: { color: '#3FB950', bg: 'rgba(63,185,80,0.1)', border: 'rgba(63,185,80,0.3)', icon: '🟢' },
};

const STATUS_CONFIG = {
  HEALTHY: { color: '#3FB950', bg: 'rgba(63,185,80,0.1)', label: 'Healthy' },
  WARNING: { color: '#D29922', bg: 'rgba(210,153,34,0.1)', label: 'Warning' },
  CRITICAL: { color: '#F85149', bg: 'rgba(248,81,73,0.1)', label: 'Critical' },
  UNKNOWN: { color: '#8B949E', bg: 'rgba(139,148,158,0.1)', label: 'Unknown' },
};

const ALERT_TYPE_LABELS = {
  OVERDUE_INSPECTION: '📅 Overdue Inspection',
  RECURRING_FAILURE: '🔁 Recurring Failure',
  HIGH_RISK: '⚠️ High Risk',
  MAINTENANCE_DUE: '🔧 Maintenance Due',
  COMPLIANCE_GAP: '📋 Compliance Gap',
};

export default function AlertsHealth() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('alerts');
  const [filter, setFilter] = useState('ALL');

  const runAnalysis = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${BASE}/alerts`);
      setData(res.data);
      setActiveTab(res.data.alerts?.length > 0 ? 'alerts' : 'health');
    } catch (e) {
      setError('Could not reach backend. Make sure the server is running.');
    }
    setLoading(false);
  };

  const alerts = data?.alerts || [];
  const equipmentList = data?.equipment_health || [];
  const filteredAlerts = filter === 'ALL' ? alerts : alerts.filter((a) => a.priority === filter);

  const criticalCount = alerts.filter((a) => a.priority === 'CRITICAL').length;
  const highCount = alerts.filter((a) => a.priority === 'HIGH').length;
  const healthyCount = equipmentList.filter((e) => e.status === 'HEALTHY').length;
  const criticalEquip = equipmentList.filter((e) => e.status === 'CRITICAL').length;

  const tab = (id, label) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: '7px 16px',
        borderRadius: 20,
        fontSize: 13,
        cursor: 'pointer',
        border: '1px solid var(--border)',
        fontFamily: 'var(--font)',
        background: activeTab === id ? 'var(--text-primary)' : 'transparent',
        color: activeTab === id ? 'var(--bg-base)' : 'var(--text-secondary)',
        transition: 'all .15s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="page-title">Alerts & Equipment Health</div>
      <div className="page-sub">
        IndAI proactively scans all indexed documents and warns engineers about risks, overdue inspections, and recurring
        failures.
      </div>

      <div style={{ marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={runAnalysis} disabled={loading}>
          {loading ? (
            <>
              <div className="spinner" style={{ width: 14, height: 14 }} /> Scanning all documents...
            </>
          ) : (
            '🚨 Run Predictive Analysis'
          )}
        </button>
        {loading && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
            IndAI is reading all documents, detecting risks, and scoring equipment health...
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Documents analyzed banner */}
      {data && data.documents_analyzed && (
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}
        >
          <span style={{ color: 'var(--green)', fontWeight: 500 }}>
            ✅ Analyzed {data.total_documents_analyzed} document{data.total_documents_analyzed !== 1 ? 's' : ''}: 
          </span>
          {data.documents_analyzed.map((d, i) => (
            <span key={d}>
              <span style={{ color: 'var(--amber)' }}>📄 {d}</span>
              {i < data.documents_analyzed.length - 1 && (
                <span style={{ color: 'var(--text-dim)' }}> · </span>
              )}
            </span>
          ))}
        </div>
      )}

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>

          {[
            { label: 'Total alerts', value: alerts.length, color: 'var(--text-primary)' },
            { label: 'Critical alerts', value: criticalCount, color: '#F85149' },
            { label: 'High priority', value: highCount, color: '#F0A500' },
            { label: 'Equipment tracked', value: equipmentList.length, color: 'var(--steel)' },
          ].map((s) => (
            <div key={s.label} className="card" style={{ padding: '14px 16px', marginBottom: 0, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {tab('alerts', `🚨 Alerts (${alerts.length})`)}
          {tab('health', `💊 Equipment Health (${equipmentList.length})`)}
        </div>
      )}

      {activeTab === 'alerts' && data && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
              <button
                key={p}
                onClick={() => setFilter(p)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                  border: '1px solid var(--border)',
                  background: filter === p ? 'var(--amber)' : 'transparent',
                  color: filter === p ? '#000' : 'var(--text-secondary)',
                }}
              >
                {p === 'ALL'
                  ? `All (${alerts.length})`
                  : `${PRIORITY_CONFIG[p].icon} ${p} (${alerts.filter((a) => a.priority === p).length})`}
              </button>
            ))}
          </div>

          {filteredAlerts.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <div className="empty-text">No {filter !== 'ALL' ? filter.toLowerCase() + ' ' : ''}alerts found.</div>
            </div>
          )}

          {filteredAlerts.map((alert, i) => {
            const cfg = PRIORITY_CONFIG[alert.priority] || PRIORITY_CONFIG.LOW;
            return (
              <div
                key={i}
                style={{
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{alert.title}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: cfg.color,
                          color: '#000',
                        }}
                      >
                        {alert.priority}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: 'var(--bg-elevated)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: 'var(--amber-glow)',
                          color: 'var(--amber)',
                          border: '1px solid var(--amber-dim)',
                        }}
                      >
                        ⚙ {alert.equipment_id}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.6 }}>{alert.description}</div>

                <div style={{ background: 'var(--bg-elevated)', borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3 }}>RECOMMENDED ACTION</div>
                  <div style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 500 }}>→ {alert.recommended_action}</div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>📄 Evidence: {alert.evidence}</div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'health' && data && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: `${healthyCount} Healthy`, color: '#3FB950' },
              { label: `${equipmentList.filter((e) => e.status === 'WARNING').length} Warning`, color: '#D29922' },
              { label: `${criticalEquip} Critical`, color: '#F85149' },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '4px 12px',
                  borderRadius: 20,
                  color: s.color,
                  background: s.color + '15',
                  border: `1px solid ${s.color}40`,
                }}
              >
                {s.label}
              </div>
            ))}
          </div>

          {equipmentList.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">⚙️</div>
              <div className="empty-text">No equipment data found in indexed documents.</div>
            </div>
          )}

          {equipmentList.map((eq, i) => {
            const st = STATUS_CONFIG[eq.status] || STATUS_CONFIG.UNKNOWN;
            const score = eq.health_score ?? 0;
            const barColor = score >= 80 ? '#3FB950' : score >= 50 ? '#D29922' : '#F85149';

            return (
              <div key={i} className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 20 }}>
                        {eq.type === 'Pump'
                          ? '🔄'
                          : eq.type === 'Compressor'
                          ? '💨'
                          : eq.type === 'Boiler'
                          ? '🔥'
                          : eq.type === 'Valve'
                          ? '🔩'
                          : '⚙️'}
                      </span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{eq.equipment_id}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {eq.name} · {eq.type}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: '50%',
                      border: `3px solid ${barColor}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 700, color: barColor, lineHeight: 1 }}>{score}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>HEALTH</div>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Health score</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '1px 8px',
                        borderRadius: 10,
                        background: st.bg,
                        color: st.color,
                      }}
                    >
                      {st.label}
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 3,
                        background: barColor,
                        width: `${score}%`,
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: 'Last inspection', value: eq.last_inspection || 'Unknown' },
                    { label: 'Next due', value: eq.next_inspection_due || 'Not specified' },
                    { label: 'Failures found', value: eq.failure_count ?? 0 },
                    { label: 'Top risk', value: eq.top_risk || 'None identified' },
                  ].map((d) => (
                    <div key={d.label} style={{ background: 'var(--bg-elevated)', borderRadius: 6, padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>{d.label.toUpperCase()}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{d.value}</div>
                    </div>
                  ))}
                </div>

                {alerts.filter((a) => a.equipment_id === eq.equipment_id).length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>ACTIVE ALERTS</div>
                    {alerts
                      .filter((a) => a.equipment_id === eq.equipment_id)
                      .map((a, j) => {
                        const cfg = PRIORITY_CONFIG[a.priority] || PRIORITY_CONFIG.LOW;
                        return (
                          <div
                            key={j}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: 12,
                              color: 'var(--text-secondary)',
                              marginBottom: 4,
                            }}
                          >
                            <span>{cfg.icon}</span>
                            <span style={{ color: cfg.color, fontWeight: 500 }}>{a.priority}</span>
                            <span>—</span>
                            <span>{a.title}</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!data && !loading && (
        <div>
          <div className="empty-state" style={{ marginBottom: 20 }}>
            <div className="empty-icon">🚨</div>
            <div className="empty-text">Click "Run Predictive Analysis" to scan all indexed documents and detect risks.</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { icon: '📅', title: 'Overdue inspections', desc: 'Detects equipment with expired or missing inspection dates.' },
              { icon: '🔁', title: 'Recurring failures', desc: 'Flags equipment that has failed multiple times.' },
              { icon: '⚠️', title: 'High risk equipment', desc: 'Identifies critical assets based on failure history.' },
              { icon: '💊', title: 'Health scoring', desc: 'Assigns 0–100 health score to each piece of equipment.' },
              { icon: '📋', title: 'Compliance gaps', desc: 'Links compliance violations to specific equipment.' },
              { icon: '🔧', title: 'Maintenance schedule', desc: 'Recommends upcoming maintenance actions.' },
            ].map((f) => (
              <div key={f.title} className="card" style={{ padding: '14px 16px', marginBottom: 0 }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{f.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

