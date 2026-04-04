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
  "There is no shortcut to mastery — only deliberate and consistent practice.",
];

const MODES = [
  { key: "words",     label: "Words",      icon: "📝" },
  { key: "hard",      label: "Hard Words", icon: "💀" },
  { key: "sentences", label: "Sentences",  icon: "📖" },
];

const TIMER_TOTAL = 15 * 60; // 15 minutes

function getPrompt(mode) {
  if (mode === "words") {
    return [...WORDS_EASY].sort(() => Math.random() - 0.5).slice(0, 20).join(" ");
  }
  if (mode === "hard") {
    return [...WORDS_HARD].sort(() => Math.random() - 0.5).slice(0, 12).join(" ");
  }
  if (mode === "sentences") return SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
  return "";
}

export default function TypingApp({ onBack }) {
  const [mode, setMode]       = useState("words");
  const [prompt, setPrompt]   = useState(() => getPrompt("words"));
  const [typed, setTyped]     = useState("");
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [wpm, setWpm]         = useState(0);
  const [acc, setAcc]         = useState(100);
  const [bestWpm, setBestWpm] = useState(() => parseInt(localStorage.getItem("typing_best_wpm") || "0"));

  // Countdown timer (15 min)
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(TIMER_TOTAL);
  const timerIntervalRef = useRef(null);

  const inputRef   = useRef(null);
  const wpmRef     = useRef(null);

  // Focus on prompt change
  useEffect(() => { inputRef.current?.focus(); }, [prompt]);

  // Live WPM ticker
  useEffect(() => {
    if (started && !finished && startTime) {
      wpmRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 60000;
        setWpm(elapsed > 0 ? Math.round((typed.length / 5) / elapsed) : 0);
      }, 300);
    }
    return () => clearInterval(wpmRef.current);
  }, [started, finished, startTime, typed]);

  // Countdown timer logic
  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerRemaining(r => {
          if (r <= 1) {
            clearInterval(timerIntervalRef.current);
            setTimerRunning(false);
            setFinished(true);
            clearInterval(wpmRef.current);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [timerRunning]);

  function resetAll(m = mode) {
    clearInterval(wpmRef.current);
    clearInterval(timerIntervalRef.current);
    setPrompt(getPrompt(m));
    setTyped("");
    setStarted(false);
    setFinished(false);
    setStartTime(null);
    setWpm(0);
    setAcc(100);
    setTimerRunning(false);
    setTimerRemaining(TIMER_TOTAL);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function switchMode(m) {
    setMode(m);
    resetAll(m);
  }

  function handleInput(e) {
    if (finished) return;
    const val = e.target.value;
    if (val.length > prompt.length) return;

    if (!started && val.length > 0) {
      setStarted(true);
      setStartTime(Date.now());
      setTimerRunning(true); // auto-start timer on first keypress
    }

    setTyped(val);

    let wrong = 0;
    for (let i = 0; i < val.length; i++) {
      if (val[i] !== prompt[i]) wrong++;
    }
    setAcc(val.length > 0 ? Math.round(((val.length - wrong) / val.length) * 100) : 100);

    if (val === prompt) {
      clearInterval(wpmRef.current);
      const elapsed = (Date.now() - startTime) / 60000;
      const finalWpm = Math.round((prompt.length / 5) / elapsed);
      setWpm(finalWpm);
      setFinished(true);
      if (finalWpm > bestWpm) {
        setBestWpm(finalWpm);
        localStorage.setItem("typing_best_wpm", String(finalWpm));
      }
      // auto load next prompt after short delay
      setTimeout(() => resetAllKeepTimer(mode), 1800);
    }
  }

  // Reset prompt but keep the countdown running
  function resetAllKeepTimer(m = mode) {
    clearInterval(wpmRef.current);
    setPrompt(getPrompt(m));
    setTyped("");
    setStarted(false);
    setFinished(false);
    setStartTime(null);
    setWpm(0);
    setAcc(100);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // Esc / Tab
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") { e.preventDefault(); resetAll(); }
      if (e.key === "Tab")    { e.preventDefault(); resetAll(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode]);

  // Timer display
  const timerMins = Math.floor(timerRemaining / 60);
  const timerSecs = timerRemaining % 60;
  const timerDisplay = `${String(timerMins).padStart(2,"0")}:${String(timerSecs).padStart(2,"0")}`;
  const timerPct = ((TIMER_TOTAL - timerRemaining) / TIMER_TOTAL) * 100;
  const timerColor = timerRemaining <= 60 ? "#f87171" : timerRemaining <= 180 ? "#f7a94e" : "#00d18c";

  // Char rendering
  const chars = prompt.split("").map((ch, i) => {
    let color = "#3a5548";
    let bg = "transparent";
    if (i < typed.length) {
      color = typed[i] === ch ? "#00d18c" : "#f87171";
      bg    = typed[i] === ch ? "transparent" : "rgba(248,113,113,0.12)";
    }
    return { ch, color, bg, isCursor: i === typed.length };
  });

  const wrongCount = typed.split("").filter((c, i) => c !== prompt[i]).length;
  const progress = prompt.length > 0 ? (typed.length / prompt.length) * 100 : 0;

  return (
    <div style={{ height:"100vh", background:"#0e1210", color:"#e8f0ed", fontFamily:"'Segoe UI',system-ui,sans-serif", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* ── TOP BAR ── */}
      <div style={{ background:"#0a0f0d", borderBottom:"1px solid #1a2e24", padding:"0 20px", height:54, display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>

        <button onClick={onBack}
          style={{ background:"#1a1f1d", border:"1px solid #1f2e28", color:"#7a9e8e", borderRadius:8, padding:"5px 14px", cursor:"pointer", fontSize:13 }}>← Apps</button>

        <span style={{ fontSize:16, fontWeight:800 }}>⌨️ Typing</span>

        {/* Mode buttons */}
        <div style={{ display:"flex", gap:6 }}>
          {MODES.map(m => (
            <button key={m.key} onClick={() => switchMode(m.key)}
              style={{ background: mode===m.key ? "rgba(0,209,140,0.15)" : "transparent", border:`1px solid ${mode===m.key?"#00d18c":"#1f2e28"}`, color: mode===m.key ? "#00d18c" : "#7a9e8e", borderRadius:8, padding:"4px 12px", cursor:"pointer", fontSize:12, fontWeight:700, transition:"all 0.15s" }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        <div style={{ flex:1 }} />

        {/* Stats */}
        {[
          { label:"WPM",  val: started ? wpm : "--",       color: wpm>=80?"#00d18c": wpm>=50?"#f7a94e":"#e8f0ed" },
          { label:"ACC",  val: started ? acc+"%" : "--",   color: acc>=95?"#00d18c": acc>=80?"#f7a94e":"#f87171" },
          { label:"BEST", val: bestWpm>0 ? bestWpm : "--", color:"#7a9e8e" },
        ].map(s => (
          <div key={s.label} style={{ background:"#1a1f1d", border:"1px solid #1f2e28", borderRadius:10, padding:"4px 14px", textAlign:"center", minWidth:62 }}>
            <div style={{ fontSize:17, fontWeight:800, color:s.color, fontVariantNumeric:"tabular-nums" }}>{s.val}</div>
            <div style={{ fontSize:10, color:"#4a7060", textTransform:"uppercase", letterSpacing:"0.5px" }}>{s.label}</div>
          </div>
        ))}

        {/* Countdown timer */}
        <div style={{ display:"flex", alignItems:"center", gap:8, background:"#141a17", border:`1px solid ${timerRunning ? timerColor+"55" : "#1f2e28"}`, borderRadius:12, padding:"5px 14px", marginLeft:4 }}>
          <span style={{ fontSize:20, fontWeight:800, fontVariantNumeric:"tabular-nums", color: timerRunning ? timerColor : "#4a6055", minWidth:54, textAlign:"center", letterSpacing:"1px" }}>
            {timerDisplay}
          </span>
          <button onClick={() => setTimerRunning(r => !r)}
            style={{ background: timerRunning ? "rgba(247,78,78,0.15)" : "rgba(0,209,140,0.12)", border:`1px solid ${timerRunning?"#f74e4e":"#00d18c"}`, borderRadius:6, padding:"2px 10px", cursor:"pointer", fontSize:12, fontWeight:700, color: timerRunning?"#f74e4e":"#00d18c" }}>
            {timerRunning ? "⏸" : "▶"}
          </button>
          <button onClick={() => resetAll()}
            title="Reset"
            style={{ background:"none", border:"none", cursor:"pointer", color:"#2a4a38", fontSize:14, padding:"2px 4px", display:"flex", alignItems:"center" }}
            onMouseEnter={e=>e.currentTarget.style.color="#7a9e8e"}
            onMouseLeave={e=>e.currentTarget.style.color="#2a4a38"}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
            </svg>
          </button>
        </div>

        <span style={{ fontSize:11, color:"#2a4a38" }}>Esc · Tab = reset</span>
      </div>

      {/* ── DUAL PROGRESS BARS ── */}
      {/* Typing progress */}
      <div style={{ height:3, background:"#1a2e24", flexShrink:0 }}>
        <div style={{ height:"100%", width:`${progress}%`, background: finished ? "#00d18c" : "#4e8ef7", transition:"width 0.1s", borderRadius:"0 2px 2px 0" }} />
      </div>
      {/* Timer progress */}
      <div style={{ height:3, background:"#1a2e24", flexShrink:0 }}>
        <div style={{ height:"100%", width:`${timerPct}%`, background: timerColor, transition:"width 1s linear", borderRadius:"0 2px 2px 0" }} />
      </div>

      {/* ── TYPING AREA ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"32px 48px", gap:24 }}
        onClick={() => inputRef.current?.focus()}>

        {/* Prompt box */}
        <div style={{
          width:"100%", maxWidth:800,
          background:"#141a17",
          border:`1px solid ${finished ? "#00d18c" : "#1f2e28"}`,
          borderRadius:16,
          padding:"28px 36px",
          fontSize:22,
          lineHeight:1.9,
          letterSpacing:"0.3px",
          position:"relative",
          cursor:"text",
          transition:"border-color 0.3s",
          // KEY FIX: wrap text, center it
          textAlign:"center",
          wordBreak:"break-word",
          overflowWrap:"break-word",
          whiteSpace:"normal",
        }}>
          {chars.map((c, i) => (
            <span key={i} style={{ color:c.color, background:c.bg, borderRadius:2, position:"relative", display:"inline" }}>
              {c.isCursor && (
                <span style={{ position:"absolute", left:0, top:"10%", width:2, height:"80%", background:"#00d18c", borderRadius:1, animation:"blink 1s step-end infinite" }} />
              )}
              {c.ch === " " ? "\u00A0" : c.ch}
            </span>
          ))}

          {/* Finished overlay */}
          {finished && (
            <div style={{ position:"absolute", inset:0, background:"rgba(14,18,16,0.93)", borderRadius:16, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, zIndex:5 }}>
              <div style={{ fontSize:28 }}>{timerRemaining===0 ? "⏱" : "✓"}</div>
              <div style={{ fontSize:24, fontWeight:800, color:"#00d18c" }}>{wpm} WPM</div>
              <div style={{ fontSize:14, color:"#7a9e8e" }}>{acc}% accuracy · {wrongCount} error{wrongCount!==1?"s":""}</div>
              {wpm===bestWpm && wpm>0 && <div style={{ fontSize:12, color:"#f7a94e", marginTop:4 }}>🏆 New personal best!</div>}
              {timerRemaining > 0 && (
                <button onClick={() => resetAllKeepTimer(mode)}
                  style={{ marginTop:12, background:"#00d18c", border:"none", color:"#003d2a", borderRadius:10, padding:"8px 24px", cursor:"pointer", fontSize:14, fontWeight:800 }}>
                  Next →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Hidden real input */}
        <input
          ref={inputRef}
          value={typed}
          onChange={handleInput}
          style={{ position:"absolute", opacity:0, pointerEvents:"none", width:1, height:1 }}
          autoComplete="off" autoCorrect="off" spellCheck={false}
        />

        <div style={{ fontSize:12, color:"#2a4a38", display:"flex", gap:20 }}>
          <span style={{ color:"#1a4a38" }}>🟢 correct</span>
          <span style={{ color:"#4a1a1a" }}>🔴 wrong</span>
          <span>· Timer starts on first keypress</span>
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%,100% { opacity:1; }
          50%      { opacity:0; }
        }
      `}</style>
    </div>
  );
}
