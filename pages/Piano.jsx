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

const ALL_KEYS  = buildKeys();
const WHITE_KEYS = ALL_KEYS.filter(k => !k.isBlack);
const BLACK_KEYS = ALL_KEYS.filter(k =>  k.isBlack);
const WK_COUNT   = WHITE_KEYS.length;

const KB_MAP = {
  "a":60,"w":61,"s":62,"e":63,"d":64,"f":65,"t":66,
  "g":67,"y":68,"h":69,"u":70,"j":71,"k":72,
};

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

export default function PianoApp({ onBack }) {
  const [pressedKeys, setPressedKeys] = useState(new Set());
  const [volume,      setVolume]      = useState(0.8);
  const [sustain,     setSustain]     = useState(false);
  const [showLetters, setShowLetters] = useState(true);
  const [hideNav,     setHideNav]     = useState(false);
  const [beams,       setBeams]       = useState([]);

  const sustainRef  = useRef(false);
  const volumeRef   = useRef(0.8);
  const pianoRef    = useRef(null);
  const chaserRef   = useRef(null);
  const rafRef      = useRef(null);

  useEffect(()=>{ sustainRef.current = sustain; }, [sustain]);
  useEffect(()=>{ volumeRef.current  = volume;  }, [volume]);

  // animate + prune beams
  useEffect(()=>{
    const tick = () => {
      setBeams(bs => bs.filter(b => Date.now()-b.born < 1400));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return ()=> cancelAnimationFrame(rafRef.current);
  }, []);

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

  // keyboard
  useEffect(()=>{
    const held = new Set();
    const dn = e => {
      if (e.ctrlKey && e.key.toLowerCase()==="s") { setSustain(v=>!v); e.preventDefault(); return; }
      if (e.ctrlKey && e.key.toLowerCase()==="h") { setHideNav(v=>!v);  e.preventDefault(); return; }
      if (e.repeat) return;
      const m = KB_MAP[e.key.toLowerCase()];
      if (m && !held.has(m)) { held.add(m); press(m); }
    };
    const up = e => { const m=KB_MAP[e.key.toLowerCase()]; if(m){held.delete(m);release(m);} };
    window.addEventListener("keydown",dn); window.addEventListener("keyup",up);
    return ()=>{ window.removeEventListener("keydown",dn); window.removeEventListener("keyup",up); };
  }, [press, release]);

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

      {/* ── TOP BAR (my aesthetic) ── */}
      {!hideNav && (
        <div style={{ background:"#0a0f0d", borderBottom:"1px solid #1a2e24", height:52, display:"flex", alignItems:"center", gap:18, padding:"0 20px", flexShrink:0 }}>
          <button onClick={onBack}
            style={{ background:"#1a1f1d", border:"1px solid #1f2e28", color:"#7a9e8e", borderRadius:8, padding:"5px 14px", cursor:"pointer", fontSize:13 }}>← Apps</button>
          <span style={{ fontSize:16, fontWeight:800 }}>🎹 Piano</span>

          {/* Volume */}
          <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:13, color:"#7a9e8e" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            <input type="range" min="0" max="1" step="0.05" value={volume}
              onChange={e=>setVolume(parseFloat(e.target.value))}
              style={{ width:90, accentColor:"#00d18c", cursor:"pointer" }}/>
          </div>

          {/* Show Letters */}
          <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:13, color:"#7a9e8e" }}>
            <Toggle value={showLetters} onChange={setShowLetters}/>
            Labels
          </div>

          {/* Hide Nav */}
          <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:13, color:"#7a9e8e" }}>
            <Toggle value={hideNav} onChange={setHideNav}/>
            Hide Nav
            <span style={{ fontSize:11, color:"#2a4a38" }}>Ctrl+H</span>
          </div>

          {/* Sustain */}
          <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:13, color: sustain?"#00d18c":"#7a9e8e" }}>
            <Toggle value={sustain} onChange={setSustain}/>
            Sustain
            <span style={{ fontSize:11, color:"#2a4a38" }}>Ctrl+S</span>
          </div>

          <div style={{ flex:1 }}/>
          <span style={{ fontSize:11, color:"#1a3028" }}>A S D F G H J K → C D E F G A B C</span>
        </div>
      )}

      {/* Hidden nav — small re-show pill */}
      {hideNav && (
        <div style={{ position:"fixed", top:8, left:8, zIndex:100 }}>
          <button onClick={()=>setHideNav(false)}
            style={{ background:"#0a0f0d", border:"1px solid #1a2e24", color:"#7a9e8e", borderRadius:8, padding:"4px 12px", cursor:"pointer", fontSize:12 }}>☰</button>
        </div>
      )}

      {/* ── NOTE CHASER ── */}
      <div ref={chaserRef} style={{ flex:1, background:"#000", position:"relative", overflow:"hidden" }}>
        {beams.map(b=>{
          const age     = (Date.now()-b.born)/1000;
          const travel  = age * chaserH * 1.1;
          const opacity = Math.max(0, 1 - age/1.2);
          const glow    = b.color;
          return (
            <div key={b.id} style={{
              position:"absolute",
              left: b.left,
              width: b.width,
              bottom: 0,
              height: Math.min(travel+30, chaserH),
              background:`linear-gradient(to top, ${glow}dd 0%, ${glow}66 50%, transparent 100%)`,
              opacity,
              borderRadius:"3px 3px 0 0",
              pointerEvents:"none",
              boxShadow:`0 0 12px 2px ${glow}44`,
            }}/>
          );
        })}
      </div>

      {/* ── PIANO KEYS ── */}
      <div ref={pianoRef} style={{ height:"36vh", position:"relative", background:"#1a1a1a", flexShrink:0, borderTop:"2px solid #111" }}>

        {/* White keys */}
        <div style={{ position:"absolute", inset:0, display:"flex" }}>
          {WHITE_KEYS.map(k=>{
            const pressed = pressedKeys.has(k.midi);
            const isC = k.name==="C";
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
                  <span style={{ fontSize:10, fontWeight:700, color: isC?"#c8960c":"#999" }}>
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
            const pressed = pressedKeys.has(k.midi);
            const prev    = WHITE_KEYS.filter(wk=>wk.midi<k.midi).length;
            const leftPct = prev/WK_COUNT*100;
            const bwPct   = 0.6/WK_COUNT*100;
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
