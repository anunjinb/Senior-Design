import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  UploadCloud, AlertCircle, FileText, PenTool, Cpu, BarChart3,
  CheckCircle, Sparkles, Send, Trash2, X, RefreshCw, ChevronDown,
  Bug, Database, BrainCircuit, Loader2
} from 'lucide-react';

const TAXONOMY = {
  "System Meta": ["Authentication", "UI / Dashboard", "Data Import", "ML Pipeline"],
  "DevTools": ["General", "Debugger", "Console", "Inspector", "Style Editor", "Netmonitor", "Source Editor", "Responsive Design Mode", "Object Inspector", "Storage Inspector", "JSON Viewer", "DOM", "Application Panel", "about:debugging", "geckodriver", "View Source"],
  "Layout": ["Layout", "Layout: Flexbox", "Layout: Grid", "CSS Parsing and Computation", "CSS Transitions and Animations", "MathML", "SVG", "Print Preview", "Printing: Output", "Printing: Setup"],
  "Networking": ["Networking", "HTTP", "WebSockets", "DNS", "WebRTC", "Networking: TLS", "Certificates", "Security", "Cache", "Cookies"],
  "Firefox": ["Tabbed Browser", "Address Bar", "Bookmarks", "Accessibility", "Theme", "Preferences", "Downloads"],
  "Core": ["JavaScript Engine", "JavaScript: GC", "WebAssembly", "DOM: Core & HTML", "DOM: Events", "DOM: Workers", "Graphics", "WebGL", "Gecko Profiler", "XPCOM", "IPC"]
};

const SEVERITIES = [
  { value: 'S1', label: 'S1 — Critical' },
  { value: 'S2', label: 'S2 — High' },
  { value: 'S3', label: 'S3 — Normal' },
  { value: 'S4', label: 'S4 — Low' },
];

const STATUSES = ['NEW', 'UNCONFIRMED', 'ASSIGNED', 'RESOLVED', 'VERIFIED', 'CLOSED'];

// ─── 5 Diverse Demo Bugs for the Magic Fill ─────────────────────────────────
const DEMO_BUGS = [
  { summary: "Unrecoverable fatal segfault in the JavaScript JIT compiler when executing recursive memory allocation scripts.", component: "JavaScript Engine", severity: "S1" },
  { summary: "Flexbox container ignores min-height constraints when nested inside a deeply calculated CSS Grid layout.", component: "Layout: Flexbox", severity: "S3" },
  { summary: "WebSockets drop randomly and fail to negotiate TLS handshakes on poor Wi-Fi connections.", component: "WebSockets", severity: "S2" },
  { summary: "WebGL context is lost and never restored when the laptop wakes from sleep mode, rendering canvas black.", component: "WebGL", severity: "S1" },
  { summary: "Typo in the Netmonitor tooltip: 'Transferred' is spelled incorrectly as 'Transfered'.", component: "Netmonitor", severity: "S4" }
];

function SevBadge({ sev }) {
  const SEV_COLORS = { S1: '#ef4444', S2: '#f97316', S3: '#3b82f6', S4: '#6b7280' };
  const color = SEV_COLORS[sev] || '#6b7280';
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: `${color}18`, color, flexShrink: 0, letterSpacing: 0.3 }}>
      {sev || '—'}
    </span>
  );
}

function StatusBadge({ status }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'var(--hover-bg)', color: 'var(--text-sec)', flexShrink: 0 }}>
      {status}
    </span>
  );
}

function Toast({ msg, onClose }) {
  if (!msg.text) return null;
  const isErr = msg.type === 'error';
  return (
    <div className="fade-in-up" style={{
      position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      background: isErr ? '#ef4444' : '#0f172a', color: '#fff',
      padding: '11px 22px', borderRadius: 50, boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
      display: 'flex', alignItems: 'center', gap: 10, zIndex: 9999,
      fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
      border: `1px solid ${isErr ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`
    }}>
      {isErr ? <AlertCircle size={15} /> : <CheckCircle size={15} color="#10b981" />}
      {msg.text}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.55, cursor: 'pointer', padding: 0, marginLeft: 4, display: 'flex' }}>
        <X size={13} />
      </button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-sec)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Select({ value, onChange, children, highlight }) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        className="sys-input" value={value} onChange={onChange}
        style={{ marginBottom: 0, paddingRight: 32, appearance: 'none', borderColor: highlight ? 'var(--success)' : 'var(--border)', cursor: 'pointer' }}
      >
        {children}
      </select>
      <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)', pointerEvents: 'none' }} />
    </div>
  );
}

export default function Submit({ user, prefill, onClearPrefill }) {
  const [mode, setMode] = useState('single');
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Form state
  const [summary, setSummary] = useState('');
  const [component, setComponent] = useState('');
  const [severity, setSeverity] = useState('S3');
  const [status, setStatus] = useState('NEW');

  // Right panel
  const [bugs, setBugs] = useState([]);
  const [bugsLoading, setBugsLoading] = useState(true);
  const [pendingDel, setPendingDel] = useState(null);
  const [batches, setBatches] = useState([]);

  // ML States
  const [isRetraining, setIsRetraining] = useState(false);
  const [trainingLog, setTrainingLog] = useState("");

  const auth = useCallback(() => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }), []);

  const toast = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  useEffect(() => {
    if (prefill?.component) {
      setComponent(prefill.component);
      if (onClearPrefill) onClearPrefill();
    }
  }, [prefill, onClearPrefill]);

  const loadBugs = useCallback(async () => {
    setBugsLoading(true);
    try {
      const res = await axios.get('/api/hub/explorer?limit=50&sort_key=bug_id&sort_dir=desc', auth());
      setBugs(res.data.bugs || []);
    } catch (e) { console.error('loadBugs:', e); }
    finally { setBugsLoading(false); }
  }, [auth]);

  const loadBatches = useCallback(async () => {
    try {
      const res = await axios.get('/api/batches', auth());
      setBatches(res.data || []);
    } catch (e) { console.error('loadBatches:', e); }
  }, [auth]);

  useEffect(() => { loadBugs(); loadBatches(); }, [loadBugs, loadBatches]);

  const handleSubmit = async () => {
    if (!summary.trim() || !component) {
      toast('Summary and component are required.', 'error'); return;
    }
    try {
      const payload = { bug: { summary: summary.trim(), component, severity, status, platform: "Web" }, company_id: user?.company_id };
      await axios.post('/api/bug', payload, auth());
      toast(`✅ Bug saved directly to firefox_table`);
      loadBugs();
      setSummary(''); setComponent(''); setSeverity('S3'); setStatus('NEW');
    } catch (e) {
      toast(e.response?.data?.detail || '❌ Failed to save record.', 'error');
    }
  };

  const confirmDelete = async (bugId) => {
    try {
      await axios.delete(`/api/bug/${bugId}`, auth());
      setBugs(prev => prev.filter(b => b.id !== bugId));
      setPendingDel(null);
      toast('🗑️ Bug successfully deleted from database.');
    } catch { toast('❌ Delete failed.', 'error'); }
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'csv' && ext !== 'json') {
        toast('❌ Error: Only CSV and JSON files are permitted.', 'error');
        e.target.value = null;
        return;
    }

    setIsRetraining(true);
    setTrainingLog("☁️ Uploading batch to Supabase...");

    const fd = new FormData();
    fd.append('file', file);
    fd.append('company_id', user?.company_id);

    try {
      await axios.post('/api/retrain', fd, { headers: { ...auth().headers, 'Content-Type': 'multipart/form-data' } });
      setTrainingLog("⚙️ Recompiling TF-IDF Vocabulary...");
      setTimeout(() => setTrainingLog("🌲 Retraining Random Forest Classifier..."), 1500);

      setTimeout(() => {
          setTrainingLog("✅ Batch processed & AI deployed!");
          setTimeout(() => {
              setIsRetraining(false);
              loadBatches();
              loadBugs();
              toast('✅ Upload successful! AI Model retrained.', 'success');
          }, 1500);
      }, 3000);
    } catch (err) {
      setIsRetraining(false);
      toast(err.response?.data?.detail || '❌ Upload failed due to server error.', 'error');
    }
    finally { e.target.value = null; }
  };

  const handleDeleteBatch = async (batchId) => {
    try {
      await axios.delete(`/api/batches/${batchId}`, auth());
      setBatches(prev => prev.filter(b => b.id !== batchId));
      toast('🗑️ Batch record removed.');
    } catch { toast('❌ Batch delete failed.', 'error'); }
  };

  const fillRandomDemoBug = () => {
    const randomBug = DEMO_BUGS[Math.floor(Math.random() * DEMO_BUGS.length)];
    setSummary(randomBug.summary);
    setComponent(randomBug.component);
    setSeverity(randomBug.severity);
  };

  return (
    <div className="page-content fade-in" style={{
        display: 'grid', gridTemplateColumns: 'minmax(400px, 1.3fr) minmax(400px, 1fr)', gap: '30px', alignItems: 'start', width: '100%'
    }}>
      <Toast msg={msg} onClose={() => setMsg({ text: '', type: '' })} />

      {/* Retraining Overlay */}
      {isRetraining && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(12px)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'linear-gradient(145deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95))', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '40px 30px', borderRadius: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', width: 420, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: -50, right: -50, width: 150, height: 150, background: 'var(--accent)', filter: 'blur(80px)', opacity: 0.3, borderRadius: '50%' }}></div>
                  <div style={{ position: 'relative', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Loader2 size={64} color="var(--accent)" className="spin" style={{ position: 'absolute', opacity: 0.2 }} />
                      <BrainCircuit size={36} color="var(--accent)" />
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 8px 0', letterSpacing: 1.5 }}>COMPILING ML PIPELINE</h2>
                  <div style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 30, textTransform: 'uppercase' }}>Live Database Sync Active</div>
                  <div style={{ width: '100%', background: '#0a0f1a', borderRadius: 8, padding: 16, border: '1px solid rgba(255,255,255,0.05)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--success)', minHeight: 60, display: 'flex', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-sec)', marginRight: 10 }}>&gt;</span> {trainingLog} <span style={{ animation: 'pulse 1s infinite step-end', marginLeft: 4 }}>_</span>
                  </div>
              </div>
          </div>
      )}

      {/* LEFT COLUMN: Input Forms */}
      <div className="sys-card" style={{ padding: 0, overflow: 'hidden', minHeight: 600, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)', background: 'var(--hover-bg)' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, margin: '0 0 4px', fontWeight: 800 }}>
            <Cpu size={20} color="var(--accent)" /> Bug Ingestion
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-sec)', margin: 0 }}>
            Entries write directly to the <strong>firefox_table</strong> in Supabase.
          </p>
          <div className="segmented-control" style={{ marginTop: 16 }}>
            <button className={`segment-btn ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>
              <PenTool size={13} /> Manual Entry
            </button>
            <button className={`segment-btn ${mode === 'bulk' ? 'active' : ''}`} onClick={() => setMode('bulk')}>
              <UploadCloud size={13} /> Bulk Upload & Train
            </button>
          </div>
        </div>

        <div style={{ padding: 28, flex: 1 }}>
          {mode === 'single' ? (
            <div className="fade-in">

              {/* MAGIC FILL BUTTON WITH RANDOMIZER */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
                 <label style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-sec)' }}>Bug Summary *</label>
                 <button
                     type="button"
                     onClick={(e) => {
                         e.preventDefault();
                         fillRandomDemoBug();
                     }}
                     style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
                 >
                     <Sparkles size={12} /> Auto-Fill Demo Data
                 </button>
              </div>
              <textarea
                className="sys-input"
                placeholder='e.g. "Login button does nothing on first click after session expiry"'
                value={summary}
                onChange={e => setSummary(e.target.value)}
                style={{ height: 96, resize: 'vertical', marginBottom: 0 }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 16, marginBottom: 20 }}>
                <Field label="Component *">
                  <Select value={component} onChange={e => setComponent(e.target.value)} highlight={!!component}>
                    <option value="" disabled>Pick component…</option>
                    {Object.entries(TAXONOMY).map(([team, comps]) => (
                        <optgroup key={team} label={team.toUpperCase()}>
                            {comps.map(c => <option key={c} value={c}>{c}</option>)}
                        </optgroup>
                    ))}
                  </Select>
                </Field>

                <Field label="Severity">
                  <Select value={severity} onChange={e => setSeverity(e.target.value)}>
                    {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Select>
                </Field>

                <Field label="Status">
                  <Select value={status} onChange={e => setStatus(e.target.value)}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Field>
              </div>

              <button
                className="sys-btn full"
                onClick={handleSubmit}
                disabled={!summary.trim() || !component}
                style={{
                  background: 'var(--accent)', color: 'white', borderColor: 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20
                }}
              >
                <Send size={14} /> SAVE TO FIREFOX TABLE
              </button>
            </div>

          ) : (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ position: 'relative' }}>
                  <input type="file" accept=".csv,.json" onChange={handleBulkUpload} style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer', zIndex: 10 }} />
                  <div style={{ padding: 44, border: '2px dashed var(--border)', borderRadius: 16, background: 'var(--bg)', textAlign: 'center', transition: '0.2s' }} className="drop-area-modern">
                    <FileText size={34} color="var(--text-sec)" style={{ margin: '0 auto 14px', display: 'block' }} />
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', margin: '0 0 6px' }}>Click or drag to upload CSV / JSON</p>
                    <p style={{ fontSize: 12, color: 'var(--text-sec)', margin: 0 }}>Automatically appends to the database and retrains the model.</p>
                  </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Ledger */}
      <div className="sys-card" style={{ padding: 0, minHeight: 600, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 2px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={15} color="var(--accent)" /> Main Ledger
            </h2>
            <p style={{ fontSize: 11, color: 'var(--text-sec)', margin: 0 }}>
              Live view of <strong>firefox_table</strong>
            </p>
          </div>
          <button onClick={loadBugs} className="sys-btn outline" style={{ padding: '6px 12px', fontSize: 11, gap: 6 }}>
            <RefreshCw size={11} className={bugsLoading ? 'spin' : ''} /> Refresh
          </button>
        </div>

        <div className="custom-scrollbar" style={{ overflowY: 'auto', flex: 1, maxHeight: 520 }}>
          {bugsLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-sec)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <RefreshCw size={13} className="spin" /> Syncing...
            </div>
          ) : bugs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Bug size={26} style={{ opacity: 0.18, display: 'block', margin: '0 auto 10px' }} />
              <p style={{ fontSize: 13, color: 'var(--text-sec)', margin: 0 }}>No bugs found.</p>
            </div>
          ) : (
            bugs.map(bug => (
              <div
                key={bug.id}
                className="fade-in ledger-list"
                style={{
                  padding: '13px 18px', borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                }}
              >
                <div style={{ flex: 1, overflow: 'hidden', paddingRight: 10 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--text-main)',
                    marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }} title={bug.summary}>
                    {bug.summary}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <SevBadge sev={bug.severity} />
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5,
                      background: 'var(--hover-bg)', color: 'var(--text-sec)',
                      border: '1px solid var(--border)'
                    }}>{bug.component}</span>
                    <StatusBadge status={bug.status} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-sec)', opacity: 0.5 }}>
                      #{bug.id}
                    </span>
                  </div>
                </div>

                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  {pendingDel === bug.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                      <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 700, whiteSpace: 'nowrap' }}>Delete?</span>
                      <button
                        onClick={() => confirmDelete(bug.id)}
                        style={{
                          background: 'var(--danger)', border: 'none', color: 'white',
                          padding: '3px 10px', borderRadius: 6, fontSize: 11,
                          fontWeight: 800, cursor: 'pointer'
                        }}
                      >Yes</button>
                      <button
                        onClick={() => setPendingDel(null)}
                        style={{
                          background: 'var(--hover-bg)', border: '1px solid var(--border)',
                          color: 'var(--text-sec)', padding: '3px 10px', borderRadius: 6,
                          fontSize: 11, fontWeight: 700, cursor: 'pointer'
                        }}
                      >No</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPendingDel(bug.id)}
                      title="Delete this bug from the database"
                      style={{
                        background: 'none', border: 'none', color: 'var(--text-sec)',
                        cursor: 'pointer', padding: '5px 6px', borderRadius: 6, display: 'flex', alignItems: 'center'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {batches.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '10px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-sec)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 size={11} /> BULK UPLOAD HISTORY</div>
            <div className="custom-scrollbar" style={{ overflowY: 'auto', maxHeight: 180 }}>
              {batches.map(b => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{b.batch_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 2 }}>{b.bug_count} records <span style={{ color: 'var(--success)', fontWeight: 700, marginLeft: 8 }}>✓ Done</span></div>
                  </div>
                  <button onClick={() => handleDeleteBatch(b.id)} style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer' }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}