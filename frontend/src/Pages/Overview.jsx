import { useState, useEffect } from 'react';
import axios from 'axios';
import { Database, BrainCircuit, PenTool, ArrowRight, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function LiveFeedRow({ bug }) {
    return (
        <div className="live-feed-item">
            <div style={{display:'flex', alignItems:'center', gap:10}}>
                <Zap size={14} className={bug.severity === 'S1' ? 'icon-pulse-red' : 'icon-dim'} color={bug.severity==='S1'?'var(--danger)':'var(--text-sec)'}/>
                <span className="feed-id">#{bug.id}</span>
            </div>
            <span className="feed-summary" title={bug.summary}>{bug.summary}</span>
            <span className={`pill ${bug.severity} tiny`}>{bug.severity || 'S3'}</span>
        </div>
    )
}

export default function Overview({ user, onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchData = () => {
        const token = localStorage.getItem("token");
        axios.get(`/api/hub/overview`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => { setData(res.data); setError(false); })
        .catch(err => { console.error("Overview Error:", err); setError(true); });
    };
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  if (error) return <div className="page-content" style={{textAlign:'center', marginTop:50, color:'var(--danger)'}}>Backend Error: Ensure server is running.</div>;
  if (!data) return <div className="page-content" style={{textAlign:'center', marginTop:50, color:'var(--text-sec)'}}>Loading Dashboards...</div>;

  const topComponent = data.charts?.components?.[0]?.name || 'Unknown';

  return (
    <div className="scroll-container">
      <section className="hero-section">
        <div className="hero-content">
          <div className="live-pill"><span className="pulse-dot"></span> SYSTEM ACTIVE</div>
          <h1>BUG PRIORITY <span style={{color:'var(--accent)'}}>OS</span></h1>
          <p className="subtitle">Main dashboard and overview panel</p>
        </div>
      </section>

      {/* REWORKED INTERACTIVE NAVIGATION BOXES */}
      <div className="stats-row">
         <div className="sys-card big-stat" onClick={() => onNavigate('directory')} style={{ cursor: 'pointer', transition: '0.2s' }}>
            <div className="stat-top-row">
                <span className="stat-label" style={{color:'var(--text-sec)'}}>ARCHITECTURE</span>
                <ArrowRight size={14} color="var(--text-sec)"/>
            </div>
            <div className="stat-main-content">
               <Database size={40} strokeWidth={1} color="var(--text-sec)" />
               <div>
                   <div className="stat-value">{data.stats.total_db.toLocaleString()}</div>
                   <div className="stat-sub">VERIFIED RECORDS</div>
               </div>
            </div>
         </div>

         <div className="sys-card big-stat" onClick={() => onNavigate('performance')} style={{ cursor: 'pointer', transition: '0.2s' }}>
            <div className="stat-top-row">
                <span className="stat-label" style={{color:'var(--text-sec)'}}>ML PIPELINE</span>
                <ArrowRight size={14} color="var(--text-sec)"/>
            </div>
            <div className="stat-main-content">
               <BrainCircuit size={40} strokeWidth={1} color="var(--accent)" />
               <div>
                   <div className="stat-value">ACTIVE</div>
                   <div className="stat-sub">RANDOM FOREST ENGINE</div>
               </div>
            </div>
         </div>

         <div className="sys-card big-stat highlight-blue" onClick={() => onNavigate('submit')} style={{ cursor: 'pointer', transition: '0.2s' }}>
            <div className="stat-top-row">
                <span className="stat-label" style={{color:'var(--text-sec)'}}>DATA INGESTION</span>
                <ArrowRight size={14} color="#fff"/>
            </div>
            <div className="stat-main-content">
               <PenTool size={40} strokeWidth={1} color="#fff" />
               <div>
                   <div className="stat-value">READY</div>
                   <div className="stat-sub" style={{color:'#cbd5e1'}}>AWAITING NEW BUGS</div>
               </div>
            </div>
         </div>
      </div>

      <div className="feature-section right-align" style={{alignItems:'flex-start'}}>
        <div className="feature-text">
          <h2>BUG STREAM</h2>
          <div className="divider-line"></div>
          <p>Live stream of the most recent bug submissions from the Supabase database.</p>
          <button className="sys-btn outline" onClick={() => onNavigate('submit')}>MANAGE LEDGER</button>
        </div>
        <div className="feature-visual">
           <div className="sys-card feed-card">
             <div className="feed-header"><span style={{fontSize:11, fontWeight:800, color:'var(--text-sec)', textTransform:'uppercase'}}>Recent Analysis</span><div className="pulse-dot"></div></div>
             <div className="feed-list custom-scrollbar">
                {(data.recent || []).map((bug, i) => <LiveFeedRow key={i} bug={bug} />)}
             </div>
           </div>
        </div>
      </div>
      <div className="feature-section left-align">
         <div className="feature-visual">
            <div className="sys-card" style={{width:'100%', padding:20, height:320}}>
              <h3 style={{fontSize:12, fontWeight:700, color:'var(--text-sec)', marginBottom:20, textTransform:'uppercase', letterSpacing:1}}>Top Failing Components</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.charts.components} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 11, fill: 'var(--text-sec)', fontWeight: 600}} />
                  <Tooltip cursor={{fill: 'var(--hover-bg)'}} contentStyle={{borderRadius: 8, border:'1px solid var(--border)', background:'var(--card-bg)', color:'var(--text-main)', boxShadow:'var(--shadow-md)'}} itemStyle={{color: 'var(--text-main)'}} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                    {data.charts.components.map((entry, index) => (<Cell key={`cell-${index}`} fill={index === 0 ? 'var(--danger)' : 'var(--accent)'} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
         </div>
         <div className="feature-text">
            <h2>COMPONENT CHART</h2>
            <div className="divider-line"></div>
            <p>Real-time analysis of failing components. Currently, <strong>{topComponent}</strong> is reporting the highest volume of defects.</p>
         </div>
      </div>
    </div>
  );
}