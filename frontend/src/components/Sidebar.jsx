export default function Sidebar({ active, setActive, documents }) {
 const nav = [
  { id: 'upload',     icon: '📂', label: 'Documents' },
  { id: 'copilot',    icon: '💬', label: 'Copilot' },
  { id: 'rca',        icon: '⚡', label: 'Root Cause Analysis' },
  { id: 'alerts',     icon: '🚨', label: 'Alerts & Health' },
  { id: 'graph',      icon: '🕸️', label: 'Knowledge Graph' },
  { id: 'compliance', icon: '📋', label: 'Compliance' },
];


  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-text">IndAI</div>
        <div className="logo-sub">Industrial Intelligence</div>
      </div>

      <nav className="sidebar-nav">
        {nav.map(n => (
          <button
            key={n.id}
            className={`nav-item ${active === n.id ? 'active' : ''}`}
            onClick={() => setActive(n.id)}
          >
            <span className="icon">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>

      {documents.length > 0 && (
        <div className="sidebar-docs">
          <div className="docs-label">Indexed ({documents.length})</div>
          {documents.map(d => (
            <div
              key={typeof d === 'string' ? d : d.filename}
              className="doc-chip"
              title={typeof d === 'string' ? d : d.filename}
            >
              📄 {typeof d === 'string' ? d : d.filename}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
