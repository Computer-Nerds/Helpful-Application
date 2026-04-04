import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
//  PIANO — Full rebuild matching original design
//  • #cacaca / #414141 keys, 3D shadow gradient
//  • Note chaser: light beams fly up from pressed keys
//  • Hide nav (Ctrl+H), Sustain (Ctrl+S), Show Letters toggle
//  • Web Audio API sounds, MIDI, keyboard input
// ─────────────────────────────────────────────────────────────

function midiToHz(note) { return 440 * Math.pow(2, (note - 69) / 12); }

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function buildKeys() {
  const keys = [];
  for (let oct = 2; oct <= 6; oct++) {
    const baseMidi = 12 + oct * 12;
    for (let n = 0; n < 12; n++) {
      const midi = baseMidi + n;
      const name = NOTE_NAMES[n];
      const isBlack = name.includes("#");
      keys.push({ midi, name, octave: oct, isBlack, label: name.replace("#","#") + oct });
    }
  }
  keys.push({ midi: 108, name:"C", octave:7, isBlack:false, label:"C7" });
  return keys;
}

const ALL_KEYS = buildKeys();
const WHITE_KEYS = ALL_KEYS.filter(k => !k.isBlack);
const BLACK_KEYS = ALL_KEYS.filter(k => k.isBlack);

// Keyboard → MIDI (C4 = 60)
const KB_MAP = {
  "a":60,"w":61,"s":62,"e":63,"d":64,"f":65,"t":66,
  "g":67,"y":68,"h":69,"u":70,"j":71,"k":72,
};

// ── Audio engine ──────────────────────────────────────────────
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
    o.connect(g); g.connect(master); o.start();
    oscs.push(o);
  });

  // click attack
  const blen = Math.floor(ctx.sampleRate * 0.03);
  const buf = ctx.createBuffer(1, blen, ctx.sampleRate);
  const d = buf.getChannelData(0);
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

// ─────────────────────────────────────────────────────────────
//  NOTE CHASER — beams that fly up from pressed keys
// ─────────────────────────────────────────────────────────────
// Each beam: { id, midi, left, width, color, startY, born }
let beamIdCounter = 0;

function BeamLayer({ beams, chaserHeight }) {
  const now = Date.now();
  return (
    <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none" }}>
      {beams.map(b => {
        const age = (now - b.born) / 1000;
        const travel = age * chaserHeight * 1.2;
        const opacity = Math.max(0, 1 - age / 1.2);
        return (
          <div key={b.id} style={{
            position:"absolute",
            left: b.left,
            width: b.width,
            bottom: 0,
            height: Math.min(travel + 20, chaserHeight),
            background: `linear-gradient(to top, ${b.color}cc 0%, ${b.color}44 60%, transparent 100%)`,
            opacity,
            borderRadius: "4px 4px 0 0",
            transition:"none",
          }}/>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────
const WK_COUNT = WHITE_KEYS.length;

export default function PianoApp({ onBack }) {
  const [pressedKeys, setPressedKeys]   = useState(new Set());
  const [volume, setVolume]             = useState(0.8);
  const [sustain, setSustain]           = useState(false);
  const [showLetters, setShowLetters]   = useState(true);
  const [hideNav, setHideNav]           = useState(false);
  const [beams, setBeams]               = useState([]);
  const [, forceRender]                 = useState(0);

  const sustainRef = useRef(false);
  const volumeRef  = useRef(0.8);
  const pianoRef   = useRef(null);
  const chaserRef  = useRef(null);
  const rafRef     = useRef(null);

  useEffect(() => { sustainRef.current = sustain; }, [sustain]);
  useEffect(() => { volumeRef.current  = volume;  }, [volume]);

  // ── Animate beams ─────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setBeams(bs => bs.filter(b => now - b.born < 1300));
      forceRender(n => n+1);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Key dimensions helper ─────────────────────────────────
  const getKeyRect = useCallback((midi) => {
    if (!pianoRef.current) return null;
    const totalW = pianoRef.current.offsetWidth;
    const wkW = totalW / WK_COUNT;
    const key = ALL_KEYS.find(k => k.midi === midi);
    if (!key) return null;
    if (!key.isBlack) {
      const idx = WHITE_KEYS.findIndex(k => k.midi === midi);
      return { left: idx * wkW, width: wkW };
    } else {
      const prevWhiteCount = WHITE_KEYS.filter(k => k.midi < midi).length;
      const bkW = wkW * 0.6;
      return { left: prevWhiteCount * wkW - bkW / 2, width: bkW };
    }
  }, []);

  // ── Press / release ───────────────────────────────────────
  const press = useCallback((midi) => {
    setPressedKeys(s => { const n=new Set(s); n.add(midi); return n; });
    playNote(midi, volumeRef.current);
    // spawn beam
    const rect = getKeyRect(midi);
    if (rect) {
      const key = ALL_KEYS.find(k=>k.midi===midi);
      const isC = key?.name === "C";
      const color = key?.isBlack ? "#888cff" : isC ? "#ffd700" : "#00d18c";
      setBeams(bs => [...bs, {
        id: ++beamIdCounter,
        midi,
        left: rect.left,
        width: rect.width,
        color,
        born: Date.now(),
      }]);
    }
  }, [getKeyRect]);

  const release = useCallback((midi) => {
    setPressedKeys(s => { const n=new Set(s); n.delete(midi); return n; });
    stopNote(midi, sustainRef.current);
  }, []);

  // ── Computer keyboard ─────────────────────────────────────
  useEffect(() => {
    const held = new Set();
    const onDown = e => {
      if (e.ctrlKey && e.key.toLowerCase()==="s") { setSustain(v=>!v); e.preventDefault(); return; }
      if (e.ctrlKey && e.key.toLowerCase()==="h") { setHideNav(v=>!v); e.preventDefault(); return; }
      if (e.repeat) return;
      const midi = KB_MAP[e.key.toLowerCase()];
      if (midi && !held.has(midi)) { held.add(midi); press(midi); }
    };
    const onUp = e => {
      const midi = KB_MAP[e.key.toLowerCase()];
      if (midi) { held.delete(midi); release(midi); }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return ()=>{ window.removeEventListener("keydown",onDown); window.removeEventListener("keyup",onUp); };
  }, [press, release]);

  // ── MIDI ──────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;
    let access;
    navigator.requestMIDIAccess().then(a => {
      access = a;
      const connect = () => {
        for (const input of a.inputs.values()) {
          input.onmidimessage = e => {
            const [cmd, note, vel] = e.data;
            if ((cmd&0xf0)===0x90 && vel>0) press(note);
            else if ((cmd&0xf0)===0x80 || ((cmd&0xf0)===0x90 && vel===0)) release(note);
          };
        }
      };
      connect(); a.onstatechange = connect;
    }).catch(()=>{});
    return ()=>{ if(access) for(const i of access.inputs.values()) i.onmidimessage=null; };
  }, [press, release]);

  // ── Layout ────────────────────────────────────────────────
  const wkWidthPct = 100 / WK_COUNT;

  const toggleStyle = (active) => ({
    position:"relative", display:"inline-flex", alignItems:"center",
    width:36, height:20, borderRadius:10, cursor:"pointer",
    background: active ? "#00d18c" : "#3a3a3a",
    transition:"background 0.2s", flexShrink:0,
  });
  const toggleKnob = (active) => ({
    position:"absolute", left: active ? 18 : 2, width:16, height:16,
    borderRadius:"50%", background:"#fff", transition:"left 0.2s",
    boxShadow:"0 1px 3px rgba(0,0,0,0.4)",
  });

  return (
    <div style={{ height:"100vh", background:"#000", color:"#e0e0e0", fontFamily:"Arial,Helvetica,sans-serif", display:"flex", flexDirection:"column", overflow:"hidden", userSelect:"none" }}>

      {/* ── NAV BAR ── */}
      {!hideNav && (
        <div style={{ background:"#f6f8fa", borderBottom:"1px solid rgba(59,59,59,0.09)", height:48, display:"flex", alignItems:"center", gap:20, padding:"0 16px", flexShrink:0, color:"#222" }}>
          <button onClick={onBack}
            style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:"#444", display:"flex", alignItems:"center", padding:"4px 8px", borderRadius:6 }}>
            ←
          </button>
          <span style={{ fontSize:17, fontWeight:700, color:"#111" }}>Piano</span>

          {/* Volume */}
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:"#555" }}>
            Volume
            <input type="range" min="0" max="1" step="0.05" value={volume}
              onChange={e=>setVolume(parseFloat(e.target.value))}
              style={{ width:100, accentColor:"#008f4b", cursor:"pointer" }}/>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#008f4b" strokeWidth="2" strokeLinecap="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          </div>

          {/* Show Letters */}
          <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:13, color:"#555" }}>
            Show Letters
            <div style={toggleStyle(showLetters)} onClick={()=>setShowLetters(v=>!v)}>
              <div style={toggleKnob(showLetters)}/>
            </div>
          </div>

          {/* Hide Nav */}
          <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:13, color:"#555" }}>
            Hide Nav
            <div style={toggleStyle(hideNav)} onClick={()=>setHideNav(v=>!v)}>
              <div style={toggleKnob(hideNav)}/>
            </div>
            <span style={{ fontSize:11, color:"#aaa" }}>Ctrl + H</span>
          </div>

          {/* Sustain */}
          <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:13, color:"#555" }}>
            Sustain
            <div style={toggleStyle(sustain)} onClick={()=>setSustain(v=>!v)}>
              <div style={toggleKnob(sustain)}/>
            </div>
            <span style={{ fontSize:11, color:"#aaa" }}>Ctrl + S</span>
          </div>

          <div style={{ flex:1 }}/>

          {/* Icon buttons */}
          <button title="Timer" style={{ background:"none", border:"none", cursor:"pointer", color:"#00a6ce", padding:4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </button>
          <button title="Dark mode" style={{ background:"none", border:"none", cursor:"pointer", color:"#00a6ce", padding:4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
          <button title="Settings" style={{ background:"none", border:"none", cursor:"pointer", color:"#00a6ce", padding:4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      )}

      {/* ── NOTE CHASER (black area above piano) ── */}
      <div ref={chaserRef} style={{ flex:1, background:"#000", position:"relative", overflow:"hidden" }}>
        <BeamLayer beams={beams} chaserHeight={chaserRef.current?.offsetHeight || 400} />
      </div>

      {/* ── PIANO ── */}
      <div ref={pianoRef}
        style={{ height: hideNav ? "45vh" : "38vh", position:"relative", background:"#222", flexShrink:0 }}>

        {/* White keys */}
        <div style={{ position:"absolute", inset:0, display:"flex" }}>
          {WHITE_KEYS.map((k, idx) => {
            const pressed = pressedKeys.has(k.midi);
            const isC = k.name === "C";
            return (
              <div key={k.midi}
                onMouseDown={e=>{ e.preventDefault(); press(k.midi); }}
                onMouseUp={()=>release(k.midi)}
                onMouseLeave={()=>{ if(pressedKeys.has(k.midi)) release(k.midi); }}
                onTouchStart={e=>{ e.preventDefault(); press(k.midi); }}
                onTouchEnd={e=>{ e.preventDefault(); release(k.midi); }}
                style={{
                  flex:1,
                  height:"100%",
                  background: pressed
                    ? "linear-gradient(#d4f5e0 96%, #aaa 4%)"
                    : "linear-gradient(#FFFFF7 96%, #eee 4%)",
                  border:"1px solid #cacaca",
                  borderTop: "1px solid #bbb",
                  borderRadius:"0 0 5px 5px",
                  cursor:"pointer",
                  display:"flex",
                  flexDirection:"column",
                  justifyContent:"flex-end",
                  alignItems:"center",
                  paddingBottom:6,
                  boxShadow: pressed
                    ? "inset 0 -2px 4px rgba(0,0,0,0.15)"
                    : "inset 0 -6px 8px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.3)",
                  transition:"background 0.04s",
                  position:"relative",
                  zIndex:1,
                  boxSizing:"border-box",
                }}>
                {showLetters && (
                  <span style={{ fontSize: 10, fontWeight:700,
                    color: isC ? "#d4a000" : "#888",
                  }}>
                    {isC ? k.label : k.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Black keys */}
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"62%", pointerEvents:"none", zIndex:5 }}>
          {BLACK_KEYS.map(k => {
            const pressed = pressedKeys.has(k.midi);
            const prevWhiteCount = WHITE_KEYS.filter(wk => wk.midi < k.midi).length;
            const leftPct = prevWhiteCount / WK_COUNT * 100;
            const bkWidthPct = 0.6 / WK_COUNT * 100;
            const offsetPct = bkWidthPct / 2;
            return (
              <div key={k.midi}
                onMouseDown={e=>{ e.stopPropagation(); e.preventDefault(); press(k.midi); }}
                onMouseUp={e=>{ e.stopPropagation(); release(k.midi); }}
                onMouseLeave={()=>{ if(pressedKeys.has(k.midi)) release(k.midi); }}
                onTouchStart={e=>{ e.preventDefault(); e.stopPropagation(); press(k.midi); }}
                onTouchEnd={e=>{ e.preventDefault(); e.stopPropagation(); release(k.midi); }}
                style={{
                  position:"absolute",
                  left:`calc(${leftPct}% - ${offsetPct}%)`,
                  width:`${bkWidthPct}%`,
                  height:"100%",
                  background: pressed
                    ? "linear-gradient(to bottom, #555 0%, #333 100%)"
                    : "linear-gradient(to bottom, #414141 0%, #2a2a2a 100%)",
                  borderRadius:"0 0 4px 4px",
                  cursor:"pointer",
                  pointerEvents:"all",
                  boxShadow: pressed
                    ? "0 2px 4px rgba(0,0,0,0.6)"
                    : "0 4px 8px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)",
                  transition:"background 0.04s",
                  display:"flex",
                  flexDirection:"column",
                  justifyContent:"flex-end",
                  alignItems:"center",
                  paddingBottom:4,
                  boxSizing:"border-box",
                  border:"1px solid #1a1a1a",
                  borderTop:"none",
                }}>
                {showLetters && (
                  <span style={{ fontSize:7, color:"#666", fontWeight:700 }}>
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
