import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
//  PIANO — React port of the original HTML/CSS/JS app
//  • Web Audio API for all sounds (no external files)
//  • MIDI input support
//  • Keyboard shortcuts (a-k for white keys, w/e/t/y/u for black)
//  • Volume slider, sustain toggle, show/hide letters
//  • Matches the dark dashboard aesthetic
// ─────────────────────────────────────────────────────────────

// ── Note frequency map (MIDI note number → Hz) ───────────────
function midiToHz(note) { return 440 * Math.pow(2, (note - 69) / 12); }

// ── Build 5 octaves starting at C2 (MIDI 36) ─────────────────
// White keys pattern per octave: C D E F G A B
// Black keys: C# D# — F# G# A#
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function buildKeys() {
  const keys = [];
  // 5 octaves: C2 (36) → B6 (95), then add C7 (96)
  for (let oct = 2; oct <= 6; oct++) {
    const baseOctave = oct;
    const baseMidi = 12 + baseOctave * 12; // C2=36, C3=48...
    for (let n = 0; n < 12; n++) {
      const midi = baseMidi + n;
      const name = NOTE_NAMES[n];
      const isBlack = name.includes("#");
      keys.push({ midi, name, octave: baseOctave, isBlack,
        label: name.replace("#","♯") + baseOctave });
    }
  }
  keys.push({ midi: 108, name:"C", octave:7, isBlack:false, label:"C7" });
  return keys;
}

const ALL_KEYS = buildKeys();
const WHITE_KEYS = ALL_KEYS.filter(k => !k.isBlack);
const BLACK_KEYS = ALL_KEYS.filter(k => k.isBlack);

// ── Keyboard mapping (computer keyboard → MIDI) ──────────────
// Maps keys to one octave starting at C4 (middle C = 60)
const KB_MAP = {
  "a":60,"w":61,"s":62,"e":63,"d":64,"f":65,"t":66,
  "g":67,"y":68,"h":69,"u":70,"j":71,"k":72,
  // extend up
  "l":74,"p":75,";"  :76,
};

// ── Audio engine ──────────────────────────────────────────────
let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// Active nodes: midi → { osc, gain, env }
const activeNodes = {};

function playNote(midi, volume = 1, sustain = false) {
  stopNote(midi, sustain); // clean up if already playing
  const ctx = getCtx();
  const freq = midiToHz(midi);

  // Layered oscillators for a piano-ish tone
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(volume * 0.45, ctx.currentTime + 0.008);
  masterGain.connect(ctx.destination);

  const oscs = [];
  // Fundamental + harmonics
  [[1, 0.6], [2, 0.25], [3, 0.1], [4, 0.05]].forEach(([mult, amp]) => {
    const osc = ctx.createOscillator();
    osc.type = mult === 1 ? "triangle" : "sine";
    osc.frequency.value = freq * mult;
    const g = ctx.createGain();
    g.gain.value = amp;
    osc.connect(g); g.connect(masterGain);
    osc.start();
    oscs.push(osc);
  });

  // Noise click attack
  const bufLen = ctx.sampleRate * 0.04;
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = (Math.random()*2-1) * Math.exp(-i/(ctx.sampleRate*0.008));
  const noise = ctx.createBufferSource(); noise.buffer = buf;
  const nf = ctx.createBiquadFilter(); nf.type="bandpass"; nf.frequency.value=freq*2; nf.Q.value=1;
  const ng = ctx.createGain(); ng.gain.value=0.15;
  noise.connect(nf); nf.connect(ng); ng.connect(masterGain);
  noise.start();

  activeNodes[midi] = { oscs, masterGain, startTime: ctx.currentTime };
}

function stopNote(midi, sustain = false) {
  const node = activeNodes[midi];
  if (!node) return;
  const ctx = getCtx();
  const { oscs, masterGain } = node;
  const release = sustain ? 2.5 : 0.4;
  masterGain.gain.cancelScheduledValues(ctx.currentTime);
  masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + release);
  setTimeout(() => {
    try { oscs.forEach(o => o.stop()); masterGain.disconnect(); } catch {}
    delete activeNodes[midi];
  }, (release + 0.1) * 1000);
  delete activeNodes[midi]; // remove immediately so re-press works
}

// ─────────────────────────────────────────────────────────────
//  REACT COMPONENT
// ─────────────────────────────────────────────────────────────
export default function PianoApp({ onBack }) {
  const [pressedKeys, setPressedKeys] = useState(new Set());
  const [volume, setVolume] = useState(0.8);
  const [sustain, setSustain] = useState(false);
  const [showLetters, setShowLetters] = useState(true);
  const sustainRef = useRef(false);
  const volumeRef   = useRef(0.8);
  const pianoRef    = useRef(null);
  const midiRef     = useRef(null);

  useEffect(() => { sustainRef.current = sustain; }, [sustain]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  // ── press / release helpers ───────────────────────────────
  const press = useCallback((midi) => {
    setPressedKeys(s => { const n=new Set(s); n.add(midi); return n; });
    playNote(midi, volumeRef.current, sustainRef.current);
  }, []);
  const release = useCallback((midi) => {
    setPressedKeys(s => { const n=new Set(s); n.delete(midi); return n; });
    stopNote(midi, sustainRef.current);
  }, []);

  // ── keyboard input ────────────────────────────────────────
  useEffect(() => {
    const held = new Set();
    const onDown = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey) return;
      // Ctrl+S = sustain, Ctrl+H = hide letters
      if (e.key === "s" && e.ctrlKey) { setSustain(v=>!v); e.preventDefault(); return; }
      const midi = KB_MAP[e.key.toLowerCase()];
      if (midi && !held.has(midi)) { held.add(midi); press(midi); }
    };
    const onUp = (e) => {
      const midi = KB_MAP[e.key.toLowerCase()];
      if (midi) { held.delete(midi); release(midi); }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, [press, release]);

  // ── MIDI input ────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;
    navigator.requestMIDIAccess().then(access => {
      midiRef.current = access;
      const connect = () => {
        for (const input of access.inputs.values()) {
          input.onmidimessage = (e) => {
            const [cmd, note, vel] = e.data;
            if ((cmd & 0xf0) === 0x90 && vel > 0) press(note);
            else if ((cmd & 0xf0) === 0x80 || ((cmd & 0xf0) === 0x90 && vel === 0)) release(note);
          };
        }
      };
      connect();
      access.onstatechange = connect;
    }).catch(() => {});
    return () => { if (midiRef.current) for (const i of midiRef.current.inputs.values()) i.onmidimessage = null; };
  }, [press, release]);

  // ── White key width calculation ───────────────────────────
  const WK_COUNT = WHITE_KEYS.length; // 36 white keys
  // Each white key = 1 unit, total piano width fits the container
  const WK_W = `${100 / WK_COUNT}%`;

  // ── Find position of a black key relative to white keys ──
  // Returns left offset as % of total white key area
  function blackKeyLeft(midi) {
    // Find the white key index just before this black key
    const prevWhite = WHITE_KEYS.filter(k => k.midi < midi);
    const idx = prevWhite.length; // number of white keys to the left
    return `calc(${(idx / WK_COUNT) * 100}% - ${1.5 / WK_COUNT * 100 / 2}%)`;
  }

  const BK_W = `${1.5 / WK_COUNT * 100}%`;

  return (
    <div style={{ height:"100vh", background:"#111312", color:"#e8f0ed", fontFamily:"'Segoe UI',system-ui,sans-serif", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* ── TOP BAR ── */}
      <div style={{ background:"#0a0f0d", borderBottom:"1px solid #1a2e24", padding:"0 20px", height:52, display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>
        <button onClick={onBack}
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

        {/* Toggles */}
        <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", fontSize:13, color:"#7a9e8e" }}>
          <input type="checkbox" checked={showLetters} onChange={e=>setShowLetters(e.target.checked)} style={{ accentColor:"#00d18c" }}/>
          Labels
        </label>
        <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", fontSize:13, color: sustain?"#00d18c":"#7a9e8e" }}>
          <input type="checkbox" checked={sustain} onChange={e=>setSustain(e.target.checked)} style={{ accentColor:"#00d18c" }}/>
          Sustain
        </label>

        <div style={{ flex:1 }}/>
        <span style={{ fontSize:11, color:"#2a4a38" }}>
          {navigator.requestMIDIAccess ? "MIDI ready" : "No MIDI API"}
        </span>
      </div>

      {/* ── KEYBOARD HINTS ── */}
      <div style={{ background:"#0d1410", borderBottom:"1px solid #1a2e24", padding:"5px 20px", fontSize:11, color:"#2a4a38", flexShrink:0 }}>
        Keyboard: A S D F G H J K → C D E F G A B C &nbsp;|&nbsp; W E T Y U → C♯ D♯ F♯ G♯ A♯ &nbsp;|&nbsp; Ctrl+S = sustain
      </div>

      {/* ── PIANO ── */}
      <div ref={pianoRef} style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", padding:"24px 12px 12px", boxSizing:"border-box" }}>
        <div style={{ flex:1, position:"relative", width:"100%" }}>

          {/* White keys */}
          <div style={{ position:"absolute", inset:0, display:"flex" }}>
            {WHITE_KEYS.map(k => {
              const pressed = pressedKeys.has(k.midi);
              return (
                <div key={k.midi}
                  onMouseDown={()=>press(k.midi)}
                  onMouseUp={()=>release(k.midi)}
                  onMouseLeave={()=>{ if(pressedKeys.has(k.midi)) release(k.midi); }}
                  onTouchStart={e=>{e.preventDefault();press(k.midi);}}
                  onTouchEnd={e=>{e.preventDefault();release(k.midi);}}
                  style={{
                    flex:1,
                    height:"100%",
                    background: pressed ? "#c8f0d8" : "#f8f8f0",
                    border:"1px solid #bbb",
                    borderTop:"none",
                    borderRadius:"0 0 6px 6px",
                    cursor:"pointer",
                    display:"flex",
                    flexDirection:"column",
                    justifyContent:"flex-end",
                    alignItems:"center",
                    paddingBottom:8,
                    userSelect:"none",
                    boxShadow: pressed ? "inset 0 -2px 8px rgba(0,209,140,0.3)" : "inset 0 -4px 6px rgba(0,0,0,0.1)",
                    transition:"background 0.05s",
                    position:"relative",
                    zIndex:1,
                  }}>
                  {showLetters && (
                    <span style={{ fontSize:9, color: pressed?"#00874a":"#999", fontWeight:700, letterSpacing:0 }}>
                      {k.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Black keys */}
          <div style={{ position:"absolute", top:0, left:0, right:0, height:"62%", pointerEvents:"none" }}>
            {BLACK_KEYS.map(k => {
              const pressed = pressedKeys.has(k.midi);
              const left = blackKeyLeft(k.midi);
              return (
                <div key={k.midi}
                  onMouseDown={e=>{e.stopPropagation();press(k.midi);}}
                  onMouseUp={e=>{e.stopPropagation();release(k.midi);}}
                  onMouseLeave={()=>{ if(pressedKeys.has(k.midi)) release(k.midi); }}
                  onTouchStart={e=>{e.preventDefault();e.stopPropagation();press(k.midi);}}
                  onTouchEnd={e=>{e.preventDefault();e.stopPropagation();release(k.midi);}}
                  style={{
                    position:"absolute",
                    left,
                    width: BK_W,
                    height:"100%",
                    background: pressed ? "#1a5c3a" : "#1a1a1a",
                    borderRadius:"0 0 5px 5px",
                    cursor:"pointer",
                    zIndex:10,
                    pointerEvents:"all",
                    display:"flex",
                    flexDirection:"column",
                    justifyContent:"flex-end",
                    alignItems:"center",
                    paddingBottom:5,
                    userSelect:"none",
                    boxShadow: pressed
                      ? "inset 0 -2px 6px rgba(0,209,140,0.4), 2px 4px 6px rgba(0,0,0,0.5)"
                      : "2px 4px 8px rgba(0,0,0,0.6)",
                    transition:"background 0.05s",
                    border: pressed ? "1px solid #00d18c" : "1px solid #000",
                    borderTop:"none",
                  }}>
                  {showLetters && (
                    <span style={{ fontSize:7, color: pressed?"#00d18c":"#555", fontWeight:700 }}>
                      {k.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── OCTAVE LABELS ── */}
      <div style={{ height:20, display:"flex", paddingLeft:12, paddingRight:12, flexShrink:0, boxSizing:"border-box" }}>
        {[2,3,4,5,6].map(oct => {
          const wIdx = WHITE_KEYS.findIndex(k=>k.name==="C"&&k.octave===oct);
          const leftPct = (wIdx / WK_COUNT * 100).toFixed(2);
          return (
            <div key={oct} style={{ position:"absolute", left:`calc(12px + ${leftPct}% * (100% - 24px) / 100)`, fontSize:10, color:"#2a4a38", fontWeight:700 }}>
              C{oct}
            </div>
          );
        })}
      </div>
    </div>
  );
}
