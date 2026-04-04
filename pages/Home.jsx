import { useState, useEffect, useRef } from "react";
import { Track } from "@/api/entities";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  .dash-root {
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    background: #111312;
    color: #e8f0ed;
    min-height: 100vh;
    display: flex;
    overflow: hidden;
  }

  /* Sidebar */
  .dash-sidebar {
    width: 64px;
    background: #005e40;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 0;
    gap: 4px;
    flex-shrink: 0;
    min-height: 100vh;
    position: fixed;
    left: 0; top: 0; bottom: 0;
    z-index: 50;
  }
  .nav-group { display: flex; flex-direction: column; gap: 4px; align-items: center; }
  .nav-btn {
    width: 44px; height: 44px; border-radius: 10px;
    border: none; background: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; transition: background 0.15s;
    position: relative;
  }
  .nav-btn:hover { background: rgba(255,255,255,0.1); }
  .nav-btn.active { background: rgba(0,209,140,0.2); }
  .nav-divider { width: 32px; height: 1px; background: rgba(255,255,255,0.1); margin: 8px 0; }
  .nav-spacer { flex: 1; }
  .apps-grid-icon {
    display: grid; grid-template-columns: 1fr 1fr; gap: 3px;
  }
  .app-sq { width: 7px; height: 7px; border-radius: 2px; background: rgba(255,255,255,0.5); }
  .nav-tip {
    position: absolute; left: 54px; background: #1a2e24;
    color: #e8f0ed; font-size: 11px; padding: 4px 8px;
    border-radius: 6px; white-space: nowrap; pointer-events: none;
    opacity: 0; transition: opacity 0.15s; z-index: 100;
  }
  .nav-btn:hover .nav-tip { opacity: 1; }

  /* Content */
  .dash-content {
    flex: 1;
    margin-left: 64px;
    padding: 28px 32px 28px;
    overflow-y: auto;
    min-height: 100vh;
  }

  /* Pages */
  .dash-page { display: none; }
  .dash-page.active { display: block; }

  /* Header */
  .page-header { margin-bottom: 28px; }
  .page-header h1 { font-size: 26px; font-weight: 700; margin-bottom: 4px; }
  .page-header p { font-size: 13px; color: #7a9e8e; }

  /* Section label */
  .section-label {
    font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
    color: #4a7060; margin-bottom: 12px; font-weight: 600;
  }

  /* Cards */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 14px;
    margin-bottom: 28px;
  }
  .card {
    background: #1a1f1d;
    border: 1px solid #1f2e28;
    border-radius: 14px;
    padding: 18px;
  }
  .card h3 { font-size: 11px; color: #7a9e8e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .card .value { font-size: 32px; font-weight: 700; color: #e8f0ed; }
  .card .sub { font-size: 11px; color: #4a7060; margin-top: 4px; }

  /* Progress bar */
  .progress-bar { height: 4px; background: #1f2e28; border-radius: 2px; margin: 8px 0; }
  .progress-fill { height: 100%; background: #00d18c; border-radius: 2px; transition: width 0.4s; }
  .chess-detail { font-size: 11px; color: #4a7060; }

  /* Pomo */
  .piano-pomo { display: flex; flex-direction: column; gap: 8px; }
  .pomo-mini-phase { font-size: 11px; color: #4a7060; text-transform: uppercase; letter-spacing: 0.5px; }
  .pomo-mini-display { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .pomo-mini-display.break-mode { color: #00d18c; }
  .pomo-progress-bar { height: 3px; background: #1f2e28; border-radius: 2px; }
  .pomo-progress-fill { height: 100%; background: #4a7060; border-radius: 2px; transition: width 0.5s; }
  .pomo-progress-fill.break-mode { background: #00d18c; }
  .pomo-mini-controls { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
  .pomo-mini-btn {
    background: #1f2e28; border: none; cursor: pointer;
    color: #7a9e8e; font-size: 14px; padding: 4px 8px;
    border-radius: 6px; transition: background 0.15s;
  }
  .pomo-mini-btn:hover { background: #2a3e34; color: #e8f0ed; }
  .pomo-mini-dots { display: flex; gap: 4px; margin-left: 4px; }
  .pomo-dot { width: 7px; height: 7px; border-radius: 50%; background: #1f2e28; }
  .pomo-dot.done { background: #00d18c; }

  /* Apps grid */
  .apps-page-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 14px;
  }
  .app-tile {
    background: #1a1f1d; border: 1px solid #1f2e28;
    border-radius: 14px; padding: 18px 12px;
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    cursor: pointer; transition: background 0.15s, border-color 0.15s;
    text-decoration: none;
  }
  .app-tile:hover { background: #1f2e28; border-color: #2a3e34; }
  .app-icon {
    width: 48px; height: 48px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center; font-size: 24px;
  }
  .app-tile span { font-size: 12px; color: #7a9e8e; }

  /* Planner */
  .add-task-row { display: flex; gap: 10px; margin-bottom: 20px; }
  .add-task-row input {
    flex: 1; background: #1a1f1d; border: 1px solid #1f2e28;
    border-radius: 8px; padding: 10px 14px; color: #e8f0ed;
    font-size: 14px; outline: none;
  }
  .add-task-row input:focus { border-color: #00d18c; }
  .add-task-row button {
    background: #00d18c; color: #003d2a; border: none;
    border-radius: 8px; padding: 10px 18px; cursor: pointer;
    font-weight: 600; font-size: 14px;
  }
  .task-item {
    background: #1a1f1d; border: 1px solid #1f2e28;
    border-radius: 10px; padding: 12px 16px;
    display: flex; align-items: center; gap: 12px; margin-bottom: 8px;
  }
  .task-check {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2px solid #2a3e34; cursor: pointer; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, border-color 0.15s;
  }
  .task-check.done { background: #00d18c; border-color: #00d18c; color: #003d2a; font-size: 11px; }
  .task-text { flex: 1; font-size: 14px; }
  .task-text.done { text-decoration: line-through; color: #4a7060; }
  .task-del { background: none; border: none; color: #4a7060; cursor: pointer; font-size: 16px; }
  .task-del:hover { color: #ff5f57; }

  /* Music Bubble */
  .music-bubble {
    position: fixed; bottom: 28px; right: 28px; z-index: 200;
    display: flex; flex-direction: column; align-items: flex-end; gap: 10px;
  }
  .mb-card {
    background: #0b1510; border: 1px solid #1a2e24;
    border-radius: 18px; padding: 14px 16px;
    width: 260px; box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    display: none; flex-direction: column; gap: 10px;
  }
  .mb-card.open { display: flex; }
  .mb-title { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mb-artist { font-size: 11px; color: #4a7060; margin-top: 2px; }
  .mb-seek-row { display: flex; align-items: center; gap: 6px; }
  .mb-time { font-size: 10px; color: #3a5548; font-variant-numeric: tabular-nums; width: 30px; flex-shrink: 0; }
  .mb-time.right { text-align: right; }
  .mb-seek {
    flex: 1; height: 3px; background: #1a2e24; border-radius: 2px; cursor: pointer;
  }
  .mb-seek-fill { height: 100%; background: #00d18c; border-radius: 2px; width: 0%; transition: width 0.3s linear; }
  .mb-controls { display: flex; align-items: center; justify-content: space-between; }
  .mb-btn {
    background: none; border: none; cursor: pointer;
    color: #7a9e8e; font-size: 15px; padding: 4px 6px;
    border-radius: 6px; opacity: 0.5; transition: opacity 0.15s;
  }
  .mb-btn:hover { opacity: 1; color: #e8f0ed; }
  .mb-btn.active { color: #00d18c; opacity: 1; }
  .mb-play-btn {
    background: #00d18c; border: none; cursor: pointer;
    color: #003d2a; font-size: 17px;
    width: 36px; height: 36px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
  }
  .mb-play-btn:hover { opacity: 0.85; }
  .mb-vol-row { display: flex; align-items: center; gap: 6px; }
  .mb-vol-row span { font-size: 13px; }
  .mb-vol-row input { flex: 1; accent-color: #00d18c; cursor: pointer; }
  .mb-fab {
    width: 52px; height: 52px; border-radius: 50%;
    background: #00d18c; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; box-shadow: 0 4px 20px rgba(0,209,140,0.35);
    transition: transform 0.15s;
    position: relative;
  }
  .mb-fab:hover { transform: scale(1.08); }
  .mb-fab-wave {
    position: absolute; inset: 0; border-radius: 50%;
    border: 2px solid rgba(0,209,140,0.4);
  }
  .mb-fab-wave.pulsing { animation: mbPulse 1.4s ease-out infinite; }
  @keyframes mbPulse {
    0%   { transform: scale(1); opacity: 0.7; }
    100% { transform: scale(1.7); opacity: 0; }
  }
`;

const POMO_PHASES = [
  { label: "Focus", secs: 25 * 60 },
  { label: "Break", secs: 5 * 60 },
  { label: "Focus", secs: 25 * 60 },
  { label: "Break", secs: 5 * 60 },
  { label: "Focus", secs: 25 * 60 },
  { label: "Break", secs: 5 * 60 },
  { label: "Focus", secs: 25 * 60 },
  { label: "Long Break", secs: 15 * 60 },
];

function fmt(s) {
  if (!s || isNaN(s)) return "0:00";
  return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
}

function fmtPomo(s) {
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

export default function Home() {
  const [page, setPage] = useState("home");

  // Time
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [greeting, setGreeting] = useState("");

  // Chess progress
  const [chessMin, setChessMin] = useState(0);

  // Tasks
  const [tasks, setTasks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("dash_tasks") || "[]"); } catch { return []; }
  });
  const [taskInput, setTaskInput] = useState("");

  // Pomodoro
  const [pomoPhase, setPomoPhase] = useState(0);
  const [pomoSecs, setPomoSecs] = useState(POMO_PHASES[0].secs);
  const [pomoRunning, setPomoRunning] = useState(false);
  const [pomoSession, setPomoSession] = useState(0);
  const pomoRef = useRef(null);
  const pomoState = useRef({ phase: 0, secs: POMO_PHASES[0].secs, running: false, session: 0 });

  // Piano sessions
  const [pianoSessions, setPianoSessions] = useState(0);

  // Music bubble
  const [tracks, setTracks] = useState([]);
  const [mbOpen, setMbOpen] = useState(false);
  const [mbIdx, setMbIdx] = useState(0);
  const [mbPlaying, setMbPlaying] = useState(false);
  const [mbShuffle, setMbShuffle] = useState(false);
  const [mbRepeat, setMbRepeat] = useState(false);
  const [mbVol, setMbVol] = useState(0.8);
  const [mbElapsed, setMbElapsed] = useState("0:00");
  const [mbDur, setMbDur] = useState("0:00");
  const [mbProgress, setMbProgress] = useState(0);
  const mbAudioRef = useRef(null);

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = now.getHours();
      setGreeting(h < 12 ? "Good morning 👋" : h < 17 ? "Good afternoon 👋" : "Good evening 👋");
      setTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setDate(now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Chess progress
  useEffect(() => {
    const update = () => {
      const secs = parseInt(localStorage.getItem("chess_time_today") || "0");
      setChessMin(Math.floor(secs / 60));
    };
    update();
    const id = setInterval(update, 3000);
    return () => clearInterval(id);
  }, []);

  // Piano sessions
  useEffect(() => {
    const update = () => setPianoSessions(parseInt(localStorage.getItem("piano_sessions_today") || "0"));
    update();
    const id = setInterval(update, 3000);
    return () => clearInterval(id);
  }, []);

  // Tasks persist
  useEffect(() => {
    localStorage.setItem("dash_tasks", JSON.stringify(tasks));
  }, [tasks]);

  // Pomodoro
  useEffect(() => {
    if (pomoRunning) {
      pomoRef.current = setInterval(() => {
        const ps = pomoState.current;
        ps.secs--;
        if (ps.secs <= 0) {
          clearInterval(pomoRef.current);
          ps.running = false;
          setPomoRunning(false);
          const ph = POMO_PHASES[ps.phase];
          if (ph.label === "Focus") {
            ps.session = Math.min(4, ps.session + 1);
            setPomoSession(ps.session);
            const prev = parseInt(localStorage.getItem("piano_sessions_today") || "0");
            localStorage.setItem("piano_sessions_today", prev + 1);
            setPianoSessions(prev + 1);
          }
          ps.phase = (ps.phase + 1) % POMO_PHASES.length;
          if (ps.phase === 0) ps.session = 0;
          ps.secs = POMO_PHASES[ps.phase].secs;
          setPomoPhase(ps.phase);
          setPomoSecs(ps.secs);
          setPomoSession(ps.session);
        } else {
          setPomoSecs(ps.secs);
        }
      }, 1000);
    } else {
      clearInterval(pomoRef.current);
    }
    return () => clearInterval(pomoRef.current);
  }, [pomoRunning]);

  function pomoToggle() {
    pomoState.current.running = !pomoRunning;
    setPomoRunning(!pomoRunning);
  }
  function pomoReset() {
    clearInterval(pomoRef.current);
    setPomoRunning(false);
    pomoState.current.running = false;
    const secs = POMO_PHASES[pomoPhase].secs;
    pomoState.current.secs = secs;
    setPomoSecs(secs);
  }
  function pomoSkip() {
    clearInterval(pomoRef.current);
    setPomoRunning(false);
    pomoState.current.running = false;
    const next = (pomoPhase + 1) % POMO_PHASES.length;
    pomoState.current.phase = next;
    pomoState.current.secs = POMO_PHASES[next].secs;
    setPomoPhase(next);
    setPomoSecs(POMO_PHASES[next].secs);
  }

  // Music
  useEffect(() => {
    Track.list().then(setTracks).catch(() => {});
  }, []);

  useEffect(() => {
    const audio = mbAudioRef.current;
    if (!audio || !tracks.length) return;
    const t = tracks[mbIdx];
    audio.src = t.file_url;
    audio.volume = mbVol;
    audio.load();
    if (mbPlaying) audio.play().catch(() => {});
  }, [mbIdx, tracks]);

  useEffect(() => {
    const audio = mbAudioRef.current;
    if (!audio) return;
    const onTime = () => {
      const e = audio.currentTime, d = audio.duration || 0;
      setMbElapsed(fmt(e));
      setMbDur(fmt(d));
      setMbProgress(d > 0 ? (e / d) * 100 : 0);
    };
    const onEnd = () => {
      if (mbRepeat) { audio.currentTime = 0; audio.play(); return; }
      mbNextTrack();
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    return () => { audio.removeEventListener("timeupdate", onTime); audio.removeEventListener("ended", onEnd); };
  }, [mbRepeat, mbShuffle, mbIdx, tracks]);

  function mbNextTrack() {
    if (!tracks.length) return;
    if (mbShuffle) {
      let ni = mbIdx;
      if (tracks.length > 1) while (ni === mbIdx) ni = Math.floor(Math.random() * tracks.length);
      setMbIdx(ni);
    } else {
      setMbIdx((mbIdx + 1) % tracks.length);
    }
  }
  function mbPrevTrack() {
    const audio = mbAudioRef.current;
    if (audio && audio.currentTime > 3) { audio.currentTime = 0; return; }
    setMbIdx(((mbIdx - 1) + tracks.length) % tracks.length);
  }
  function mbTogglePlay() {
    const audio = mbAudioRef.current;
    if (!audio || !tracks.length) return;
    if (mbPlaying) { audio.pause(); setMbPlaying(false); }
    else { audio.play().catch(() => {}); setMbPlaying(true); }
  }
  function mbSeek(e) {
    const audio = mbAudioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (audio.duration) audio.currentTime = pct * audio.duration;
  }
  function mbVolChange(v) {
    setMbVol(v);
    if (mbAudioRef.current) mbAudioRef.current.volume = v;
  }

  // Tasks
  function addTask() {
    if (!taskInput.trim()) return;
    setTasks([...tasks, { id: Date.now(), text: taskInput.trim(), done: false }]);
    setTaskInput("");
  }
  function toggleTask(id) {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }
  function deleteTask(id) {
    setTasks(tasks.filter(t => t.id !== id));
  }

  const openTasks = tasks.filter(t => !t.done).length;
  const chessProgress = Math.min(100, (chessMin / 30) * 100);
  const pomoProgress = (1 - pomoSecs / POMO_PHASES[pomoPhase].secs) * 100;
  const isBreak = POMO_PHASES[pomoPhase].label.includes("Break");
  const currentTrack = tracks[mbIdx];

  const NAV = [
    { id: "home", icon: "🏠", tip: "Home" },
    { id: "planner", icon: "📋", tip: "Planner" },
    { id: "apps", icon: null, tip: "Apps" },
  ];

  return (
    <>
      <style>{STYLES}</style>
      <div className="dash-root">
        {/* Sidebar */}
        <nav className="dash-sidebar">
          <div className="nav-group">
            {["home", "planner"].map(id => (
              <button
                key={id}
                className={`nav-btn${page === id ? " active" : ""}`}
                onClick={() => setPage(id)}
              >
                <span>{id === "home" ? "🏠" : "📋"}</span>
                <span className="nav-tip">{id === "home" ? "Home" : "Planner"}</span>
              </button>
            ))}
          </div>
          <div className="nav-divider" />
          <button className={`nav-btn${page === "apps" ? " active" : ""}`} onClick={() => setPage("apps")}>
            <div className="apps-grid-icon">
              {[0,1,2,3].map(i => <div key={i} className="app-sq" />)}
            </div>
            <span className="nav-tip">Apps</span>
          </button>
          <div className="nav-spacer" />
        </nav>

        {/* Content */}
        <div className="dash-content">

          {/* HOME */}
          <div className={`dash-page${page === "home" ? " active" : ""}`}>
            <div className="page-header">
              <h1>{greeting}</h1>
              <p>{date}</p>
            </div>

            <div className="section-label">Overview</div>
            <div className="card-grid">
              <div className="card">
                <h3>Tasks Today</h3>
                <div className="value">{openTasks}</div>
                <div className="sub">Open tasks in planner</div>
              </div>
              <div className="card">
                <h3>Time</h3>
                <div className="value" style={{ fontSize: 28 }}>{time}</div>
                <div className="sub">Local time</div>
              </div>
              <div className="card">
                <h3>Chess Today</h3>
                <div className="value">{chessMin} min</div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: chessProgress + "%" }} /></div>
                <div className="chess-detail">{chessMin >= 30 ? "✓ Goal reached!" : `${30 - chessMin} min remaining`}</div>
              </div>
            </div>

            <div className="section-label">Piano</div>
            <div className="card-grid">
              <div className="card" style={{ minWidth: 200 }}>
                <h3>Pomodoro</h3>
                <div className="piano-pomo">
                  <div>
                    <div className="pomo-mini-phase">{POMO_PHASES[pomoPhase].label}</div>
                    <div className={`pomo-mini-display${isBreak ? " break-mode" : ""}`}>{fmtPomo(pomoSecs)}</div>
                  </div>
                  <div className="pomo-progress-bar">
                    <div className={`pomo-progress-fill${isBreak ? " break-mode" : ""}`} style={{ width: pomoProgress + "%" }} />
                  </div>
                  <div className="pomo-mini-controls">
                    <button className="pomo-mini-btn" onClick={pomoToggle}>{pomoRunning ? "⏸" : "▶"}</button>
                    <button className="pomo-mini-btn" onClick={pomoReset}>↺</button>
                    <button className="pomo-mini-btn" onClick={pomoSkip}>⏭</button>
                    <div className="pomo-mini-dots">
                      {[0,1,2,3].map(i => (
                        <div key={i} className={`pomo-dot${i < pomoSession ? " done" : ""}`} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="card">
                <h3>Open Piano</h3>
                <div className="value" style={{ fontSize: 36, cursor: "pointer" }} onClick={() => window.location.href = "/Piano"}>🎹</div>
                <div className="sub">Launch the piano app</div>
              </div>
              <div className="card">
                <h3>Sessions Today</h3>
                <div className="value">{pianoSessions}</div>
                <div className="sub">Pomodoro sessions</div>
              </div>
            </div>
          </div>

          {/* PLANNER */}
          <div className={`dash-page${page === "planner" ? " active" : ""}`}>
            <div className="page-header">
              <h1>Planner</h1>
              <p>Your tasks for today</p>
            </div>
            <div className="add-task-row">
              <input
                value={taskInput}
                onChange={e => setTaskInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addTask()}
                placeholder="Add a new task…"
              />
              <button onClick={addTask}>Add</button>
            </div>
            <div>
              {tasks.map(t => (
                <div key={t.id} className="task-item">
                  <div className={`task-check${t.done ? " done" : ""}`} onClick={() => toggleTask(t.id)}>
                    {t.done && "✓"}
                  </div>
                  <div className={`task-text${t.done ? " done" : ""}`}>{t.text}</div>
                  <button className="task-del" onClick={() => deleteTask(t.id)}>×</button>
                </div>
              ))}
            </div>
          </div>

          {/* APPS */}
          <div className={`dash-page${page === "apps" ? " active" : ""}`}>
            <div className="page-header">
              <h1>Apps</h1>
              <p>Your installed apps</p>
            </div>
            <div className="apps-page-grid">
              {[
                { href: "/Notes",  icon: "📝", bg: "#1a2e25", label: "Notes" },
                { href: "/Chess",  icon: "♟️", bg: "#1a1a2e", label: "Chess" },
                { href: "/Piano",  icon: "🎹", bg: "#2e1a1a", label: "Piano" },
                { href: "/Typing", icon: "⌨️", bg: "#1a1f2e", label: "Typing" },
                { href: "/Music",  icon: "🎵", bg: "#1a2e1a", label: "Music" },
              ].map(app => (
                <a key={app.label} href={app.href} className="app-tile">
                  <div className="app-icon" style={{ background: app.bg }}>{app.icon}</div>
                  <span>{app.label}</span>
                </a>
              ))}
            </div>
          </div>

        </div>

        {/* Music Bubble */}
        {tracks.length > 0 && (
          <div className="music-bubble">
            <audio ref={mbAudioRef} />
            <div className={`mb-card${mbOpen ? " open" : ""}`}>
              <div>
                <div className="mb-title">{currentTrack?.title || "Untitled"}</div>
                <div className="mb-artist">{currentTrack?.artist || ""}</div>
              </div>
              <div className="mb-seek-row">
                <span className="mb-time">{mbElapsed}</span>
                <div className="mb-seek" onClick={mbSeek}>
                  <div className="mb-seek-fill" style={{ width: mbProgress + "%" }} />
                </div>
                <span className="mb-time right">{mbDur}</span>
              </div>
              <div className="mb-controls">
                <button className={`mb-btn${mbShuffle ? " active" : ""}`} onClick={() => setMbShuffle(!mbShuffle)}>🔀</button>
                <button className="mb-btn" onClick={mbPrevTrack}>⏮</button>
                <button className="mb-play-btn" onClick={mbTogglePlay}>{mbPlaying ? "⏸" : "▶"}</button>
                <button className="mb-btn" onClick={mbNextTrack}>⏭</button>
                <button className={`mb-btn${mbRepeat ? " active" : ""}`} onClick={() => setMbRepeat(!mbRepeat)}>🔁</button>
              </div>
              <div className="mb-vol-row">
                <span>{mbVol === 0 ? "🔇" : mbVol < 0.5 ? "🔉" : "🔊"}</span>
                <input type="range" min="0" max="1" step="0.01" value={mbVol} onChange={e => mbVolChange(parseFloat(e.target.value))} />
              </div>
            </div>
            <button className="mb-fab" onClick={() => setMbOpen(!mbOpen)}>
              <div className={`mb-fab-wave${mbPlaying ? " pulsing" : ""}`} />
              🎵
            </button>
          </div>
        )}
      </div>
    </>
  );
}
