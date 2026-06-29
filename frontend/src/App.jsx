import { useState, useEffect } from 'react';
import './index.css';
import Sidebar from './components/Sidebar';
import UploadPanel from './components/UploadPanel';
import ChatInterface from './components/ChatInterface';
import RCADashboard from './components/RCADashboard';
import ComplianceDash from './components/ComplianceDash';
import GraphViewer from './components/GraphViewer';
import AlertsHealth from './components/AlertsHealth';
import { listDocuments } from './api';



export default function App() {
  const [page, setPage] = useState('upload');
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    listDocuments()
      .then(data => setDocuments((data.documents || []).map(doc => doc.filename)))
      .catch(() => {});
  }, []);

  const pages = {
    upload:     <UploadPanel onDocsUpdate={setDocuments} />,
    copilot:    <ChatInterface />,
    rca:        <RCADashboard />,
    alerts:     <AlertsHealth />,
    graph:      <GraphViewer />,
    compliance: <ComplianceDash />,
  };



  return (
    <div className="app-layout">
      <Sidebar active={page} setActive={setPage} documents={documents} />
      <main className="main-content">
        {pages[page]}
      </main>
    </div>
  );
}