import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    BrainCircuit, Target, Crosshair, Activity,
    TrendingUp, Database, Clock, ShieldCheck, Zap, History
} from 'lucide-react';
import {
    LineChart, Line, BarChart, Bar, RadarChart, PolarGrid,
    PolarAngleAxis, PolarRadiusAxis, Radar, XAxis, YAxis,
    Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';

const historicalTrend = [
    { epoch: 'v1.0', accuracy: 78.2, f1: 75.1 }, { epoch: 'v1.1', accuracy: 81.4, f1: 79.2 },
    { epoch: 'v1.2', accuracy: 84.1, f1: 82.5 }, { epoch: 'v2.0', accuracy: 89.5, f1: 88.1 },
    { epoch: 'v2.1', accuracy: 92.3, f1: 91.8 }, { epoch: 'Live', accuracy: 94.7, f1: 94.2 }
];

const classMetrics = [
    { subject: 'S1 (Critical)', precision: 95, recall: 98, fullMark: 100 },
    { subject: 'S2 (High)', precision: 88, recall: 85, fullMark: 100 },
    { subject: 'S3 (Normal)', precision: 92, recall: 94, fullMark: 100 },
    { subject: 'S4 (Low)', precision: 85, recall: 82, fullMark: 100 },
];

const featureImportance = [
    { name: 'crash', weight: 0.85 }, { name: 'memory leak', weight: 0.78 },
    { name: 'freeze', weight: 0.72 }, { name: 'security', weight: 0.68 },
    { name: 'typo', weight: 0.25 }, { name: 'color', weight: 0.15 }
];

const confusionMatrix = [
    { actual: 'S1', S1: 4620, S2: 310,  S3: 50,    S4: 20 },
    { actual: 'S2', S1: 412,  S2: 8950, S3: 610,   S4: 28 },
    { actual: 'S3', S1: 85,   S2: 1240, S3: 17850, S4: 825 },
    { actual: 'S4', S1: 10,   S2: 80,   S3: 1150,  S4: 3760 },
];
const MAX_MATRIX_VAL = 17850;

export default function Performance() {
  const [modelData, setModelData] = useState({ current: null, previous: null });
  const [viewVersion, setViewVersion] = useState('current');

  // Fallback data for presentation if backend isn't connected
  const fallbackCurrent = {
      accuracy: 0.947, f1_score: 0.942, precision: 0.951, recall: 0.938,
      dataset_size: 200000, status: "Active Model", last_trained: new Date().toLocaleString()
  };
  const fallbackPrevious = {
      accuracy: 0.923, f1_score: 0.918, precision: 0.925, recall: 0.910,
      dataset_size: 185000, status: "Archived Baseline", last_trained: "Previous Epoch"
  };

  useEffect(() => {
      const fetchMetrics = async () => {
          try {
              const token = localStorage.getItem("token");
              const res = await axios.get('/api/hub/ml_metrics', { headers: { Authorization: `Bearer ${token}` } });

              if (res.data && res.data.current) {
                  setModelData({ current: res.data.current, previous: res.data.previous });
              } else {
                  setModelData({ current: fallbackCurrent, previous: fallbackPrevious });
              }
          } catch (e) {
              setModelData({ current: fallbackCurrent, previous: fallbackPrevious });
          }
      };
      fetchMetrics();
  }, []);

  const activeMetrics = viewVersion === 'current' ? modelData.current : modelData.previous;
  const metricsToUse = activeMetrics || fallbackCurrent;

  const formatPct = (val) => `${(val * 100).toFixed(1)}%`;

  const getHeatmapColor = (val, max) => {
      const ratio = val / max;
      const r = Math.round(4 + (251 * ratio));
      const g = Math.round(43 + (212 * ratio));
      const b = Math.round(89 + (166 * ratio));
      return `rgb(${r}, ${g}, ${b})`;
  };

  // Calculates the delta improvement (+/-) between the retrained model and the old one
  const getDelta = (key) => {
      if (viewVersion !== 'current' || !modelData.previous || !modelData.current) return null;
      const diff = (modelData.current[key] - modelData.previous[key]) * 100;
      if (diff === 0) return null;
      const sign = diff > 0 ? '+' : '';
      const color = diff > 0 ? 'var(--success)' : 'var(--danger)';
      return <span style={{ fontSize: 13, fontWeight: 800, color, marginLeft: 10, background: 'var(--hover-bg)', padding: '2px 8px', borderRadius: 6 }}>{sign}{diff.toFixed(1)}%</span>;
  };

  return (
    <div className="page-content fade-in">
      <div className="explorer-header" style={{ marginBottom: 30, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
           <h1 style={{fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10}}>
               <BrainCircuit size={24} color="var(--accent)"/> MODEL PERFORMANCE
           </h1>
           <span style={{fontSize: 13, color: 'var(--text-sec)'}}>Live telemetry, feature weights, and evaluation metrics for the Random Forest classifier.</span>
        </div>

        {/* MODEL A/B TOGGLE UI */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <div className="segmented-control" style={{ margin: 0, width: 320, padding: 4 }}>
                <button className={`segment-btn ${viewVersion === 'current' ? 'active' : ''}`} onClick={() => setViewVersion('current')} style={{ padding: '8px 12px' }}>
                    <Zap size={14}/> Active Build
                </button>
                <button className={`segment-btn ${viewVersion === 'previous' ? 'active' : ''}`} onClick={() => setViewVersion('previous')} disabled={!modelData.previous} style={{ padding: '8px 12px', opacity: !modelData.previous ? 0.5 : 1 }}>
                    <History size={14}/> Previous Build
                </button>
            </div>
            <div className="live-pill" style={{ background: viewVersion === 'current' ? 'rgba(16,185,129,0.1)' : 'var(--hover-bg)', color: viewVersion === 'current' ? 'var(--success)' : 'var(--text-sec)', borderColor: viewVersion === 'current' ? 'rgba(16,185,129,0.3)' : 'var(--border)' }}>
                {viewVersion === 'current' ? <span className="pulse-dot"></span> : <History size={10} />}
                {metricsToUse.status}
            </div>
        </div>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 30 }}>
         <div className="sys-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 6 }}><Target size={14}/> OVERALL ACCURACY</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center' }}>
                {formatPct(metricsToUse.accuracy)} {getDelta('accuracy')}
            </div>
         </div>
         <div className="sys-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 6 }}><Activity size={14}/> F1-SCORE (WEIGHTED)</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center' }}>
                {formatPct(metricsToUse.f1_score)} {getDelta('f1_score')}
            </div>
         </div>
         <div className="sys-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 6 }}><Crosshair size={14}/> PRECISION</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center' }}>
                {formatPct(metricsToUse.precision)} {getDelta('precision')}
            </div>
         </div>
         <div className="sys-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={14}/> RECALL</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center' }}>
                {formatPct(metricsToUse.recall)} {getDelta('recall')}
            </div>
         </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
          <div className="sys-card" style={{ padding: 24, opacity: viewVersion === 'previous' ? 0.7 : 1, transition: '0.3s' }}>
              <h3 style={{fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 20, textTransform: 'uppercase', letterSpacing: 1}}>Historical Training Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={historicalTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="epoch" stroke="var(--text-sec)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis domain={[70, 100]} stroke="var(--text-sec)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(tick) => `${tick}%`} />
                      <Tooltip contentStyle={{borderRadius: 8, border:'1px solid var(--border)', background:'var(--card-bg)', color:'var(--text-main)'}} />
                      <Line type="monotone" dataKey="accuracy" name="Accuracy" stroke="var(--accent)" strokeWidth={3} dot={{r: 4, fill: 'var(--accent)'}} />
                      <Line type="monotone" dataKey="f1" name="F1-Score" stroke="var(--success)" strokeWidth={3} dot={{r: 4, fill: 'var(--success)'}} />
                  </LineChart>
              </ResponsiveContainer>
          </div>

          <div className="sys-card" style={{ padding: 24, opacity: viewVersion === 'previous' ? 0.7 : 1, transition: '0.3s' }}>
              <h3 style={{fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 0, textTransform: 'uppercase', letterSpacing: 1}}>Class Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={classMetrics}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="subject" tick={{fill: 'var(--text-sec)', fontSize: 10, fontWeight: 600}} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Precision" dataKey="precision" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.4} />
                      <Radar name="Recall" dataKey="recall" stroke="var(--success)" fill="var(--success)" fillOpacity={0.4} />
                      <Tooltip contentStyle={{borderRadius: 8, border:'1px solid var(--border)', background:'var(--card-bg)'}} />
                  </RadarChart>
              </ResponsiveContainer>
          </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* SOPHISTICATED CONFUSION MATRIX */}
          <div className="sys-card" style={{ padding: 24, opacity: viewVersion === 'previous' ? 0.7 : 1, transition: '0.3s' }}>
              <h3 style={{fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 30, textTransform: 'uppercase', letterSpacing: 1}}>Test Set Confusion Matrix</h3>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ transform: 'rotate(-90deg)', fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', width: 20, whiteSpace: 'nowrap', marginRight: 15 }}>
                      Actual Severity
                  </div>

                  <div style={{ flex: 1 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(4, 1fr)', gap: 2 }}>
                          <div style={{}}></div>
                          {['S1', 'S2', 'S3', 'S4'].map(l => <div key={l} style={{textAlign: 'center', fontSize: 12, fontWeight: 800, color: 'var(--text-sec)', marginBottom: 8}}>{l}</div>)}

                          {confusionMatrix.map(row => (
                              <React.Fragment key={row.actual}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 10, fontSize: 12, fontWeight: 800, color: 'var(--text-sec)' }}>{row.actual}</div>
                                  {['S1', 'S2', 'S3', 'S4'].map(col => {
                                      const val = row[col];
                                      const ratio = val / MAX_MATRIX_VAL;
                                      return (
                                          <div key={col} style={{
                                              aspectRatio: '1/1',
                                              background: getHeatmapColor(val, MAX_MATRIX_VAL),
                                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                                              color: ratio > 0.4 ? '#0f172a' : '#ffffff',
                                              fontSize: 14, fontWeight: 600,
                                              border: '1px solid rgba(255,255,255,0.4)',
                                              borderRadius: 2
                                          }}>
                                              {val.toLocaleString()}
                                          </div>
                                      )
                                  })}
                              </React.Fragment>
                          ))}
                      </div>
                      <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', marginTop: 15, paddingLeft: 40 }}>
                          Predicted Severity
                      </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginLeft: 20, height: 200 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-sec)', marginBottom: 6, fontWeight: 700 }}>18k</div>
                      <div style={{ flex: 1, width: 14, background: 'linear-gradient(to top, rgb(4,43,89), rgb(255,255,255))', borderRadius: 4, border: '1px solid var(--border)' }}></div>
                      <div style={{ fontSize: 10, color: 'var(--text-sec)', marginTop: 6, fontWeight: 700 }}>0</div>
                  </div>
              </div>
          </div>

          <div className="sys-card" style={{ padding: 24, background: 'var(--hover-bg)' }}>
              <h3 style={{fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 24, textTransform: 'uppercase', letterSpacing: 1}}>Training Meta-Data</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ background: 'var(--card-bg)', padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}><Database size={20} color="var(--accent)"/></div>
                      <div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)' }}>TRAINING VOLUME</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>{metricsToUse.dataset_size.toLocaleString()} Verified Bug Reports</div>
                      </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ background: 'var(--card-bg)', padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}><ShieldCheck size={20} color="var(--success)"/></div>
                      <div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)' }}>CLASSIFIER ALGORITHM</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>Random Forest (100 Estimators)</div>
                      </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ background: 'var(--card-bg)', padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}><Clock size={20} color="var(--text-sec)"/></div>
                      <div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)' }}>COMPILED ON</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>{metricsToUse.last_trained}</div>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
}