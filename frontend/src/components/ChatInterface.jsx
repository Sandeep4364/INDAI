import { useState, useRef, useEffect } from 'react';
import { askCopilot } from '../api';

const SUGGESTIONS = [
  'Why did Pump P-101 fail?',
  'What were the inspection findings for Compressor C-201?',
  'What compliance standards apply to Boiler B-202?',
  'What is the next inspection due date for Boiler B-202?',
];

function uid() {
  // session id shown in amber top-right (not cryptographically secure)
  return Math.random().toString(16).slice(2) + '-' + Date.now().toString(16);
}

async function saveChat(payload) {
  const res = await fetch('/chat/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to save chat message');
  return res.json();
}

async function fetchSessions() {
  const res = await fetch('/chat/sessions');
  if (!res.ok) throw new Error('Failed to load sessions');
  return res.json();
}

async function fetchSessionMessages(sessionId) {
  const res = await fetch(`/chat/sessions/${sessionId}`);
  if (!res.ok) throw new Error('Failed to load session messages');
  return res.json();
}

async function deleteSession(sessionId) {
  const res = await fetch(`/chat/sessions/${sessionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete session');
  return res.json();
}

export default function ChatInterface() {
  const [tab, setTab] = useState('chat');

  const [sessionId, setSessionId] = useState(() => uid());
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: 'Hello! I am the IndAI Copilot. Ask me anything about your uploaded industrial documents — or use the 🎤 voice button to speak your question.',
      sources: [],
      created_at: null,
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceSupported] = useState(
    () => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
  );
  const [ttsSupported] = useState(() => 'speechSynthesis' in window);
  const [autoSpeak, setAutoSpeak] = useState(false);

  const bottomRef = useRef();
  const recognitionRef = useRef(null);

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const newSession = () => {
    setSessionId(uid());
    setMessages([
      {
        role: 'ai',
        text: 'Hello! I am the IndAI Copilot. Ask me anything about your uploaded industrial documents — or use the 🎤 voice button to speak your question.',
        sources: [],
        created_at: null,
      },
    ]);
    setInput('');
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('SpeechRecognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = (e) => {
      console.warn('SpeechRecognition error:', e);
      setListening(false);
      setInput((prev) => prev || '');
    };

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join('');

      setInput(transcript);

      if (e.results[e.results.length - 1].isFinal) {
        setListening(false);
        send(transcript);
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.warn('recognition.start() failed:', err);
      setListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
    }
  };

  const speakText = (text) => {
    if (!ttsSupported) return;

    window.speechSynthesis.cancel();

    const clean = text
      .replace(/\[Source[^\]]*\]/g, '')
      .replace(/[*_#`]/g, '')
      .slice(0, 500);

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 0.95;
    utterance.pitch = 1;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const send = async (q) => {
    const question = q || input.trim();
    if (!question || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: question, sources: [] }]);
    setLoading(true);

    // auto-save user message
    try {
      await saveChat({
        session_id: sessionId,
        role: 'user',
        text: question,
        sources: [],
      });
    } catch (e) {
      console.warn(e);
    }

    try {
      const data = await askCopilot(question);
      const aiText = data.answer;
      const sources = data.sources || [];

      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: aiText,
          sources,
        },
      ]);

      // auto-save AI message
      try {
        await saveChat({
          session_id: sessionId,
          role: 'ai',
          text: aiText,
          sources,
        });
      } catch (e) {
        console.warn(e);
      }

      if (autoSpeak && ttsSupported) {
        speakText(aiText);
      }
    } catch (e) {
      const errText = '⚠ Could not reach the IndAI backend. Make sure the server is running at port 8000.';

      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: errText,
          sources: [],
        },
      ]);

      try {
        await saveChat({
          session_id: sessionId,
          role: 'ai',
          text: errText,
          sources: [],
        });
      } catch (ee) {
        console.warn(ee);
      }
    }

    setLoading(false);
  };

  const refreshSessions = async () => {
    setSessionsLoading(true);
    try {
      const data = await fetchSessions();
      setSessions(data.sessions || []);
    } catch (e) {
      console.warn(e);
      setSessions([]);
    }
    setSessionsLoading(false);
  };

  useEffect(() => {
    if (tab === 'history') refreshSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const loadSession = async (id) => {
    setTab('chat');
    setInput('');
    setLoading(true);

    setSessionId(id);
    try {
      const data = await fetchSessionMessages(id);
      const msgs = data.messages || [];

      // keep role/user/ai structure expected by existing UI
      setMessages(
        msgs.map((m) => ({
          role: m.role,
          text: m.text,
          sources: m.sources || [],
          created_at: m.created_at,
        }))
      );
    } catch (e) {
      console.warn(e);
      setMessages([
        {
          role: 'ai',
          text: '⚠ Failed to load that session. Try refreshing history.',
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (id) => {
    try {
      await deleteSession(id);
      await refreshSessions();
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <div>
      <div className="page-title">Industrial Copilot</div>
      <div className="page-sub">Chat with the AI, and manage saved sessions.</div>

      <div
        className="card"
        style={{
          marginBottom: 16,
          padding: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className={tab === 'chat' ? 'btn btn-primary' : 'btn btn-ghost'}
            onClick={() => setTab('chat')}
            style={{ fontSize: 12 }}
          >
            💬 Chat
          </button>
          <button
            className={tab === 'history' ? 'btn btn-primary' : 'btn btn-ghost'}
            onClick={() => setTab('history')}
            style={{ fontSize: 12 }}
          >
            🕐 History
          </button>
          {tab === 'chat' && (
            <button
              className="btn btn-ghost"
              onClick={newSession}
              style={{ fontSize: 12 }}
              title="Start a new chat (new session_id)"
            >
              + New
            </button>
          )}
        </div>

        {tab === 'chat' && (
          <div style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>
            session_id: <span style={{ color: 'var(--amber)' }}>{sessionId}</span>
          </div>
        )}
      </div>

      {tab === 'history' ? (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Saved chat sessions</div>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={refreshSessions}>
              ↻ Refresh
            </button>
          </div>

          {sessionsLoading ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading...</div>
          ) : sessions.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              No saved sessions yet. Ask a question in the Chat tab.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sessions.map((s) => (
                <div
                  key={s.session_id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 12,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <button
                    className="btn btn-ghost"
                    style={{
                      textAlign: 'left',
                      padding: 0,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'inherit',
                      maxWidth: '75%',
                    }}
                    onClick={() => loadSession(s.session_id)}
                    title="Load this session"
                  >
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      {s.first_question ? s.first_question.slice(0, 70) : '(no question)'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                      {s.message_count} msg • {String(s.started_at).replace('T', ' ').slice(0, 19)} →{' '}
                      {String(s.last_at).replace('T', ' ').slice(0, 19)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 6 }}>
                      {s.session_id}
                    </div>
                  </button>

                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12, color: 'var(--red)' }}
                    onClick={() => handleDeleteSession(s.session_id)}
                    title="Delete this session"
                  >
                    🗑 Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Voice controls banner */}
          <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>🎤 Voice Mode</div>
                {voiceSupported ? (
                  <span style={{ fontSize: 11, color: 'var(--green)' }}>✅ Supported</span>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--red)' }}>❌ Not supported in this browser</span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {ttsSupported && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🔊 Auto-read answers</span>
                    <div
                      onClick={() => setAutoSpeak((p) => !p)}
                      style={{
                        width: 36,
                        height: 20,
                        borderRadius: 10,
                        cursor: 'pointer',
                        background: autoSpeak ? 'var(--amber)' : 'var(--border)',
                        position: 'relative',
                        transition: 'background .2s',
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: '#fff',
                          position: 'absolute',
                          top: 2,
                          left: autoSpeak ? 18 : 2,
                          transition: 'left .2s',
                        }}
                      />
                    </div>
                  </div>
                )}

                {speaking && (
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={stopSpeaking}>
                    ⏹ Stop reading
                  </button>
                )}
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
              💡 Tip: Click the 🎤 button below to speak your question. Great for field technicians.
            </div>
          </div>

          {messages.length <= 1 && (
            <div style={{ marginBottom: 16 }}>
              <div className="result-label" style={{ marginBottom: 8 }}>
                Suggested questions
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="chat-history" style={{ padding: 16 }}>
              {messages.map((m, i) => (
                <div key={i} className={`msg msg-${m.role}`}>
                  <div className="msg-bubble" style={{ whiteSpace: 'pre-wrap' }}>
                    {m.text}

                    {m.role === 'ai' && ttsSupported && (
                      <button
                        onClick={() => (speaking ? stopSpeaking() : speakText(m.text))}
                        style={{
                          marginLeft: 10,
                          fontSize: 14,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          opacity: 0.6,
                          verticalAlign: 'middle',
                        }}
                        title={speaking ? 'Stop' : 'Read aloud'}
                      >
                        {speaking ? '⏹' : '🔊'}
                      </button>
                    )}
                  </div>

                  {m.sources?.length > 0 && (
                    <div className="msg-sources" style={{ justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      {[...new Set(m.sources.map((s) => s.filename))].map((f) => (
                        <span key={f} className="source-tag">
                          📄 {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="msg msg-ai">
                  <div className="msg-bubble" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="spinner" /> Searching documents...
                  </div>
                </div>
              )}

              {listening && (
                <div className="msg msg-user">
                  <div
                    className="msg-bubble"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'rgba(240,165,0,0.15)',
                      border: '1px solid var(--amber)',
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: 'var(--amber)',
                        animation: 'pulse 1s infinite',
                      }}
                    />
                    <span style={{ color: 'var(--amber)' }}>Listening... speak now</span>
                    <button
                      onClick={stopListening}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        fontSize: 12,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
              <div className="chat-input-row">
                {voiceSupported && (
                  <button
                    onClick={listening ? stopListening : startListening}
                    disabled={loading}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 18,
                      flexShrink: 0,
                      background: listening ? 'var(--red)' : 'var(--amber)',
                      color: '#000',
                      animation: listening ? 'pulse 1s infinite' : 'none',
                      transition: 'background .2s',
                    }}
                    title={listening ? 'Stop listening' : 'Start voice input'}
                  >
                    {listening ? '⏹' : '🎤'}
                  </button>
                )}

                <textarea
                  className="chat-input"
                  rows={2}
                  placeholder={listening ? 'Listening...' : 'Ask about equipment failures, maintenance history, compliance...'}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />

                <button className="btn btn-primary" onClick={() => send()} disabled={loading || !input.trim()}>
                  Send
                </button>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                🎤 Voice · Enter to send · Shift+Enter for new line
              </div>
            </div>
          </div>

          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.6; transform: scale(1.1); }
            }
          `}</style>
        </>
      )}
    </div>
  );
}

