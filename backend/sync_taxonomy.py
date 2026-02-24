"""
ETL Pipeline: Bugzilla Component Teams -> taxonomy.js
Uses: GET /rest/config/component_teams/{team_name}
Response shape: { "TeamName": { "ProductName": ["Component A", ...] } }
"""
import requests, json, os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_TAXONOMY_PATH = os.path.abspath(
    os.path.join(BASE_DIR, "..", "frontend", "src", "javascript", "taxonomy.js")
)
BUGZILLA_API = "https://bugzilla.mozilla.org/rest/config/component_teams"
HEADERS = {"User-Agent": "BugPriorityOS-SeniorDesignProject/1.0"}

TEAM_DESCRIPTIONS = {
    "DevTools":   "Browser developer tools: debugger, console, inspector, network monitor, and profiling panels.",
    "Layout":     "The rendering engine that parses CSS/HTML and computes page geometry — flexbox, grid, SVG, and print.",
    "Networking": "All network I/O: HTTP, DNS, WebSockets, TLS certificates, caching, and cookies.",
    "Firefox":    "The Firefox browser UI layer — tabs, address bar, bookmarks, sync, accessibility, and updates.",
    "Core":       "The Gecko browser engine core: SpiderMonkey JS engine, DOM, graphics, IPC, and platform services.",
}

# Cosmetic grouping for the UI. Keys = category labels shown in Directory cards.
# Component names here must match Bugzilla exactly (they will also match the DB).
CATEGORY_RULES = {
    "DevTools": {
        "Core Tools":          ["General","Debugger","Console","Inspector","Style Editor","Netmonitor","Source Editor","Responsive Design Mode"],
        "Panel & Views":       ["Object Inspector","Storage Inspector","JSON Viewer","DOM","Application Panel","about:debugging","Shared Components","Framework","Documentation"],
        "Inspector Sub-tools": ["Inspector: Rules","Inspector: Animations","Inspector: Changes","Inspector: Layout","Inspector: Compatibility"],
        "Runtime & Source":    ["geckodriver","View Source"],
    },
    "Layout": {
        "Box Model & Flow":  ["Layout","Layout: Block and Inline","Layout: Floats","Layout: Positioned","Layout: Scrolling and Overflow","Layout: Columns","Layout: Ruby"],
        "Flexbox & Grid":    ["Layout: Flexbox","Layout: Grid","Layout: Generated Content, Lists, and Counters"],
        "CSS & Rendering":   ["CSS Parsing and Computation","CSS Transitions and Animations","DOM: CSS Object Model","DOM: Animation","Panning and Zooming"],
        "Media & Embedded":  ["Layout: Images, Video, and HTML Frames","Layout: Form Controls","Layout: Tables","Layout: Text and Fonts","MathML","SVG"],
        "Print":             ["Printing: Output","Printing: Setup","Print Preview"],
    },
    "Networking": {
        "Protocols":       ["Networking","HTTP","WebSockets","DNS","WebRTC"],
        "Security & Auth": ["Networking: TLS","Certificates","Security"],
        "Cache & Storage": ["Cache","Cookies","Networking: Cache"],
    },
    "Firefox": {
        "Navigation & Tabs":  ["Tabbed Browser","Address Bar","Menus","Toolbars and Customization"],
        "User Features":      ["Bookmarks","Downloads","Firefox Sync","New Tab Page","Pocket"],
        "Accessibility":      ["Accessibility","Screen Readers","Theme"],
        "Settings & Updates": ["Preferences","Application Update","Installer"],
    },
    "Core": {
        "JavaScript Engine": ["JavaScript Engine","JavaScript: GC","JavaScript Engine: JIT","WebAssembly"],
        "DOM":               ["DOM: Core & HTML","DOM: Events","DOM: Workers","DOM: Push Notifications","DOM: Service Workers","DOM: Storage"],
        "Graphics":          ["Graphics","Graphics: OffscreenCanvas","Canvas: 2D","WebGL"],
        "Platform":          ["Gecko Profiler","Memory Allocator","XPCOM","IPC","Internationalization"],
    },
}

FALLBACK_TAXONOMY = {
    "DevTools": {
        "Core Tools": ["General","Debugger","Console","Inspector","Style Editor","Netmonitor","Source Editor","Responsive Design Mode"],
        "Panel & Views": ["Object Inspector","Storage Inspector","JSON Viewer","DOM","Application Panel","about:debugging","Shared Components","Framework","Documentation"],
        "Inspector Sub-tools": ["Inspector: Rules","Inspector: Animations","Inspector: Changes","Inspector: Layout","Inspector: Compatibility"],
        "Runtime & Source": ["geckodriver","View Source"]
    },
    "Layout": {
        "Box Model & Flow": ["Layout","Layout: Block and Inline","Layout: Floats","Layout: Positioned","Layout: Scrolling and Overflow","Layout: Columns","Layout: Ruby"],
        "Flexbox & Grid": ["Layout: Flexbox","Layout: Grid","Layout: Generated Content, Lists, and Counters"],
        "CSS & Rendering": ["CSS Parsing and Computation","CSS Transitions and Animations","DOM: CSS Object Model","DOM: Animation","Panning and Zooming"],
        "Media & Embedded": ["Layout: Images, Video, and HTML Frames","Layout: Form Controls","Layout: Tables","Layout: Text and Fonts","MathML","SVG"],
        "Print": ["Printing: Output","Printing: Setup","Print Preview"]
    },
    "Networking": {
        "Protocols": ["Networking","HTTP","WebSockets","DNS","WebRTC"],
        "Security & Auth": ["Networking: TLS","Certificates","Security"],
        "Cache & Storage": ["Cache","Cookies","Networking: Cache"]
    },
    "Firefox": {
        "Navigation & Tabs": ["Tabbed Browser","Address Bar","Menus","Toolbars and Customization"],
        "User Features": ["Bookmarks","Downloads","Firefox Sync","New Tab Page","Pocket"],
        "Accessibility": ["Accessibility","Screen Readers","Theme"],
        "Settings & Updates": ["Preferences","Application Update","Installer"]
    },
    "Core": {
        "JavaScript Engine": ["JavaScript Engine","JavaScript: GC","JavaScript Engine: JIT","WebAssembly"],
        "DOM": ["DOM: Core & HTML","DOM: Events","DOM: Workers","DOM: Push Notifications","DOM: Service Workers","DOM: Storage"],
        "Graphics": ["Graphics","Graphics: OffscreenCanvas","Canvas: 2D","WebGL"],
        "Platform": ["Gecko Profiler","Memory Allocator","XPCOM","IPC","Internationalization"]
    }
}


def fetch_team_components(team_name):
    """Fetch and flatten all components for a Bugzilla team."""
    url = f"{BUGZILLA_API}/{team_name}"
    r = requests.get(url, headers=HEADERS, timeout=10)
    r.raise_for_status()
    data = r.json()
    all_comps = []
    for product_comps in data.get(team_name, {}).values():
        all_comps.extend(product_comps)
    return all_comps


def apply_grouping(team_name, live_components):
    """Group flat component list into UI category buckets using CATEGORY_RULES."""
    rules = CATEGORY_RULES.get(team_name, {})
    result = {cat: [] for cat in rules}
    assigned = set()
    for cat, known in rules.items():
        for comp in live_components:
            if comp in known:
                result[cat].append(comp)
                assigned.add(comp)
    unassigned = [c for c in live_components if c not in assigned]
    if unassigned:
        result["Other"] = unassigned
    return {k: v for k, v in result.items() if v}


def fetch_and_build_taxonomy():
    print("📡 [ETL] Fetching from Bugzilla component_teams API...")
    taxonomy_data = {}
    try:
        for team in ["DevTools", "Layout", "Networking", "Firefox", "Core"]:
            print(f"  → {team}...")
            comps = fetch_team_components(team)
            taxonomy_data[team] = apply_grouping(team, comps)
            print(f"    ✓ {len(comps)} components")
        print("✅ [ETL] Live fetch complete!")
    except Exception as e:
        print(f"⚠️  [ETL] Live fetch failed: {e}\n🔄  Using fallback cache...")
        taxonomy_data = FALLBACK_TAXONOMY

    js_content = (
        "// AUTO-GENERATED BY BACKEND ETL PIPELINE\n"
        "// Source: https://bugzilla.mozilla.org/rest/config/component_teams/{team}\n"
        "// Component names mirror firefox_table.component in Supabase.\n\n"
        f"export const mozillaTaxonomy = {json.dumps(taxonomy_data, indent=2)};\n\n"
        f"export const teamDescriptions = {json.dumps(TEAM_DESCRIPTIONS, indent=2)};\n"
    )
    os.makedirs(os.path.dirname(FRONTEND_TAXONOMY_PATH), exist_ok=True)
    with open(FRONTEND_TAXONOMY_PATH, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"💾 [ETL] Written to {FRONTEND_TAXONOMY_PATH}")


if __name__ == "__main__":
    fetch_and_build_taxonomy()