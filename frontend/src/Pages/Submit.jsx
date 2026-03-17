import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  UploadCloud, AlertCircle, FileText, 
  BarChart3, CheckCircle, X, Database, Activity
} from 'lucide-react';

// The Toast component must stay inside the file to prevent ReferenceErrors
function Toast({ msg, onClose }) {
    if (!msg.text) return null;
    const isError = msg.type === 'error';
    const isLoading = msg.type === 'loading';
    
    return (
        <div className="toast-notification fade-in-up" style={{
            position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
            background: isError ? '#ef4444' : (isLoading ? '#3b82f6' : '#10b981'), 
            color: 'white', padding: '12px 24px', borderRadius: 50, 
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            display: 'flex', alignItems: 'center', gap: 12, zIndex: 9999, fontWeight: 500
        }}>
            {isError ? <AlertCircle size={18}/> : (isLoading ? <Activity size={18}/> : <CheckCircle size={18}/>)}
            {msg.text}
            <button onClick={onClose} style={{background:'none', border:'none', color:'inherit', opacity:0.7, cursor:'pointer', padding:0, marginLeft: 10}}>
              <X size={14}/>
            </button>
        </div>
    );
}

export default function Submit({ user }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [file, setFile] = useState(null);
  const [batches, setBatches] = useState([]);

  const getHeaders = () => ({ 
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } 
  });

  useEffect(() => { fetchBatches(); }, []);

  const fetchBatches = async () => { 
      try { 
          const res = await axios.get(`/api/batches`, getHeaders()); 
          setBatches(res.data || []); 
      } catch (err) { console.error(err); } 
  };

  const handleBulkUpload = async () => {
    if(!file) return;
    setLoading(true);
    setMsg({ text: "Uploading and processing batch...", type: "loading" });
    
    const fd = new FormData();
    fd.append("file", file);
    fd.append("batch_name", file.name); 

    try {
      await axios.post('/api/upload_and_train', fd, {
          headers: {
              "Authorization": `Bearer ${localStorage.getItem("token")}`,
              "Content-Type": "multipart/form-data" 
          }
      });
      setMsg({ text: "Batch Processed Successfully!", type: "success" });
      setFile(null);
      fetchBatches(); 
      setTimeout(() => setMsg({ text: "", type: "" }), 3000);
    } catch (err) {
      setMsg({ text: "Upload Failed.", type: "error" });
    } finally { setLoading(false); }
  };

  return (
    <div className="page-content centered-page" style={{alignItems:'flex-start', gap: 30, padding: 40}}>
      <Toast msg={msg} onClose={() => setMsg({ text: "", type: "" })} />

      {/* Main Ingestion Card */}
      <div className="sys-card" style={{flex: 1.6, padding: 40, minHeight: 600}}>
          <div style={{textAlign:'center', marginBottom: 40}}>
              <Database size={48} style={{ color: 'var(--text-main)', margin: '0 auto 20px' }} />
              <h2 style={{fontSize: 24, fontWeight: 800}}>Data Ingestion Center</h2>
              <p style={{color: 'var(--text-sec)'}}>Upload bulk datasets to retrain the AI and improve system accuracy.</p>
          </div>

          <div className="drop-area-modern" style={{padding: 60, border: '2px dashed var(--border)', borderRadius: 16, textAlign:'center'}}>
              <FileText size={40} color="var(--text-sec)" style={{margin:'0 auto 15px'}}/>
              <p style={{fontSize: 14, color: 'var(--text-sec)'}}>Drag and drop CSV or JSON training data</p>
              
              <input type="file" id="bulk" hidden onChange={e=>setFile(e.target.files[0])}/>
              <label htmlFor="bulk" className="sys-btn outline" style={{marginTop: 15, cursor:'pointer'}}>
                  {file ? file.name : "Select Training File"}
              </label>
          </div>

          <button className="sys-btn full" onClick={handleBulkUpload} disabled={!file || loading} style={{marginTop: 30, height: 50}}>
              {loading ? 'PROCESSING BATCH...' : 'EXECUTE BULK INGESTION'} <UploadCloud size={18} style={{marginLeft: 10}}/>
          </button>
      </div>

      {/* Sidebar History Card */}
      <div className="sys-card" style={{flex: 1, padding: 0, minHeight: 600}}>
          <div style={{padding: 25, borderBottom: '1px solid var(--border)', background: 'var(--hover-bg)'}}>
              <h2 style={{fontSize: 16, fontWeight: 800, display:'flex', alignItems:'center', gap: 10}}>
                  <BarChart3 size={18}/> Training History
              </h2>
          </div>
          <div className="ledger-list" style={{overflowY:'auto', maxHeight: 500}}>
              {batches.length === 0 ? (
                  <div style={{padding: 30, textAlign: 'center', color: 'var(--text-sec)'}}>No batches recorded.</div>
              ) : (
                  batches.map((b, i) => (
                      <div key={i} style={{padding: 20, borderBottom: '1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                          <div>
                              <div style={{fontSize: 13, fontWeight: 700}}>{b.batch_name}</div>
                              <div style={{fontSize: 11, color: 'var(--text-sec)'}}>{b.bug_count} records</div>
                          </div>
                          <span className="pill success tiny">COMPLETED</span>
                      </div>
                  ))
              )}
          </div>
      </div>
    </div>
  );
}