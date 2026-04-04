import { useState, useEffect, useRef } from "react";

// ── Word banks ────────────────────────────────────────────────────────────────
const WORDS_EASY = ["the","be","to","of","and","a","in","that","have","it","for","not","on","with","he","as","you","do","at","this","but","his","by","from","they","we","say","her","she","or","an","will","my","one","all","would","there","their","what","so","up","out","if","about","who","get","which","go","me","when","make","can","like","time","no","just","him","know","take","people","into","year","your","good","some","could","them","see","other","than","then","now","look","only","come","its","over","think","also","back","after","use","two","how","our","work","first","well","way","even","new","want","because","any","these","give","day","most","us"];
const WORDS_HARD = ["rhythm","bureaucracy","entrepreneur","conscientious","phenomenon","onomatopoeia","necessary","accommodate","occurrence","perseverance","miscellaneous","acquaintance","Mediterranean","psychological","reconnaissance","extraordinary","approximately","distinguishable","incomprehensible","responsibilities","simultaneously","acknowledgement","conscientiously","extraordinarily","revolutionary","unprecedented","sophisticated","unambiguously","characteristic","disappointment"];
const SENTENCES = [
  "The quick brown fox jumps over the lazy dog.",
  "Coding every day sharpens your mind and builds discipline.",
  "Practice makes perfect and consistency is the key to mastering any skill.",
  "Every great developer was once a beginner who refused to give up.",
  "The secret of getting ahead is getting started.",
  "A smooth sea never made a skilled sailor.",
  "Focus on the journey not the destination.",
  "Small daily improvements lead to stunning long-term results.",
  "Type with intention and let your fingers find their own rhythm.",
  "The keyboard is your instrument and the screen is your stage.",
  "Learning to type quickly unlocks a whole new level of productivity.",
  "There is no shortcut to mastery only deliberate and consistent practice.",
];

const MODES = [
  { key: "words",     label: "Words",      icon: "📝" },
  { key: "hard",      label: "Hard Words", icon: "💀" },
  { key: "sentences", label: "Sentences",  icon: "📖" },
];

const POMO_PHASES = [
  { label:"Focus",      secs: 25*60 },
  { label:"Break",      secs:  5*60 },
  { label:"Focus",      secs: 25*60 },
  { label:"Break",      secs:  5*60 },
  { label:"Focus",      secs: 25*60 },
  { label:"Break",      secs:  5*60 },
  { label:"Focus",      secs: 25*60 },
  { label:"Long Break", secs: 15*60 },
];

function getPrompt(mode) {
  if (mode === "words")     return [...WORDS_EASY].sort(() => Math.random()-0.5).slice(0,20).join(" ");
  if (mode === "hard")      return [...WORDS_HARD].sort(() => Math.random()-0.5).slice(0,12).join(" ");
  if (mode === "sentences") return SENTENCES[Math.floor(Math.random()*SENTENCES.length)];
  return "";
}

// Split prompt into word-tokens (keep spaces as separate tokens so they don't break)
function tokenize(str) {
  // split into [word, space, word, space, ...]
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    if (str[i] === " ") {
      tokens.push({ type:"space", start:i, text:" " });
      i++;
    } else {
      let j = i;
      while (j < str.length && str[j] !== " ") j++;
      tokens.push({ type:"word", start:i, text:str.slice(i,j) });
      i = j;
    }
  }
  return tokens;
}

export default function TypingApp({ onBack }) {
  const [mode, setMode]         = useState("words");
  const [prompt, setPrompt]     = useState(() => getPrompt("words"));
  const [typed, setTyped]       = useState("");
  const [started, setStarted]   = useState(false);
  const [finished, setFinished] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [wpm, setWpm]           = useState(0);
  const [acc, setAcc]           = useState(100);
  const [bestWpm, setBestWpm]   = useState(() => parseInt(localStorage.getItem("typing_best_wpm")||"0"));

  // Pomodoro
  const [pomoPhase, setPomoPhase]           = useState(0);
  const [pomoRemaining, setPomoRemaining]   = useState(POMO_PHASES[0].secs);
  const [pomoRunning, setPomoRunning]       = useState(false);
  const [pomoSession, setPomoSession]       = useState(0);
  const pomoIntervalRef = useRef(null);

  const inputRef = useRef(null);
  const wpmRef   = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, [prompt]);

  // Live WPM
  useEffect(() => {
    if (started && !finished && startTime) {
      wpmRef.current = setInterval(() => {
        const elapsed = (Date.now()-startTime)/60000;
        setWpm(elapsed>0 ? Math.round((typed.length/5)/elapsed) : 0);
      }, 300);
    }
    return () => clearInterval(wpmRef.current);
  }, [started, finished, startTime, typed]);

  // Pomodoro tick
  useEffect(() => {
    if (pomoRunning) {
      pomoIntervalRef.current = setInterval(() => {
        setPomoRemaining(r => {
          if (r <= 1) {
            clearInterval(pomoIntervalRef.current);
            setPomoRunning(false);
            // advance phase
            setPomoPhase(p => {
              const next = (p+1) % POMO_PHASES.length;
              setPomoRemaining(POMO_PHASES[next].secs);
              if (POMO_PHASES[p].label === "Focus") setPomoSession(s => Math.min(4, s+1));
              return next;
            });
            return 0;
          }
          return r-1;
        });
      }, 1000);
    } else {
      clearInterval(pomoIntervalRef.current);
    }
    return () => clearInterval(pomoIntervalRef.current);
  }, [pomoRunning]);

  function pomoToggle() { setPomoRunning(r => !r); }
  function pomoReset()  { setPomoRunning(false); setPomoRemaining(POMO_PHASES[pomoPhase].secs); }
  function pomoSkip()   {
    clearInterval(pomoIntervalRef.current);
    setPomoRunning(false);
    setPomoPhase(p => {
      const next = (p+1) % POMO_PHASES.length;
      if (POMO_PHASES[p].label==="Focus") setPomoSession(s => Math.min(4,s+1));
      if (next===0) setPomoSession(0);
      setPomoRemaining(POMO_PHASES[next].secs);
      return next;
    });
  }

  const pomoM = Math.floor(pomoRemaining/60);
  const pomoS = pomoRemaining%60;
  const pomoDisplay = `${String(pomoM).padStart(2,"0")}:${String(pomoS).padStart(2,"0")}`;
  const isBreak = POMO_PHASES[pomoPhase].label.includes("Break");
  const pomoColor = isBreak ? "#febc2e" : "#00d18c";
  const pomoPct = ((1 - pomoRemaining/POMO_PHASES[pomoPhase].secs)*100);

  // Typing reset
  function resetAll(m = mode) {
    clearInterval(wpmRef.current);
    setPrompt(getPrompt(m));
    setTyped(""); setStarted(false); setFinished(false);
    setStartTime(null); setWpm(0); setAcc(100);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function resetKeepPomo(m = mode) {
    clearInterval(wpmRef.current);
    setPrompt(getPrompt(m));
    setTyped(""); setStarted(false); setFinished(false);
    setStartTime(null); setWpm(0); setAcc(100);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function switchMode(m) { setMode(m); resetAll(m); }

  function handleInput(e) {
    if (finished) return;
    const val = e.target.value;
    if (val.length > prompt.length) return;
    if (!started && val.length > 0) { setStarted(true); setStartTime(Date.now()); }
    setTyped(val);
    let wrong = 0;
    for (let i=0; i<val.length; i++) { if (val[i]!==prompt[i]) wrong++; }
    setAcc(val.length>0 ? Math.round(((val.length-wrong)/val.length)*100) : 100);
    if (val===prompt) {
      clearInterval(wpmRef.current);
      const elapsed = (Date.now()-startTime)/60000;
      const fw = Math.round((prompt.length/5)/elapsed);
      setWpm(fw); setFinished(true);
      if (fw>bestWpm) { setBestWpm(fw); localStorage.setItem("typing_best_wpm",String(fw)); }
      setTimeout(() => resetKeepPomo(mode), 1800);
    }
  }

  useEffect(() => {
    const h = (e) => {
      if (e.key==="Escape") { e.preventDefault(); resetAll(); }
      if (e.key==="Tab")    { e.preventDefault(); resetAll(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [mode]);

  // Char colors
  const charColors = prompt.split("").map((ch, i) => {
    if (i < typed.length) {
      return typed[i]===ch ? { color:"#00d18c", bg:"transparent" } : { color:"#f87171", bg:"rgba(248,113,113,0.12)" };
    }
    return { color:"#3a5548", bg:"transparent" };
  });

  const tokens = tokenize(prompt);
  const wrongCount = typed.split("").filter((c,i) => c!==prompt[i]).length;
  const progress = prompt.length>0 ? (typed.length/prompt.length)*100 : 0;

  return (
    <div style={{ height:"100vh", background:"#0e1210", color:"#e8f0ed", fontFamily:"'Segoe UI',system-ui,sans-serif", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* ── TOP BAR ── */}
      <div style={{ background:"#0a0f0d", borderBottom:"1px solid #1a2e24", padding:"0 20px", height:54, display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"#1a1f1d", border:"1px solid #1f2e28", color:"#7a9e8e", borderRadius:8, padding:"5px 14px", cursor:"pointer", fontSize:13 }}>← Apps</button>
        <span style={{ fontSize:16, fontWeight:800 }}>⌨️ Typing</span>

        <div style={{ display:"flex", gap:6 }}>
          {MODES.map(m => (
            <button key={m.key} onClick={() => switchMode(m.key)}
              style={{ background: mode===m.key?"rgba(0,209,140,0.15)":"transparent", border:`1px solid ${mode===m.key?"#00d18c":"#1f2e28"}`, color:mode===m.key?"#00d18c":"#7a9e8e", borderRadius:8, padding:"4px 12px", cursor:"pointer", fontSize:12, fontWeight:700, transition:"all 0.15s" }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        <div style={{ flex:1 }} />

        {/* Stats */}
        {[
          { label:"WPM",  val:started?wpm:"--",     color:wpm>=80?"#00d18c":wpm>=50?"#f7a94e":"#e8f0ed" },
          { label:"ACC",  val:started?acc+"%":"--", color:acc>=95?"#00d18c":acc>=80?"#f7a94e":"#f87171" },
          { label:"BEST", val:bestWpm>0?bestWpm:"--", color:"#7a9e8e" },
        ].map(s => (
          <div key={s.label} style={{ background:"#1a1f1d", border:"1px solid #1f2e28", borderRadius:10, padding:"4px 14px", textAlign:"center", minWidth:62 }}>
            <div style={{ fontSize:17, fontWeight:800, color:s.color, fontVariantNumeric:"tabular-nums" }}>{s.val}</div>
            <div style={{ fontSize:10, color:"#4a7060", textTransform:"uppercase", letterSpacing:"0.5px" }}>{s.label}</div>
          </div>
        ))}

        {/* Pomodoro */}
        <div style={{ display:"flex", alignItems:"center", gap:8, background:"#141a17", border:`1px solid ${pomoRunning?pomoColor+"55":"#1f2e28"}`, borderRadius:12, padding:"5px 14px", marginLeft:4 }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", minWidth:52 }}>
            <span style={{ fontSize:9, color:pomoRunning?pomoColor:"#4a6055", textTransform:"uppercase", letterSpacing:"0.5px", fontWeight:700 }}>
              {POMO_PHASES[pomoPhase].label}
            </span>
            <span style={{ fontSize:19, fontWeight:800, fontVariantNumeric:"tabular-nums", color:pomoRunning?pomoColor:"#4a6055", letterSpacing:"1px" }}>
              {pomoDisplay}
            </span>
          </div>
          <button onClick={pomoToggle}
            style={{ background:pomoRunning?"rgba(247,78,78,0.15)":"rgba(0,209,140,0.12)", border:`1px solid ${pomoRunning?"#f74e4e":"#00d18c"}`, borderRadius:6, padding:"2px 9px", cursor:"pointer", fontSize:12, fontWeight:700, color:pomoRunning?"#f74e4e":"#00d18c" }}>
            {pomoRunning?"⏸":"▶"}
          </button>
          <button onClick={pomoReset} title="Reset phase"
            style={{ background:"none", border:"none", cursor:"pointer", color:"#2a4a38", display:"flex", alignItems:"center", padding:"2px 2px" }}
            onMouseEnter={e=>e.currentTarget.style.color="#7a9e8e"} onMouseLeave={e=>e.currentTarget.style.color="#2a4a38"}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
          </button>
          <button onClick={pomoSkip} title="Skip phase"
            style={{ background:"none", border:"none", cursor:"pointer", color:"#2a4a38", fontSize:13, padding:"2px 2px" }}
            onMouseEnter={e=>e.currentTarget.style.color="#7a9e8e"} onMouseLeave={e=>e.currentTarget.style.color="#2a4a38"}>
            ⏭
          </button>
          <div style={{ display:"flex", gap:3, marginLeft:2 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:i<pomoSession?pomoColor:"#1f2e28", transition:"background 0.3s" }} />
            ))}
          </div>
        </div>

        <span style={{ fontSize:11, color:"#2a4a38" }}>Esc · Tab = reset</span>
      </div>

      {/* ── PROGRESS BARS ── */}
      <div style={{ height:3, background:"#1a2e24", flexShrink:0 }}>
        <div style={{ height:"100%", width:`${progress}%`, background:finished?"#00d18c":"#4e8ef7", transition:"width 0.1s", borderRadius:"0 2px 2px 0" }} />
      </div>
      <div style={{ height:3, background:"#1a2e24", flexShrink:0 }}>
        <div style={{ height:"100%", width:`${pomoPct}%`, background:pomoColor, transition:"width 1s linear", borderRadius:"0 2px 2px 0" }} />
      </div>

      {/* ── TYPING AREA ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"32px 48px", gap:24 }}
        onClick={() => inputRef.current?.focus()}>

        {/* Prompt box — words wrap as units, centered */}
        <div style={{
          width:"100%", maxWidth:800,
          background:"#141a17",
          border:`1px solid ${finished?"#00d18c":"#1f2e28"}`,
          borderRadius:16,
          padding:"28px 36px",
          fontSize:22,
          lineHeight:2,
          letterSpacing:"0.3px",
          position:"relative",
          cursor:"text",
          transition:"border-color 0.3s",
          textAlign:"center",
          // words wrap as whole units — no mid-word breaks
          wordBreak:"normal",
          overflowWrap:"normal",
          whiteSpace:"normal",
        }}>
          {tokens.map((token, ti) => {
            if (token.type === "space") {
              // render space — allow line break after the space (not inside a word)
              const i = token.start;
              const color = i < typed.length ? (typed[i]===" " ? "#00d18c" : "#f87171") : "#3a5548";
              const isCursor = i === typed.length;
              return (
                <span key={ti} style={{ color, position:"relative", display:"inline" }}>
                  {isCursor && <span style={{ position:"absolute", left:0, top:"15%", width:2, height:"70%", background:"#00d18c", borderRadius:1, animation:"blink 1s step-end infinite" }} />}
                  {"\u00A0"}
                </span>
              );
            } else {
              // render word as a single no-break inline-block
              return (
                <span key={ti} style={{ display:"inline-block", whiteSpace:"nowrap" }}>
                  {token.text.split("").map((ch, ci) => {
                    const i = token.start + ci;
                    const { color, bg } = charColors[i] || { color:"#3a5548", bg:"transparent" };
                    const isCursor = i === typed.length;
                    return (
                      <span key={ci} style={{ color, background:bg, borderRadius:2, position:"relative", display:"inline" }}>
                        {isCursor && <span style={{ position:"absolute", left:0, top:"10%", width:2, height:"80%", background:"#00d18c", borderRadius:1, animation:"blink 1s step-end infinite" }} />}
                        {ch}
                      </span>
                    );
                  })}
                </span>
              );
            }
          })}

          {finished && (
            <div style={{ position:"absolute", inset:0, background:"rgba(14,18,16,0.93)", borderRadius:16, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, zIndex:5 }}>
              <div style={{ fontSize:28 }}>✓</div>
              <div style={{ fontSize:24, fontWeight:800, color:"#00d18c" }}>{wpm} WPM</div>
              <div style={{ fontSize:14, color:"#7a9e8e" }}>{acc}% accuracy · {wrongCount} error{wrongCount!==1?"s":""}</div>
              {wpm===bestWpm && wpm>0 && <div style={{ fontSize:12, color:"#f7a94e", marginTop:4 }}>🏆 New personal best!</div>}
            </div>
          )}
        </div>

        <input ref={inputRef} value={typed} onChange={handleInput}
          style={{ position:"absolute", opacity:0, pointerEvents:"none", width:1, height:1 }}
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />

        <div style={{ fontSize:12, color:"#2a4a38", display:"flex", gap:20 }}>
          <span style={{ color:"#1a5a3a" }}>🟢 correct</span>
          <span style={{ color:"#5a2a2a" }}>🔴 wrong</span>
          <span>· Start typing to begin · Esc to reset</span>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  );
}
