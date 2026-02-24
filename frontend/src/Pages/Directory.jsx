import { useState } from 'react';
import { FolderTree, ExternalLink, ArrowRight, Layers, Search } from 'lucide-react';

const TAXONOMY = {
  DevTools: {
    "Core Tools": ["General", "Debugger", "Console", "Inspector", "Style Editor", "Netmonitor", "Source Editor", "Responsive Design Mode"],
    "Panel & Views": ["Object Inspector", "Storage Inspector", "JSON Viewer", "DOM", "Application Panel", "about:debugging", "Shared Components", "Framework", "Documentation"],
    "Inspector Sub-tools": ["Inspector: Rules", "Inspector: Animations", "Inspector: Changes", "Inspector: Layout", "Inspector: Compatibility"],
    "Runtime & Source": ["geckodriver", "View Source"]
  },
  Layout: {
    "Box Model & Flow": ["Layout", "Layout: Block and Inline", "Layout: Floats", "Layout: Positioned", "Layout: Scrolling and Overflow", "Layout: Columns", "Layout: Ruby"],
    "Flexbox & Grid": ["Layout: Flexbox", "Layout: Grid", "Layout: Generated Content, Lists, and Counters"],
    "CSS & Rendering": ["CSS Parsing and Computation", "CSS Transitions and Animations", "DOM: CSS Object Model", "DOM: Animation", "Panning and Zooming"],
    "Media & Embedded": ["Layout: Images, Video, and HTML Frames", "Layout: Form Controls", "Layout: Tables", "Layout: Text and Fonts", "MathML", "SVG"],
    "Print": ["Printing: Output", "Printing: Setup", "Print Preview"]
  },
  Networking: {
    "Protocols": ["Networking", "HTTP", "WebSockets", "DNS", "WebRTC"],
    "Security & Auth": ["Networking: TLS", "Certificates", "Security"],
    "Cache & Storage": ["Cache", "Cookies", "Networking: Cache"]
  },
  Firefox: {
    "Navigation & Tabs": ["Tabbed Browser", "Address Bar", "Menus", "Toolbars and Customization"],
    "User Features": ["Bookmarks", "Downloads", "Firefox Sync", "New Tab Page", "Pocket"],
    "Accessibility": ["Accessibility", "Screen Readers", "Theme"],
    "Settings & Updates": ["Preferences", "Application Update", "Installer"]
  },
  Core: {
    "JavaScript Engine": ["JavaScript Engine", "JavaScript: GC", "JavaScript Engine: JIT", "WebAssembly"],
    "DOM": ["DOM: Core & HTML", "DOM: Events", "DOM: Workers", "DOM: Push Notifications", "DOM: Service Workers", "DOM: Storage"],
    "Graphics": ["Graphics", "Graphics: OffscreenCanvas", "Canvas: 2D", "WebGL"],
    "Platform": ["Gecko Profiler", "Memory Allocator", "XPCOM", "IPC", "Internationalization"]
  }
};

const TEAM_DESCRIPTIONS = {
  DevTools: "Browser developer tools: debugger, console, inspector, network monitor, and profiling panels.",
  Layout: "The rendering engine that parses CSS/HTML and computes page geometry — flexbox, grid, SVG, and print.",
  Networking: "All network I/O: HTTP, DNS, WebSockets, TLS certificates, caching, and cookies.",
  Firefox: "The Firefox browser UI layer — tabs, address bar, bookmarks, sync, accessibility, and updates.",
  Core: "The Gecko browser engine core: SpiderMonkey JS engine, DOM, graphics, IPC, and platform services."
};

export default function Directory({ onNavigate }) {
  const [expandedTeam, setExpandedTeam] = useState(null);

  return (
    <div className="page-content fade-in">
      <div className="explorer-header">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FolderTree size={24} color="var(--accent)" /> COMPONENT DIRECTORY
          </h1>
          <span style={{ fontSize: 13, color: 'var(--text-sec)', display: 'flex', alignItems: 'center', gap: 6 }}>
              Categorized view of the Mozilla Bugzilla architecture
          </span>
        </div>
        <button className="sys-btn outline" onClick={() => window.open('https://bugzilla.mozilla.org/', '_blank')}>Bugzilla Hub <ExternalLink size={14} /></button>
      </div>

      <div className="dir-grid">
        {Object.keys(TAXONOMY).map(team => {
          const cats = TAXONOMY[team];
          const numCats = Object.keys(cats).length;
          const isOpen = expandedTeam === team;

          return (
            <div key={team} className={`sys-card dir-card ${isOpen ? 'active' : ''}`} onClick={() => setExpandedTeam(isOpen ? null : team)}>
              <div className="dir-header">
                <div className="dir-title">{team}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="dir-pill" style={{ background: 'var(--hover-bg)', color: 'var(--text-sec)' }}>{numCats} {numCats === 1 ? 'Category' : 'Categories'}</span>
                </div>
              </div>
              <div className="dir-body">{TEAM_DESCRIPTIONS[team]}</div>
              {!isOpen && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>View Architecture <ArrowRight size={14} /></div>}

              {isOpen && (
                <div className="dir-expanded fade-in" onClick={e => e.stopPropagation()}>
                  {Object.keys(cats).map(cat => {
                    return (
                      <div key={cat} style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sec)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Layers size={12} /> {cat}</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {cats[cat].map(comp => (
                            <button key={comp} className="dir-comp-btn" onClick={() => onNavigate('submit', '', { component: comp })}>
                              {comp}
                              <Search size={12} style={{ opacity: 0.3, marginLeft: 4 }} />
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}