import { useState, useEffect, useRef, useCallback } from "react";

// ── Word bank ─────────────────────────────────────────────────────────────────
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

const CODE = [
  "const sum = (a, b) => a + b;",
  "function greet(name) { return `Hello, ${name}!`; }",
  "const arr = [1, 2, 3].map(x => x * 2);",
  "if (isValid && count > 0) { process(data); }",
  "export default function App() { return <div>Hello</div>; }",
  "const [state, setState] = useState(null);",
  "fetch('/api/data').then(res => res.json()).then(setData);",
  "for (let i = 0; i < items.length; i++) { console.log(items[i]); }",
  "const obj = { name: 'Alice', age: 30, active: true };",
  "useEffect(() => { document.title = 'Page'; }, []);",
];

const MODES = [
  { key: "words",     label: "Words",     icon: "📝" },
  { key: "hard",      label: "Hard Words", icon: "💀" },
  { key: "sentences", label: "Sentences", icon: "📖" },
  { key: "code",      label: "Code",      icon: "💻" },
];

function getPrompt(mode) {
  if (mode === "words") {
    const pool = [...WORDS_EASY].sort(() => Math.random() - 0.5).slice(0, 20);
    return pool.join(" ");
  }
  if (mode === "hard") {
    const pool = [...WORDS_HARD].sort(() => Math.random() - 0.5).slice(0, 12);
    return pool.join(" ");
  }
  if (mode === "sentences") return SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
  if (mode === "code") return CODE[Math.floor(Math.random() * CODE.length)];
  return "";
}

export default function TypingApp({ onBack }) {
  const [mode, setMode] = useState("words");
  const [prompt, setPrompt] = useState(() => getPrompt("words"));
  const [typed, setTyped] = useState("");
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [wpm, setWpm] = useState(0);
  const [acc, setAcc] = useState(100);
  const [bestWpm, setBestWpm] = useState(() => parseInt(localStorage.getItem("typing_best_wpm") || "0"));
  const inputRef = useRef(null);
  const intervalRef = useRef(null);

  // Focus input on mount + mode change
  useEffect(() => { inputRef.current?.focus(); }, [prompt]);

  // Live WPM update
  useEffect(() => {
    if (started && !finished && startTime) {
      intervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 60000;
        const words = typed.length / 5;
        setWpm(elapsed > 0 ? Math.round(words / elapsed) : 0);
      }, 300);
    }
    return () => clearInterval(intervalRef.current);
  }, [started, finished, startTime, typed]);

  function newPrompt(m = mode) {
    setPrompt(getPrompt(m));
    setTyped("");
    setStarted(false);
    setFinished(false);
    setStartTime(null);
    setWpm(0);
    setAcc(100);
    clearInterval(intervalRef.current);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function switchMode(m) {
    setMode(m);
    newPrompt(m);
  }

  function handleInput(e) {
    if (finished) return;
    const val = e.target.value;

    if (!started && val.length > 0) {
      setStarted(true);
      setStartTime(Date.now());
    }

    // Don't allow typing past prompt length
    if (val.length > prompt.length) return;

    setTyped(val);

    // Accuracy
    let wrong = 0;
    for (let i = 0; i < val.length; i++) {
      if (val[i] !== prompt[i]) wrong++;
    }
    const accuracy = val.length > 0 ? Math.round(((val.length - wrong) / val.length) * 100) : 100;
    setAcc(accuracy);

    // Finished
    if (val === prompt) {
      clearInterval(intervalRef.current);
      const elapsed = (Date.now() - startTime) / 60000;
      const finalWpm = Math.round((prompt.length / 5) / elapsed);
      setWpm(finalWpm);
      setFinished(true);
      if (finalWpm > bestWpm) {
        setBestWpm(finalWpm);
        localStorage.setItem("typing_best_wpm", String(finalWpm));
      }
    }
  }

  // Keyboard: Escape = reset, Tab = new prompt
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") { e.preventDefault(); newPrompt(); }
      if (e.key === "Tab") { e.preventDefault(); newPrompt(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode]);

  // Render chars
  const chars = prompt.split("").map((ch, i) => {
    let color = "#4a6055"; // pending
    let bg = "transparent";
    if (i < typed.length) {
      if (typed[i] === ch) { color = "#00d18c"; }
      else { color = "#f87171"; bg = "rgba(248,113,113,0.15)"; }
    }
    const isCursor = i === typed.length;
    return { ch, color, bg, isCursor };
  });

  const wrongCount = typed.split("").filter((c, i) => c !== prompt[i]).length;
  const progress = prompt.length > 0 ? (typed.length / prompt.length) * 100 : 0;

  return (
    <div style={{ height:"100vh", background:"#0e1210", color:"#e8f0ed", fontFamily:"'Segoe UI',system-ui,sans-serif", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* ── TOP BAR ── */}
      <div style={{ background:"#0a0f0d", borderBottom:"1px solid #1a2e24", padding:"0 20px", height:52, display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>
        <button onClick={onBack}
          style={{ background:"#1a1f1d", border:"1px solid #1f2e28", color:"#7a9e8e", borderRadius:8, padding:"5px 14px", cursor:"pointer", fontSize:13 }}>← Apps</button>
        <span style={{ fontSize:16, fontWeight:800, letterSpacing:"0.5px" }}>⌨️ Typing</span>

        {/* Mode selector */}
        <div style={{ display:"flex", gap:6, marginLeft:8 }}>
          {MODES.map(m => (
            <button key={m.key} onClick={() => switchMode(m.key)}
              style={{ background: mode===m.key ? "rgba(0,209,140,0.15)" : "transparent", border: `1px solid ${mode===m.key ? "#00d18c" : "#1f2e28"}`, color: mode===m.key ? "#00d18c" : "#7a9e8e", borderRadius:8, padding:"4px 12px", cursor:"pointer", fontSize:12, fontWeight:700, transition:"all 0.15s" }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        <div style={{ flex:1 }} />

        {/* Stats pills */}
        {[
          { label:"WPM", val: started ? wpm : "--", color: wpm>=80?"#00d18c": wpm>=50?"#f7a94e":"#e8f0ed" },
          { label:"ACC", val: started ? acc+"%" : "--", color: acc>=95?"#00d18c": acc>=80?"#f7a94e":"#f87171" },
          { label:"BEST", val: bestWpm>0 ? bestWpm : "--", color:"#7a9e8e" },
        ].map(s => (
          <div key={s.label} style={{ background:"#1a1f1d", border:"1px solid #1f2e28", borderRadius:10, padding:"4px 14px", textAlign:"center", minWidth:64 }}>
            <div style={{ fontSize:18, fontWeight:800, color:s.color, fontVariantNumeric:"tabular-nums" }}>{s.val}</div>
            <div style={{ fontSize:10, color:"#4a7060", textTransform:"uppercase", letterSpacing:"0.5px" }}>{s.label}</div>
          </div>
        ))}

        <div style={{ fontSize:11, color:"#2a4a38", marginLeft:8 }}>Esc / Tab = reset</div>
      </div>

      {/* ── PROGRESS BAR ── */}
      <div style={{ height:3, background:"#1a2e24", flexShrink:0 }}>
        <div style={{ height:"100%", width:`${progress}%`, background: finished?"#00d18c":"#4e8ef7", transition:"width 0.1s", borderRadius:"0 2px 2px 0" }} />
      </div>

      {/* ── TYPING AREA ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"32px 48px", gap:28 }}
        onClick={() => inputRef.current?.focus()}>

        {/* Prompt text box */}
        <div style={{ width:"100%", maxWidth:860, background:"#141a17", border:`1px solid ${finished?"#00d18c":"#1f2e28"}`, borderRadius:16, padding:"28px 32px", lineHeight:1.9, fontSize:20, fontFamily:"'Cascadia Code','Fira Code','Consolas',monospace", letterSpacing:"0.3px", position:"relative", cursor:"text", transition:"border-color 0.3s" }}>
          {chars.map((c, i) => (
            <span key={i} style={{ color:c.color, background:c.bg, borderRadius:2, position:"relative" }}>
              {c.isCursor && (
                <span style={{ position:"absolute", left:0, top:"10%", width:2, height:"80%", background:"#00d18c", borderRadius:1, animation:"blink 1s step-end infinite" }} />
              )}
              {c.ch === " " ? "\u00A0" : c.ch}
            </span>
          ))}

          {/* Finished overlay */}
          {finished && (
            <div style={{ position:"absolute", inset:0, background:"rgba(14,18,16,0.92)", borderRadius:16, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}>
              <div style={{ fontSize:32 }}>✓</div>
              <div style={{ fontSize:22, fontWeight:800, color:"#00d18c" }}>{wpm} WPM</div>
              <div style={{ fontSize:14, color:"#7a9e8e" }}>{acc}% accuracy · {wrongCount} error{wrongCount!==1?"s":""}</div>
              {wpm === bestWpm && wpm > 0 && <div style={{ fontSize:12, color:"#f7a94e", marginTop:4 }}>🏆 New personal best!</div>}
              <button onClick={() => newPrompt()}
                style={{ marginTop:12, background:"#00d18c", border:"none", color:"#003d2a", borderRadius:10, padding:"8px 24px", cursor:"pointer", fontSize:14, fontWeight:800 }}>
                Next ↵
              </button>
            </div>
          )}
        </div>

        {/* Hidden input */}
        <input
          ref={inputRef}
          value={typed}
          onChange={handleInput}
          style={{ position:"absolute", opacity:0, pointerEvents:"none", width:1, height:1 }}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {/* Bottom hint */}
        <div style={{ fontSize:12, color:"#2a4a38", display:"flex", gap:20 }}>
          <span>🟢 correct</span>
          <span style={{ color:"#5a3a3a" }}>🔴 wrong</span>
          <span>· Start typing to begin</span>
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
