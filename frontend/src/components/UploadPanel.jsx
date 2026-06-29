import { useState, useRef, useEffect } from 'react';
import { uploadDocument, listDocuments } from '../api';
import axios from 'axios';

const ALLOWED_EXT = /\.(pdf|docx|doc|xlsx|xls|txt|csv)$/i;

const FILE_ICONS = { pdf: '📄', docx: '📝', doc: '📝', xlsx: '📊', xls: '📊', txt: '🗒️', csv: '📋' };

export default function UploadPanel({ onDocsUpdate }) {
  const [dragging, setDragging]       = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [uploadingFile, setUploadingFile] = useState('');
  const [results, setResults]         = useState([]);
  const [indexedDocs, setIndexedDocs] = useState([]);
  const [stats, setStats]             = useState({ total_documents: 0, total_chunks: 0, total_size_kb: 0 });
  const inputRef = useRef();

  const refreshDocs = async () => {
    try {
      const data = await listDocuments();
      setIndexedDocs(data.documents || []);
      setStats({
        total_documents: data.total_documents || 0,
        total_chunks: data.total_chunks || 0,
        total_size_kb: data.total_size_kb || 0
      });
      onDocsUpdate?.(data.files || []);
    } catch (e) {}
  };

  useEffect(() => {
    refreshDocs();
  }, []);

  const handleFiles = async (files) => {
    const valid = Array.from(files).filter((f) => ALLOWED_EXT.test(f.name));
    if (!valid.length) return;
    setUploading(true);
    const newResults = [];

    for (const file of valid) {
      setUploadingFile(file.name);
      try {
        const data = await uploadDocument(file);
        newResults.push({ file: file.name, ok: true, data });
      } catch (e) {
        newResults.push({ file: file.name, ok: false, error: e.response?.data?.detail || e.message });
      }
    }

    setResults((prev) => [...newResults, ...prev]);
    setUploading(false);
    setUploadingFile('');
    await refreshDocs();
  };

  const handleDelete = async (filename) => {
    if (!window.confirm(`Remove "${filename}" from index?`)) return;
    try {
      await axios.delete(`http://localhost:8000/documents/${encodeURIComponent(filename)}`);
      await refreshDocs();
    } catch (e) {
      alert('Failed to delete: ' + (e.response?.data?.detail || e.message));
    }
  };

  return (
    <div>
      <div className="page-title">Documents</div>
      <div className="page-sub">Upload documents to index them. Files persist across sessions.</div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Documents', value: stats.total_documents, icon: '📁' },
          { label: 'Chunks indexed', value: stats.total_chunks, icon: '🧩' },
          {
            label: 'Storage',
            value: `${(stats.total_size_kb / 1024).toFixed(2)} MB`,
            icon: '💾',
          },
        ].map((s) => (
          <div
            key={s.label}
            className="card"
            style={{ flex: 1, padding: '12px 16px', marginBottom: 0, textAlign: 'center' }}
          >
            <div style={{ fontSize: 20 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--amber)', marginTop: 4 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>


      {/* Upload zone */}
      <div
        className={`upload-zone ${dragging ? 'drag-over' : ''}`}
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="upload-icon">📂</div>
        <div className="upload-text">
          <strong>Click to upload</strong> or drag & drop — multiple files supported
        </div>
        <div className="upload-text" style={{ marginTop: 6, fontSize: 11 }}>
          PDF · DOCX · Excel · TXT · CSV
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.csv"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {uploading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 14,
            color: 'var(--text-secondary)',
            fontSize: 13,
          }}
        >
          <div className="spinner" /> Indexing <strong style={{ color: 'var(--amber)' }}>{uploadingFile}</strong>...
        </div>
      )}

      {/* Upload results */}
      {results.map((r, i) => (
        <div key={i} className={`alert ${r.ok ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 10 }}>
          {r.ok ? '✅' : '❌'} <strong>{r.file}</strong>
          {r.ok && (
            <>
              {' '}
              — {r.data.pages} page(s), {r.data.chunks || r.data.entities?.equipment_ids?.length || 0} chunks indexed.
            </>
          )}
          {!r.ok && <> — {r.error}</>}
        </div>
      ))}

      {/* Document library (SQLite metadata) */}
      {indexedDocs.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="result-label" style={{ marginBottom: 12 }}>
            Document Library — {indexedDocs.length} file{indexedDocs.length !== 1 ? 's' : ''}
          </div>
          {indexedDocs.map((doc) => (
            <div
              key={doc.filename}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid var(--border-dim)',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>
                  {FILE_ICONS[doc.file_type] || '📄'}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {doc.filename}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                    {doc.pages} pages · {doc.chunks} chunks · {doc.file_size_kb} KB · {doc.uploaded_at}
                  </div>

                  {Array.isArray(doc.equipment_ids) && doc.equipment_ids.length > 0 && (
                    <div className="tag-row" style={{ marginTop: 5 }}>
                      {doc.equipment_ids.map((id) => (
                        <span key={id} className="tag">{id}</span>
                      ))}
                      {Array.isArray(doc.failure_keywords) &&
                        doc.failure_keywords.map((k) => (
                          <span key={k} className="tag" style={{ color: 'var(--amber)' }}>{k}</span>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleDelete(doc.filename)}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  borderRadius: 4,
                  padding: '3px 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                onMouseOver={(e) => {
                  e.target.style.color = 'var(--red)';
                  e.target.style.borderColor = 'var(--red)';
                }}
                onMouseOut={(e) => {
                  e.target.style.color = 'var(--text-secondary)';
                  e.target.style.borderColor = 'var(--border)';
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {indexedDocs.length === 0 && !uploading && (
        <div className="empty-state" style={{ marginTop: 20 }}>
          <div className="empty-icon">📭</div>
          <div className="empty-text">No documents in database yet. Upload files above to get started.</div>
        </div>
      )}

    </div>
  );
}

