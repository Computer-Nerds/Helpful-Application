import { useState, useEffect, useRef, useCallback } from "react";

function midiToHz(note) { return 440 * Math.pow(2, (note - 69) / 12); }
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function buildKeys() {
  const keys = [];
  for (let oct = 2; oct <= 6; oct++) {
    const baseMidi = 12 + oct * 12;
    for (let n = 0; n < 12; n++) {
      const midi = baseMidi + n;
      const name = NOTE_NAMES[n];
      keys.push({ midi, name, octave: oct, isBlack: name.includes("#"), label: name + oct });
    }
  }
  keys.push({ midi: 108, name:"C", octave:7, isBlack:false, label:"C7" });
  return keys;
}

const ALL_KEYS   = buildKeys();
const WHITE_KEYS = ALL_KEYS.filter(k => !k.isBlack);
const BLACK_KEYS = ALL_KEYS.filter(k =>  k.isBlack);
const WK_COUNT   = WHITE_KEYS.length;



// ── Audio ─────────────────────────────────────────────────────
let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
const activeNodes = {};

function playNote(midi, volume = 1) {
  stopNote(midi, false, true);
  const ctx = getCtx();
  const freq = midiToHz(midi);
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(volume * 0.5, ctx.currentTime + 0.008);
  master.connect(ctx.destination);
  const oscs = [];
  [[1,0.55],[2,0.22],[3,0.1],[4,0.05],[0.5,0.08]].forEach(([m,a])=>{
    const o = ctx.createOscillator();
    o.type = m <= 1 ? "triangle" : "sine";
    o.frequency.value = freq * m;
    const g = ctx.createGain(); g.gain.value = a;
    o.connect(g); g.connect(master); o.start(); oscs.push(o);
  });
  const blen = Math.floor(ctx.sampleRate * 0.03);
  const buf  = ctx.createBuffer(1, blen, ctx.sampleRate);
  const d    = buf.getChannelData(0);
  for (let i=0;i<blen;i++) d[i]=(Math.random()*2-1)*Math.exp(-i/(ctx.sampleRate*0.006));
  const ns = ctx.createBufferSource(); ns.buffer = buf;
  const nf = ctx.createBiquadFilter(); nf.type="bandpass"; nf.frequency.value=freq*2; nf.Q.value=1;
  const ng = ctx.createGain(); ng.gain.value=0.12;
  ns.connect(nf); nf.connect(ng); ng.connect(master); ns.start();
  activeNodes[midi] = { oscs, master };
}

function stopNote(midi, sustain=false, immediate=false) {
  const node = activeNodes[midi];
  if (!node) return;
  const ctx = getCtx();
  const rel = immediate ? 0 : sustain ? 3.0 : 0.45;
  const { master, oscs } = node;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
  if (rel < 0.01) {
    try { oscs.forEach(o=>o.stop()); master.disconnect(); } catch {}
  } else {
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + rel);
    setTimeout(()=>{ try { oscs.forEach(o=>o.stop()); master.disconnect(); } catch {} }, (rel+0.1)*1000);
  }
  delete activeNodes[midi];
}

// ── Beam chaser ───────────────────────────────────────────────
let beamId = 0;

export default function PianoApp({ onBack, onTimeUpdate }) {
  const [pressedKeys, setPressedKeys] = useState(new Set());
  const [volume,      setVolume]      = useState(0.8);
  const [sustain,     setSustain]     = useState(false);
  const [showLetters, setShowLetters] = useState(true);
  const [hideNav,     setHideNav]     = useState(false);
  const [beams,       setBeams]       = useState([]);

  const sustainRef = useRef(false);
  const volumeRef  = useRef(0.8);
  const pianoRef   = useRef(null);
  const chaserRef  = useRef(null);
  const rafRef     = useRef(null);
  const timerRef   = useRef(null);

  // ── Practice timer (mirrors Chess) ──────────────────────────
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsed, setElapsed]           = useState(() => parseInt(localStorage.getItem('pianoTimer')||'0'));

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsed(e => {
          const next = e + 1;
          localStorage.setItem('pianoTimer', String(next));
          if (onTimeUpdate) onTimeUpdate(next);
          return next;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  useEffect(() => {
    const saved = parseInt(localStorage.getItem('pianoTimer')||'0');
    if (onTimeUpdate && saved > 0) onTimeUpdate(saved);
  }, []);

  const formatTime = (s) => {
    const m = Math.floor(s/60), sec = s%60;
    return String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
  };

  useEffect(()=>{ sustainRef.current = sustain; }, [sustain]);
  useEffect(()=>{ volumeRef.current  = volume;  }, [volume]);

  // prune old beams each frame
  useEffect(()=>{
    const tick = () => {
      setBeams(bs => bs.filter(b => Date.now()-b.born < 1400));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return ()=> cancelAnimationFrame(rafRef.current);
  }, []);

  // get key pixel rect relative to piano container
  const getKeyRect = useCallback((midi)=>{
    if (!pianoRef.current) return null;
    const totalW = pianoRef.current.offsetWidth;
    const wkW    = totalW / WK_COUNT;
    const key    = ALL_KEYS.find(k=>k.midi===midi);
    if (!key) return null;
    if (!key.isBlack) {
      const idx = WHITE_KEYS.findIndex(k=>k.midi===midi);
      return { left: idx * wkW, width: wkW };
    } else {
      const prev = WHITE_KEYS.filter(k=>k.midi<midi).length;
      const bkW  = wkW * 0.6;
      return { left: prev * wkW - bkW/2, width: bkW };
    }
  }, []);

  const press = useCallback((midi)=>{
    setPressedKeys(s=>{ const n=new Set(s); n.add(midi); return n; });
    playNote(midi, volumeRef.current);
    const rect = getKeyRect(midi);
    if (rect) {
      const key   = ALL_KEYS.find(k=>k.midi===midi);
      const color = key?.isBlack ? "#888cff" : key?.name==="C" ? "#ffd700" : "#00d18c";
      setBeams(bs=>[...bs, { id:++beamId, midi, left:rect.left, width:rect.width, color, born:Date.now() }]);
    }
  }, [getKeyRect]);

  const release = useCallback((midi)=>{
    setPressedKeys(s=>{ const n=new Set(s); n.delete(midi); return n; });
    stopNote(midi, sustainRef.current);
  }, []);

  // keyboard shortcuts only (no note playing)
  useEffect(()=>{
    const dn = e => {
      if (e.ctrlKey && e.key.toLowerCase()==="s") { setSustain(v=>!v); e.preventDefault(); return; }
      if (e.ctrlKey && e.key.toLowerCase()==="h") { setHideNav(v=>!v);  e.preventDefault(); return; }
    };
    window.addEventListener("keydown",dn);
    return ()=> window.removeEventListener("keydown",dn);
  }, []);

  // MIDI
  useEffect(()=>{
    if (!navigator.requestMIDIAccess) return;
    let acc;
    navigator.requestMIDIAccess().then(a=>{
      acc=a;
      const conn=()=>{ for(const i of a.inputs.values()) i.onmidimessage=e=>{
        const[cmd,note,vel]=e.data;
        if((cmd&0xf0)===0x90&&vel>0) press(note);
        else if((cmd&0xf0)===0x80||((cmd&0xf0)===0x90&&vel===0)) release(note);
      };};
      conn(); a.onstatechange=conn;
    }).catch(()=>{});
    return ()=>{ if(acc) for(const i of acc.inputs.values()) i.onmidimessage=null; };
  }, [press, release]);

  const Toggle = ({ value, onChange }) => (
    <div onClick={()=>onChange(!value)} style={{ position:"relative", display:"inline-flex", alignItems:"center", width:36, height:20, borderRadius:10, cursor:"pointer", background:value?"#00d18c":"#2a3a30", border:`1px solid ${value?"#00d18c":"#1f2e28"}`, transition:"background 0.2s", flexShrink:0 }}>
      <div style={{ position:"absolute", left:value?17:2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.18s", boxShadow:"0 1px 3px rgba(0,0,0,0.5)" }}/>
    </div>
  );

  const chaserH = chaserRef.current?.offsetHeight || 400;

  return (
    <div style={{ height:"100vh", background:"#000", color:"#e8f0ed", fontFamily:"'Segoe UI',system-ui,sans-serif", display:"flex", flexDirection:"column", overflow:"hidden", userSelect:"none" }}>

      {/* ── TOP BAR ── */}
      {!hideNav && (
        <div style={{ background:"#0a0f0d", borderBottom:"1px solid #1a2e24", padding:"0 20px", height:52, display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>
          <button onClick={()=>{ if(onBack) onBack(); }}
            style={{ background:"#1a1f1d", border:"1px solid #1f2e28", color:"#7a9e8e", borderRadius:8, padding:"5px 14px", cursor:"pointer", fontSize:13 }}>← Apps</button>
          <span style={{ fontSize:16, fontWeight:800, letterSpacing:"0.5px" }}>🎹 Piano</span>

          {/* Volume */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:12 }}>
            <span style={{ fontSize:12, color:"#7a9e8e" }}>Vol</span>
            <input type="range" min="0" max="1" step="0.05" value={volume}
              onChange={e=>setVolume(parseFloat(e.target.value))}
              style={{ width:90, accentColor:"#00d18c" }}/>
            <span style={{ fontSize:12, color:"#4a7060", minWidth:28 }}>{Math.round(volume*100)}%</span>
          </div>

          {/* Labels */}
          <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", fontSize:13, color:"#7a9e8e" }}>
            <input type="checkbox" checked={showLetters} onChange={e=>setShowLetters(e.target.checked)} style={{ accentColor:"#00d18c" }}/>
            Labels
          </label>

          {/* Sustain */}
          <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", fontSize:13, color: sustain?"#00d18c":"#7a9e8e" }}>
            <input type="checkbox" checked={sustain} onChange={e=>setSustain(e.target.checked)} style={{ accentColor:"#00d18c" }}/>
            Sustain
          </label>

          {/* Hide Nav */}
          <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", fontSize:13, color:"#7a9e8e" }}>
            <input type="checkbox" checked={hideNav} onChange={e=>setHideNav(e.target.checked)} style={{ accentColor:"#00d18c" }}/>
            Hide Nav
          </label>

          <div style={{ flex:1 }}/>
          <span style={{ fontSize:11, color:"#2a4a38" }}>
            {navigator.requestMIDIAccess ? "MIDI ready" : "No MIDI API"}
          </span>

          {/* Practice Timer */}
          <div style={{ display:"flex", alignItems:"center", gap:8, background:"#0d1a14", border:"1px solid #1f2e28", borderRadius:10, padding:"4px 12px", marginLeft:8 }}>
            <span style={{ fontSize:15, fontWeight:800, letterSpacing:"2px", color:elapsed>=1800?"#00d18c":"#e8f0ed", minWidth:50, textAlign:"center", fontVariantNumeric:"tabular-nums" }}>
              {formatTime(elapsed)}
            </span>
            <button onClick={()=>setTimerRunning(v=>!v)}
              style={{ background:timerRunning?"rgba(247,78,78,0.15)":"rgba(0,209,140,0.15)", border:`1px solid ${timerRunning?"#f74e4e":"#00d18c"}`, borderRadius:6, padding:"2px 10px", cursor:"pointer", fontSize:12, fontWeight:700, color:timerRunning?"#f74e4e":"#00d18c" }}>
              {timerRunning?"⏸":"▶"}
            </button>
            <button onClick={()=>{ setTimerRunning(false); setElapsed(0); localStorage.setItem('pianoTimer','0'); if(onTimeUpdate) onTimeUpdate(0); }}
              title="Reset"
              style={{ background:"none", border:"none", cursor:"pointer", padding:"2px 4px", color:"#4a7060", display:"flex", alignItems:"center" }}
              onMouseEnter={e=>e.currentTarget.style.color="#e8f0ed"}
              onMouseLeave={e=>e.currentTarget.style.color="#4a7060"}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {hideNav && (
        <div style={{ position:"fixed", top:8, left:8, zIndex:100 }}>
          <button onClick={()=>setHideNav(false)}
            style={{ background:"#0a0f0d", border:"1px solid #1a2e24", color:"#7a9e8e", borderRadius:8, padding:"4px 12px", cursor:"pointer", fontSize:12 }}>☰</button>
        </div>
      )}

      {/* ── SHORTCUTS BAR ── */}
      {!hideNav && (
        <div style={{ background:"#0d1410", borderBottom:"1px solid #1a2e24", padding:"5px 20px", fontSize:11, color:"#2a4a38", flexShrink:0, display:"flex", gap:16 }}>
          <span>🎹 MIDI &amp; mouse playable</span>
          <span style={{ color:"#1a3028" }}>|</span>
          <span>Ctrl+S = sustain</span>
          <span style={{ color:"#1a3028" }}>|</span>
          <span>Ctrl+H = hide nav</span>
        </div>
      )}

      {/* ── NOTE CHASER ── */}
      <div ref={chaserRef} style={{ flex:1, background:"#000", position:"relative", overflow:"hidden" }}>
        {beams.map(b=>{
          const age    = (Date.now()-b.born)/1000;
          const travel = age * chaserH * 1.1;
          const opacity= Math.max(0, 1 - age/1.2);
          return (
            <div key={b.id} style={{
              position:"absolute",
              left: b.left,
              width: b.width,
              bottom: 0,
              height: Math.min(travel+30, chaserH),
              background:`linear-gradient(to top, ${b.color}dd 0%, ${b.color}66 50%, transparent 100%)`,
              opacity,
              borderRadius:"3px 3px 0 0",
              pointerEvents:"none",
              boxShadow:`0 0 12px 2px ${b.color}44`,
            }}/>
          );
        })}
      </div>

      {/* ── PIANO KEYS — full width flex, same as first version ── */}
      <div ref={pianoRef} style={{ height:"36vh", position:"relative", background:"#1a1a1a", flexShrink:0, borderTop:"2px solid #111" }}>

        {/* White keys */}
        <div style={{ position:"absolute", inset:0, display:"flex" }}>
          {WHITE_KEYS.map(k=>{
            const pressed = pressedKeys.has(k.midi);
            const isC     = k.name==="C";
            return (
              <div key={k.midi}
                onMouseDown={e=>{e.preventDefault();press(k.midi);}}
                onMouseUp={()=>release(k.midi)}
                onMouseLeave={()=>{ if(pressedKeys.has(k.midi)) release(k.midi); }}
                onTouchStart={e=>{e.preventDefault();press(k.midi);}}
                onTouchEnd={e=>{e.preventDefault();release(k.midi);}}
                style={{
                  flex:1, height:"100%",
                  background: pressed
                    ? "linear-gradient(#d0f0e0 96%, #bbb 4%)"
                    : "linear-gradient(#FFFFF7 96%, #eee 4%)",
                  border:"1px solid #cacaca",
                  borderTop:"none",
                  borderRadius:"0 0 5px 5px",
                  cursor:"pointer",
                  display:"flex", flexDirection:"column", justifyContent:"flex-end", alignItems:"center",
                  paddingBottom:6,
                  boxShadow: pressed
                    ? "inset 0 -2px 4px rgba(0,209,140,0.2)"
                    : "inset 0 -6px 8px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.4)",
                  transition:"background 0.04s",
                  position:"relative", zIndex:1, boxSizing:"border-box",
                }}>
                {showLetters && (
                  <span style={{ fontSize:10, fontWeight:700, color:isC?"#c8960c":"#999" }}>
                    {isC ? k.label : k.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Black keys */}
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"62%", pointerEvents:"none", zIndex:5 }}>
          {BLACK_KEYS.map(k=>{
            const pressed         = pressedKeys.has(k.midi);
            const prevWhiteCount  = WHITE_KEYS.filter(wk=>wk.midi<k.midi).length;
            const leftPct         = prevWhiteCount / WK_COUNT * 100;
            const bwPct           = 0.6 / WK_COUNT * 100;
            return (
              <div key={k.midi}
                onMouseDown={e=>{e.stopPropagation();e.preventDefault();press(k.midi);}}
                onMouseUp={e=>{e.stopPropagation();release(k.midi);}}
                onMouseLeave={()=>{ if(pressedKeys.has(k.midi)) release(k.midi); }}
                onTouchStart={e=>{e.preventDefault();e.stopPropagation();press(k.midi);}}
                onTouchEnd={e=>{e.preventDefault();e.stopPropagation();release(k.midi);}}
                style={{
                  position:"absolute",
                  left:`calc(${leftPct}% - ${bwPct/2}%)`,
                  width:`${bwPct}%`, height:"100%",
                  background: pressed
                    ? "linear-gradient(to bottom, #555 0%, #333 100%)"
                    : "linear-gradient(to bottom, #414141 0%, #252525 100%)",
                  borderRadius:"0 0 4px 4px",
                  cursor:"pointer", pointerEvents:"all",
                  boxShadow: pressed
                    ? "0 2px 3px rgba(0,0,0,0.5)"
                    : "0 5px 10px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.07)",
                  transition:"background 0.04s",
                  display:"flex", flexDirection:"column", justifyContent:"flex-end", alignItems:"center",
                  paddingBottom:4, boxSizing:"border-box",
                  border:"1px solid #111", borderTop:"none",
                }}>
                {showLetters && (
                  <span style={{ fontSize:7, color:"#555", fontWeight:700 }}>
                    {k.name.replace("#","♯")}{k.octave}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
