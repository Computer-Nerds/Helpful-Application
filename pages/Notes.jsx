import { useState, useEffect, useRef, useCallback } from "react";
import ChessGame from "./Chess.jsx";

const WEATHER_KEY = "95b942dc3f7006dda16797bd6b501d29";
const CITY = "Oklahoma City";

// ── SVG Icons ──────────────────────────────────────────────
const IconHome = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#fff" : "rgba(255,255,255,0.45)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const IconPlanner = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#fff" : "rgba(255,255,255,0.45)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
);
const IconGrid = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#fff" : "rgba(255,255,255,0.45)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const IconShield = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#fff" : "rgba(255,255,255,0.45)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

// ── Rich Text Editor ───────────────────────────────────────
function RichEditor({ projectId, value, onChange }) {
  const ref = useRef(null);
  const loadedFor = useRef(null);
  const savedSel = useRef(null);

  useEffect(() => {
    if (ref.current && loadedFor.current !== projectId) {
      ref.current.innerHTML = value || "";
      loadedFor.current = projectId;
    }
  }, [projectId, value]);

  const emit = () => { if (ref.current) onChange(ref.current.innerHTML); };

  // ── Selection helpers ──────────────────────────────────
  const saveSel = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedSel.current = sel.getRangeAt(0).cloneRange();
  };

  const restoreSel = () => {
    ref.current.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    if (savedSel.current) sel.addRange(savedSel.current);
  };

  // Walk up from a node to find the nearest block inside the editor
  const nearestBlock = (node) => {
    const BLOCKS = ["P","H1","H2","H3","H4","LI","DIV","BLOCKQUOTE"];
    let n = node;
    if (n && n.nodeType === 3) n = n.parentNode;
    while (n && n !== ref.current) {
      if (BLOCKS.includes(n.nodeName)) return n;
      n = n.parentNode;
    }
    return null;
  };

  // Get all block nodes touched by current saved selection
  const getTouchedBlocks = () => {
    if (!savedSel.current) return [];
    const range = savedSel.current;
    const BLOCKS = ["P","H1","H2","H3","H4","LI","DIV","BLOCKQUOTE"];
    const found = [];
    // Walk every element in the editor
    const all = ref.current.querySelectorAll("*");
    all.forEach(el => {
      if (BLOCKS.includes(el.nodeName) && range.intersectsNode(el)) {
        // Make sure it's the deepest block (not a parent of another block)
        const hasBlockChild = [...el.children].some(c => BLOCKS.includes(c.nodeName));
        if (!hasBlockChild) found.push(el);
      }
    });
    // Fallback: just the anchor block
    if (found.length === 0) {
      const b = nearestBlock(range.commonAncestorContainer);
      if (b) found.push(b);
    }
    return found;
  };

  // ── Commands ───────────────────────────────────────────
  const execCmd = (cmd, arg = null) => {
    restoreSel();
    document.execCommand(cmd, false, arg);
    setTimeout(emit, 0);
  };

  const setBlockTag = (tag) => {
    restoreSel();
    const block = nearestBlock(window.getSelection().getRangeAt(0).commonAncestorContainer);
    if (block) {
      const el = document.createElement(tag);
      el.innerHTML = block.innerHTML;
      if (block.style.textAlign) el.style.textAlign = block.style.textAlign;
      block.replaceWith(el);
      // restore cursor inside new el
      const sel = window.getSelection();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
      savedSel.current = r.cloneRange();
    } else {
      document.execCommand("formatBlock", false, "<" + tag + ">");
    }
    setTimeout(emit, 0);
  };

  const setAlign = (align) => {
    // Use saved selection — don't call restoreSel so we don't move focus yet
    const blocks = getTouchedBlocks();
    blocks.forEach(b => { b.style.textAlign = align; });
    // Also handle bare text nodes directly in editor (wrap in p first)
    if (blocks.length === 0 && savedSel.current) {
      restoreSel();
      document.execCommand("formatBlock", false, "<p>");
      const b = nearestBlock(window.getSelection().getRangeAt(0).commonAncestorContainer);
      if (b) b.style.textAlign = align;
    }
    setTimeout(emit, 0);
  };

  const setFontSize = (px) => {
    restoreSel();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const span = document.createElement("span");
    span.style.fontSize = px;
    try {
      range.surroundContents(span);
    } catch {
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
    savedSel.current = null; // reset after font size applied
    setTimeout(emit, 0);
  };

  const ToolBtn = ({ label, title, onMD }) => (
    <button
      title={title || label}
      onMouseDown={e => { e.preventDefault(); onMD(); }}
      style={{ background:"none", border:"none", color:"#a0c9b8", cursor:"pointer", padding:"4px 8px", borderRadius:4, fontSize:13, fontWeight:600, minWidth:28 }}
    >{label}</button>
  );
  const Divider = () => <div style={{ width:1, height:18, background:"#1f2e28", margin:"0 4px" }} />;
  const fontSizes = ["10px","12px","14px","16px","18px","24px","32px","48px"];

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0 }}>
      <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:2, padding:"6px 12px", background:"#141917", borderBottom:"1px solid #1f2e28", flexShrink:0 }}>
        <ToolBtn label="B"   title="Bold"          onMD={() => execCmd("bold")} />
        <ToolBtn label="I"   title="Italic"         onMD={() => execCmd("italic")} />
        <ToolBtn label="U"   title="Underline"      onMD={() => execCmd("underline")} />
        <ToolBtn label="S̶"   title="Strikethrough"  onMD={() => execCmd("strikeThrough")} />
        <Divider />
        <ToolBtn label="H1"  title="Heading 1"      onMD={() => setBlockTag("h1")} />
        <ToolBtn label="H2"  title="Heading 2"      onMD={() => setBlockTag("h2")} />
        <ToolBtn label="H3"  title="Heading 3"      onMD={() => setBlockTag("h3")} />
        <ToolBtn label="¶"   title="Normal text"    onMD={() => setBlockTag("p")} />
        <Divider />
        <select
          defaultValue=""
          onMouseDown={() => saveSel()}
          onChange={e => { setFontSize(e.target.value); e.target.value = ""; }}
          style={{ background:"#1a1f1d", border:"1px solid #1f2e28", color:"#a0c9b8", borderRadius:4, fontSize:12, padding:"3px 6px", cursor:"pointer", outline:"none" }}
        >
          <option value="" disabled>Size</option>
          {fontSizes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <Divider />
        <ToolBtn label="•"   title="Bullet list"    onMD={() => execCmd("insertUnorderedList")} />
        <ToolBtn label="1."  title="Numbered list"  onMD={() => execCmd("insertOrderedList")} />
        <Divider />
        <ToolBtn label="⬅"  title="Align left"     onMD={() => setAlign("left")} />
        <ToolBtn label="⬛"  title="Align center"   onMD={() => setAlign("center")} />
        <ToolBtn label="➡"  title="Align right"    onMD={() => setAlign("right")} />
        <Divider />
        <ToolBtn label="—"   title="Horizontal rule" onMD={() => execCmd("insertHorizontalRule")} />
      </div>
      <style>{`
        .rich-editor ul { list-style-type: disc !important; padding-left: 28px !important; margin: 4px 0 !important; }
        .rich-editor ol { list-style-type: decimal !important; padding-left: 28px !important; margin: 4px 0 !important; }
        .rich-editor li { display: list-item !important; margin: 2px 0 !important; }
        .rich-editor h1 { font-size: 2em !important; font-weight: 800 !important; margin: 8px 0 4px !important; color: #e8f0ed !important; }
        .rich-editor h2 { font-size: 1.5em !important; font-weight: 700 !important; margin: 8px 0 4px !important; color: #e8f0ed !important; }
        .rich-editor h3 { font-size: 1.2em !important; font-weight: 700 !important; margin: 6px 0 4px !important; color: #e8f0ed !important; }
        .rich-editor p  { margin: 4px 0 !important; }
        .rich-editor hr { border: none !important; border-top: 1px solid #1f2e28 !important; margin: 12px 0 !important; }
      `}</style>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="rich-editor"
        onMouseUp={saveSel}
        onKeyUp={saveSel}
        onSelect={saveSel}
        onInput={() => { if (ref.current) onChange(ref.current.innerHTML); }}
        style={{ flex:1, padding:"20px 28px", outline:"none", overflowY:"auto", fontSize:14, lineHeight:1.8, color:"#e8f0ed", caretColor:"#00d18c" }}
      />
    </div>
  );
}

// ── Calendar ───────────────────────────────────────────────
function CalendarView({ events, setEvents }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ title: "", time: "", color: "#00d18c" });

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const monthName = new Date(viewYear, viewMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const dateKey = (d) => `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const eventsForDate = (d) => events.filter(e => e.date === dateKey(d));
  const isToday = (d) => d === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();

  const saveEvent = () => {
    if (!form.title.trim()) return;
    setEvents(prev => [...prev, { id: Date.now(), date: modal.date, title: form.title.trim(), time: form.time, color: form.color }]);
    setModal(null);
  };

  const colors = ["#00d18c","#4e8ef7","#f7a94e","#f74e4e","#c44ef7","#4ef7e8"];
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i+7));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexShrink: 0 }}>
        <button onClick={() => { if (viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1); }}
          style={{ background: "#1a1f1d", border: "1px solid #1f2e28", color: "#e8f0ed", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 16 }}>‹</button>
        <span style={{ fontSize: 18, fontWeight: 700, flex: 1, textAlign: "center" }}>{monthName}</span>
        <button onClick={() => { if (viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1); }}
          style={{ background: "#1a1f1d", border: "1px solid #1f2e28", color: "#e8f0ed", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 16 }}>›</button>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4, flexShrink: 0 }}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, color: "#7a9e8e", fontWeight: 700, padding: "4px 0" }}>{d}</div>
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minHeight: 0 }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, flex: 1 }}>
              {week.map((d, di) => {
                if (!d) return <div key={di} style={{ background: "#0e1512", borderRadius: 8 }} />;
                const dayEvs = eventsForDate(d);
                return (
                  <div key={d} onClick={() => { setForm({ title:"", time:"", color:"#00d18c" }); setModal({ date: dateKey(d) }); }}
                    style={{ background: isToday(d) ? "rgba(0,209,140,0.1)" : "#1a1f1d", border: isToday(d) ? "1px solid #00d18c" : "1px solid #1f2e28", borderRadius: 8, padding: "8px 10px", cursor: "pointer", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div style={{ fontSize: 13, fontWeight: isToday(d)?800:500, color: isToday(d)?"#00d18c":"#e8f0ed", marginBottom: 4, flexShrink: 0 }}>{d}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, overflowY: "auto", flex: 1 }}>
                      {dayEvs.map(ev => (
                        <div key={ev.id} onClick={e => e.stopPropagation()}
                          style={{ display: "flex", alignItems: "center", gap: 4, background: ev.color+"25", borderRadius: 4, padding: "2px 6px" }}>
                          <span style={{ fontSize: 10, color: ev.color, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ev.time ? `${ev.time} ` : ""}{ev.title}
                          </span>
                          <button onClick={e => { e.stopPropagation(); setEvents(prev => prev.filter(x => x.id !== ev.id)); }}
                            style={{ background: "none", border: "none", color: ev.color, cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1, flexShrink: 0, opacity: 0.8 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#1a1f1d", border: "1px solid #1f2e28", borderRadius: 14, padding: 28, minWidth: 320, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Add Event — {modal.date}</div>
            <input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))}
              placeholder="Event title" autoFocus onKeyDown={e => e.key==="Enter" && saveEvent()}
              style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #1f2e28", background: "#111312", color: "#e8f0ed", fontSize: 14, outline: "none" }} />
            <input value={form.time} onChange={e => setForm(f=>({...f,time:e.target.value}))}
              placeholder="Time (e.g. 3:00 PM)"
              style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #1f2e28", background: "#111312", color: "#e8f0ed", fontSize: 14, outline: "none" }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#7a9e8e" }}>Color:</span>
              {colors.map(c => (
                <div key={c} onClick={() => setForm(f=>({...f,color:c}))}
                  style={{ width: 20, height: 20, borderRadius: "50%", background: c, cursor: "pointer", border: form.color===c?"2px solid #fff":"2px solid transparent" }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(null)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #1f2e28", background: "none", color: "#7a9e8e", cursor: "pointer" }}>Cancel</button>
              <button onClick={saveEvent} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#00d18c", color: "#003d2a", fontWeight: 700, cursor: "pointer" }}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Project View ───────────────────────────────────────────
function ProjectView({ project, onUpdate }) {
  const [tab, setTab] = useState("notes");
  const [taskInput, setTaskInput] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  const getHealth = (p) => {
    const total = p.tasks?.length || 0;
    if (total === 0) return { label: "Pending", color: "#7a9e8e", bg: "rgba(122,158,142,0.15)" };
    const done = p.tasks.filter(t => t.done).length;
    if (done === total) return { label: "Finished", color: "#00d18c", bg: "rgba(0,209,140,0.15)" };
    if (done > 0) return { label: "In Progress", color: "#f7a94e", bg: "rgba(247,169,78,0.15)" };
    return { label: "Pending", color: "#7a9e8e", bg: "rgba(122,158,142,0.15)" };
  };

  const h = getHealth(project);
  const total = project.tasks?.length || 0;
  const done = project.tasks?.filter(t => t.done).length || 0;
  const donePct = total ? Math.round((done / total) * 100) : 0;

  const addTask = () => {
    if (!taskInput.trim()) return;
    onUpdate({ ...project, tasks: [...(project.tasks || []), { id: Date.now(), text: taskInput.trim(), done: false }] });
    setTaskInput("");
  };
  const toggleTask = (id) => onUpdate({ ...project, tasks: project.tasks.map(t => t.id===id ? {...t, done: !t.done} : t) });
  const removeTask = (id) => onUpdate({ ...project, tasks: project.tasks.filter(t => t.id !== id) });

  const startEdit = (task) => { setEditingId(task.id); setEditText(task.text); };
  const saveEdit = (id) => {
    if (!editText.trim()) return;
    onUpdate({ ...project, tasks: project.tasks.map(t => t.id===id ? {...t, text: editText.trim()} : t) });
    setEditingId(null); setEditText("");
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: "18px 28px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{project.name}</div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: h.bg, color: h.color }}>{h.label}</span>
          {total > 0 && <span style={{ fontSize: 11, color: "#7a9e8e", marginLeft: "auto" }}>{donePct}% complete</span>}
        </div>
        {total > 0 && (
          <div style={{ height: 4, background: "#1f2e28", borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${donePct}%`, background: h.color, borderRadius: 2, transition: "width 0.3s" }} />
          </div>
        )}
        <div style={{ display: "flex", borderBottom: "1px solid #1f2e28" }}>
          {["notes","tasks"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "8px 20px", background: "none", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, textTransform: "capitalize",
              color: tab===t ? "#00d18c" : "#7a9e8e",
              borderBottom: tab===t ? "2px solid #00d18c" : "2px solid transparent", marginBottom: -1,
            }}>{t}</button>
          ))}
        </div>
      </div>

      {tab === "notes" && <RichEditor projectId={project.id} value={project.notes||""} onChange={html => onUpdate({...project, notes: html})} />}

      {tab === "tasks" && (
        <div style={{ flex: 1, padding: "20px 28px", overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input value={taskInput} onChange={e => setTaskInput(e.target.value)}
              onKeyDown={e => e.key==="Enter" && addTask()} placeholder="Add a task…"
              style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #1f2e28", background: "#141917", color: "#e8f0ed", fontSize: 14, outline: "none" }} />
            <button onClick={addTask} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "#00d18c", color: "#003d2a", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Add</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(!project.tasks || project.tasks.length === 0) && <div style={{ color: "#7a9e8e", fontSize: 14 }}>No tasks yet.</div>}
            {(project.tasks||[]).map(task => (
              <div key={task.id} style={{ background: "#1a1f1d", border: "1px solid #1f2e28", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)}
                  style={{ width: 17, height: 17, accentColor: "#00d18c", cursor: "pointer", flexShrink: 0 }} />

                {editingId === task.id ? (
                  <input
                    autoFocus
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key==="Enter") saveEdit(task.id); if (e.key==="Escape") setEditingId(null); }}
                    onBlur={() => saveEdit(task.id)}
                    style={{ flex: 1, background: "#111312", border: "1px solid #00d18c", borderRadius: 6, padding: "4px 8px", color: "#e8f0ed", fontSize: 14, outline: "none" }}
                  />
                ) : (
                  <span
                    onClick={() => startEdit(task)}
                    title="Click to edit"
                    style={{ flex: 1, fontSize: 14, color: task.done?"#7a9e8e":"#e8f0ed", textDecoration: task.done?"line-through":"none", cursor: "text" }}>
                    {task.text}
                  </span>
                )}

                <button onClick={() => removeTask(task.id)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 18, flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Today Calendar Card ────────────────────────────────────
function TodayCalendarCard({ events, onNavigate }) {
  const now = new Date();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const monthName = now.toLocaleDateString("en-US", { month: "long" });
  const todayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const todayEvents = events.filter(e => e.date === todayKey);

  return (
    <div onClick={onNavigate}
      style={{ background: "#1a1f1d", border: "1px solid #1f2e28", borderRadius: 14, padding: 20, cursor: "pointer", minWidth: 220, maxWidth: 280 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, color: "#7a9e8e", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, marginBottom: 2 }}>Today</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#e8f0ed", lineHeight: 1 }}>{now.getDate()}</div>
          <div style={{ fontSize: 12, color: "#7a9e8e", marginTop: 3 }}>{dayName}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, color: "#a0c9b8", fontWeight: 600 }}>{monthName}</div>
          <div style={{ fontSize: 11, color: "#4a7060" }}>{now.getFullYear()}</div>
        </div>
      </div>
      <div style={{ height: 1, background: "#1f2e28", marginBottom: 12 }} />
      {todayEvents.length === 0 ? (
        <div style={{ fontSize: 12, color: "#4a7060", fontStyle: "italic" }}>No events today</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {todayEvents.map(ev => (
            <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 3, height: 3, borderRadius: "50%", background: ev.color, flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, color: "#e8f0ed" }}>{ev.title}</span>
                {ev.time && <span style={{ fontSize: 11, color: "#7a9e8e", marginLeft: 6 }}>{ev.time}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 12, fontSize: 10, color: "#2a4a3a" }}>Click to open calendar →</div>
    </div>
  );
}

// ── Chess Embed Wrapper ───────────────────────────────────────
function ChessEmbed({ onTimeUpdate, onBack }) {
  return <ChessGame onTimeUpdate={onTimeUpdate} onBack={onBack} />;
}

// ── Main Dashboard ─────────────────────────────────────────
export default function Dashboard() {
  const [page, setPage] = useState("home");
  const [subPage, setSubPage] = useState(null);
  const [chessSeconds, setChessSeconds] = useState(() => parseInt(localStorage.getItem('chessTimer')||'0'));
  const [plannerSection, setPlannerSection] = useState("projects");
  const [time, setTime] = useState("");
  const [greeting, setGreeting] = useState("");
  const [forecast, setForecast] = useState([]);
  const [todayWeather, setTodayWeather] = useState(null);
  const [bottomDate, setBottomDate] = useState("");

  const [projects, setProjects] = useState(() => JSON.parse(localStorage.getItem("projects") || "[]"));
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [calEvents, setCalEvents] = useState(() => JSON.parse(localStorage.getItem("calEvents") || "[]"));

  useEffect(() => { localStorage.setItem("projects", JSON.stringify(projects)); }, [projects]);
  useEffect(() => { localStorage.setItem('chessTimer', String(chessSeconds)); }, [chessSeconds]);
  useEffect(() => { localStorage.setItem("calEvents", JSON.stringify(calEvents)); }, [calEvents]);

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const hr12 = n.getHours() % 12 || 12;
      const ampm = n.getHours() < 12 ? "AM" : "PM";
      setTime(`${hr12}:${String(n.getMinutes()).padStart(2,"0")} ${ampm}`);
      setBottomDate(n.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));
      const hr = n.getHours();
      setGreeting(hr < 12 ? "Good morning 👋" : hr < 17 ? "Good afternoon 👋" : "Good evening 👋");
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const c = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(CITY)}&appid=${WEATHER_KEY}&units=imperial`);
        const cd = await c.json();
        setTodayWeather({ temp: Math.round(cd.main.temp), high: Math.round(cd.main.temp_max), low: Math.round(cd.main.temp_min), icon: cd.weather[0].id });
        const f = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(CITY)}&appid=${WEATHER_KEY}&units=imperial`);
        const fd = await f.json();
        const days = {};
        fd.list.forEach(item => {
          const d = new Date(item.dt * 1000);
          const key = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          if (!days[key]) days[key] = { dayName: d.toLocaleDateString("en-US",{weekday:"short"}), temps: [], conditions: [] };
          days[key].temps.push(item.main.temp);
          days[key].conditions.push({ id: item.weather[0].id });
        });
        const todayKey = new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
        setForecast(Object.entries(days).filter(([k])=>k!==todayKey).slice(0,5).map(([_,v])=>{
          const freq={};
          v.conditions.forEach(c=>{if(!freq[c.id])freq[c.id]={count:0,id:c.id};freq[c.id].count++;});
          const dom=Object.values(freq).sort((a,b)=>b.count-a.count)[0];
          return {day:v.dayName,low:Math.round(Math.min(...v.temps)),high:Math.round(Math.max(...v.temps)),icon:dom.id};
        }));
      } catch(e){console.error(e);}
    }
    fetchWeather(); const id=setInterval(fetchWeather,600000); return ()=>clearInterval(id);
  }, []);

  const getWeatherEmoji = (id) => {
    if(!id)return"🌡️";
    if(id>=200&&id<300)return"⛈️";if(id>=300&&id<400)return"🌦️";
    if(id>=500&&id<600)return"🌧️";if(id>=600&&id<700)return"❄️";
    if(id>=700&&id<800)return"🌫️";if(id===800)return"☀️";
    if(id===801)return"🌤️";if(id===802)return"⛅";
    if(id===803)return"🌥️";if(id>=804)return"☁️";return"🌡️";
  };
  const getWeatherLabel = (id) => {
    if(!id)return"";
    if(id>=200&&id<300)return"Thunderstorm";if(id>=300&&id<400)return"Drizzle";
    if(id>=500&&id<600)return"Rain";if(id>=600&&id<700)return"Snow";
    if(id>=700&&id<800)return"Foggy";if(id===800)return"Sunny";
    if(id===801)return"Mostly Sunny";if(id===802)return"Partly Cloudy";
    if(id===803)return"Mostly Cloudy";if(id>=804)return"Overcast";return"";
  };

  const getHealth = (p) => {
    const total = p.tasks?.length || 0;
    if(total===0) return {label:"Pending",color:"#7a9e8e"};
    const done = p.tasks.filter(t=>t.done).length;
    if(done===total) return {label:"Finished",color:"#00d18c"};
    if(done>0) return {label:"In Progress",color:"#f7a94e"};
    return {label:"Pending",color:"#7a9e8e"};
  };

  const createProject = () => {
    if(!newProjectName.trim())return;
    const p={id:Date.now(),name:newProjectName.trim(),notes:"",tasks:[]};
    setProjects(prev=>[...prev,p]);
    setSelectedProjectId(p.id); setPlannerSection("projects");
    setNewProjectName(""); setShowNewProject(false);
  };

  const updateProject = (updated) => setProjects(prev=>prev.map(p=>p.id===updated.id?updated:p));
  const deleteProject = (id) => { setProjects(prev=>prev.filter(p=>p.id!==id)); if(selectedProjectId===id)setSelectedProjectId(null); };
  const currentProject = projects.find(p=>p.id===selectedProjectId);

  const navBtnStyle = (active) => ({
    width: 44, height: 44, borderRadius: 12, border: "none",
    background: active ? "rgba(255,255,255,0.18)" : "transparent",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    borderLeft: active ? "3px solid #fff" : "3px solid transparent", transition: "all 0.15s",
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", fontFamily:"'Segoe UI', system-ui, sans-serif", background:"#111312", color:"#e8f0ed", overflow:"hidden" }}>

      {/* Top Bar */}
      <div style={{ height:54, minHeight:54, background:"#d8ddd9", display:"flex", alignItems:"center", padding:"0 24px", flexShrink:0, borderBottom:"1px solid #b0b8b4" }}>
        <span style={{ fontSize:16, fontWeight:700, color:"#1a2e25", letterSpacing:"0.3px" }}>Helpful App</span>
      </div>

      {/* Body */}
      <div style={{ display:"flex", flex:1, minHeight:0 }}>

        {/* Main Sidebar */}
        <nav style={{ width:64, background:"#005e40", display:"flex", flexDirection:"column", alignItems:"center", padding:"16px 0", gap:4, flexShrink:0 }}>
          <button onClick={()=>setPage("home")} title="Home" style={navBtnStyle(page==="home")}><IconHome active={page==="home"}/></button>
          <button onClick={()=>setPage("planner")} title="Planner" style={navBtnStyle(page==="planner")}><IconPlanner active={page==="planner"}/></button>
          <div style={{ width:36, height:1, background:"rgba(255,255,255,0.12)", margin:"8px 0" }}/>
          <button onClick={()=>setPage("apps")} title="Apps" style={navBtnStyle(page==="apps")}><IconGrid active={page==="apps"}/></button>
          <div style={{flex:1}}/>
          <button onClick={()=>setPage("security")} title="Security" style={navBtnStyle(page==="security")}><IconShield active={page==="security"}/></button>
        </nav>

        {/* Content */}
        <div style={{ flex:1, display:"flex", minHeight:0, overflow:"hidden" }}>

          {/* ── HOME ── */}
          {page==="home" && (
            <div style={{ flex:1, padding:"32px 36px", overflowY:"auto" }}>
              <div style={{ fontSize:26, fontWeight:700, marginBottom:24 }}>{greeting}</div>
              <div style={{ display:"flex", gap:16, flexWrap:"wrap", alignItems:"flex-start" }}>
                <TodayCalendarCard events={calEvents} onNavigate={() => { setPage("planner"); setPlannerSection("calendar"); }} />
                {/* Dailys Card */}
                <div style={{ background:"#1a1f1d", border:"1px solid #1f2e28", borderRadius:14, padding:20, minWidth:200, maxWidth:240 }}>
                  <div style={{ fontSize:12, color:"#7a9e8e", textTransform:"uppercase", letterSpacing:"0.5px", fontWeight:700, marginBottom:14 }}>Dailys</div>
                  {/* Chess progress */}
                  <div style={{ marginBottom:4 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:16 }}>♟️</span>
                        <span style={{ fontSize:13, fontWeight:600 }}>Chess</span>
                      </div>
                      <span style={{ fontSize:11, color: chessSeconds>=1800?"#00d18c":"#7a9e8e" }}>
                        {Math.floor(chessSeconds/60)}m / 30m
                      </span>
                    </div>
                    <div style={{ height:6, background:"#1f2e28", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.min((chessSeconds/1800)*100,100)}%`, background: chessSeconds>=1800?"#00d18c":"#4e8ef7", borderRadius:3, transition:"width 0.5s" }}/>
                    </div>
                    {chessSeconds>=1800 && <div style={{ fontSize:10, color:"#00d18c", marginTop:4 }}>✓ Goal complete!</div>}
                  </div>
                </div>

                {projects.length > 0 && (
                  <div style={{ flex:1, minWidth:240, display:"flex", flexDirection:"column", gap:10 }}>
                    <div style={{ fontSize:12, color:"#7a9e8e", textTransform:"uppercase", letterSpacing:"0.5px", fontWeight:700, marginBottom:4 }}>Projects</div>
                    {projects.map(p => {
                      const h = getHealth(p);
                      const total = p.tasks?.length||0;
                      const done = p.tasks?.filter(t=>t.done).length||0;
                      const pct = total ? Math.round((done/total)*100) : null;
                      return (
                        <div key={p.id} onClick={()=>{setPage("planner");setPlannerSection("projects");setSelectedProjectId(p.id);}}
                          style={{ background:"#1a1f1d", border:"1px solid #1f2e28", borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", gap:14, cursor:"pointer" }}>
                          <div style={{flex:1}}>
                            <div style={{ fontSize:15, fontWeight:600, marginBottom:pct!==null?6:0 }}>{p.name}</div>
                            {pct!==null && (
                              <div style={{ height:3, background:"#1f2e28", borderRadius:2, overflow:"hidden" }}>
                                <div style={{ height:"100%", width:`${pct}%`, background:h.color, borderRadius:2 }}/>
                              </div>
                            )}
                          </div>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2 }}>
                            <span style={{ fontSize:11, fontWeight:700, padding:"2px 10px", borderRadius:20, background:h.color+"25", color:h.color }}>{h.label}</span>
                            {pct!==null && <span style={{ fontSize:11, color:"#4a7060" }}>{pct}%</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {projects.length === 0 && (
                  <div style={{ color:"#4a7060", fontSize:14, alignSelf:"center" }}>No projects yet — head to the Planner to create one!</div>
                )}
              </div>
            </div>
          )}

          {/* ── PLANNER ── */}
          {page==="planner" && (
            <>
              <div style={{ width:220, background:"#0e1512", borderRight:"1px solid #1a2e24", display:"flex", flexDirection:"column", flexShrink:0 }}>
                <button onClick={()=>{setPlannerSection("calendar");setSelectedProjectId(null);}}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 16px", background:plannerSection==="calendar"?"rgba(0,209,140,0.1)":"none", border:"none", borderLeft:plannerSection==="calendar"?"3px solid #00d18c":"3px solid transparent", color:plannerSection==="calendar"?"#00d18c":"#7a9e8e", cursor:"pointer", fontSize:13, fontWeight:600 }}>
                  📅 Calendar
                </button>
                <div style={{ height:1, background:"#1a2e24", margin:"4px 0" }}/>
                <div style={{ padding:"10px 16px 6px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontSize:11, color:"#4a7060", textTransform:"uppercase", letterSpacing:"0.5px", fontWeight:700 }}>Projects</span>
                  <button onClick={()=>setShowNewProject(true)} style={{ background:"none", border:"none", color:"#00d18c", cursor:"pointer", fontSize:20, lineHeight:1, padding:0 }}>+</button>
                </div>
                {showNewProject && (
                  <div style={{ padding:"0 10px 10px" }}>
                    <input autoFocus value={newProjectName} onChange={e=>setNewProjectName(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter")createProject();if(e.key==="Escape"){setShowNewProject(false);setNewProjectName("");}}}
                      placeholder="Project name…"
                      style={{ width:"100%", padding:"7px 10px", borderRadius:8, border:"1px solid #1f2e28", background:"#141917", color:"#e8f0ed", fontSize:13, outline:"none", boxSizing:"border-box" }}/>
                  </div>
                )}
                <div style={{ flex:1, overflowY:"auto" }}>
                  {projects.length===0 && !showNewProject && (
                    <div style={{ padding:"8px 16px", fontSize:12, color:"#4a7060" }}>No projects yet. Hit + to create one.</div>
                  )}
                  {projects.map(p=>{
                    const h=getHealth(p);
                    const total=p.tasks?.length||0;
                    const done=p.tasks?.filter(t=>t.done).length||0;
                    const pct=total?Math.round((done/total)*100):null;
                    const isActive=selectedProjectId===p.id&&plannerSection==="projects";
                    return (
                      <div key={p.id} onClick={()=>{setSelectedProjectId(p.id);setPlannerSection("projects");}}
                        style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px", cursor:"pointer", background:isActive?"rgba(0,209,140,0.1)":"none", borderLeft:isActive?"3px solid #00d18c":"3px solid transparent" }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:h.color, flexShrink:0 }}/>
                        <span style={{ flex:1, fontSize:13, color:isActive?"#e8f0ed":"#a0c9b8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</span>
                        {pct!==null && <span style={{ fontSize:10, color:"#4a7060" }}>{pct}%</span>}
                        <button onClick={e=>{e.stopPropagation();deleteProject(p.id);}}
                          style={{ background:"none", border:"none", color:"#444", cursor:"pointer", fontSize:15, padding:0, flexShrink:0 }}>×</button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0, overflow:"hidden" }}>
                {plannerSection==="calendar" && <CalendarView events={calEvents} setEvents={setCalEvents}/>}
                {plannerSection==="projects" && !currentProject && (
                  <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"#4a7060", gap:12 }}>
                    <span style={{ fontSize:40 }}>📁</span>
                    <span style={{ fontSize:15, fontWeight:600 }}>Select or create a project</span>
                    <button onClick={()=>setShowNewProject(true)} style={{ padding:"10px 20px", borderRadius:10, border:"none", background:"#00d18c", color:"#003d2a", fontWeight:700, cursor:"pointer", fontSize:14 }}>+ New Project</button>
                  </div>
                )}
                {plannerSection==="projects" && currentProject && (
                  <ProjectView key={currentProject.id} project={currentProject} onUpdate={updateProject}/>
                )}
              </div>
            </>
          )}

          {/* ── APPS ── */}
          {page==="apps" && (
            <div style={{ flex:1, padding:"32px 36px", overflowY:"auto" }}>
              <div style={{ fontSize:26, fontWeight:700, marginBottom:4 }}>Apps</div>
              <div style={{ fontSize:14, color:"#7a9e8e", marginBottom:28 }}>Your apps live here</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(130px, 1fr))", gap:16 }}>
                {[{icon:"♟️",label:"Chess",bg:"#1a1a2e"},{icon:"🎹",label:"Piano",bg:"#2e1a1a"},{icon:"🇪🇸",label:"Spanish",bg:"#2a1a2e"}].map(app=>(
                  <div key={app.label}
                    onClick={() => { if (app.label==="Chess") setSubPage("chess"); }}
                    style={{ background:"#1a1f1d", border:"1px solid #1f2e28", borderRadius:16, padding:"24px 16px 16px", display:"flex", flexDirection:"column", alignItems:"center", gap:10, cursor:"pointer" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor="#00d18c"}
                    onMouseLeave={e => e.currentTarget.style.borderColor="#1f2e28"}
                  >
                    <div style={{ width:48, height:48, borderRadius:12, background:app.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>{app.icon}</div>
                    <span style={{ fontSize:13 }}>{app.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CHESS SUB-PAGE ── */}
          {page==="apps" && subPage==="chess" && (
            <div style={{ position:"fixed", inset:0, background:"#111312", zIndex:50, overflowY:"auto" }}>
              <ChessEmbed onTimeUpdate={(s) => setChessSeconds(s)} onBack={() => setSubPage(null)} />
            </div>
          )}

          {/* ── SECURITY ── */}
          {page==="security" && (
            <div style={{ flex:1, padding:"32px 36px", overflowY:"auto" }}>
              <div style={{ fontSize:26, fontWeight:700, marginBottom:4 }}>Security</div>
              <div style={{ fontSize:14, color:"#7a9e8e", marginBottom:28 }}>Camera feeds will live here</div>
              <div style={{ background:"#1a1f1d", border:"2px dashed #1f2e28", borderRadius:16, padding:60, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"#7a9e8e" }}>
                <span style={{ fontSize:48, marginBottom:16 }}>📷</span>
                <span style={{ fontSize:16, fontWeight:600 }}>Camera feed coming soon</span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Bottom Bar */}
      <div style={{ height:68, minHeight:68, background:"#0a0f0d", borderTop:"1px solid #1a2e24", display:"flex", alignItems:"center", padding:"0 16px", flexShrink:0 }}>
        {todayWeather && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 20px 0 8px", borderRight:"1px solid #1a2e24", marginRight:8, gap:2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:10, fontWeight:800, letterSpacing:"1px", textTransform:"uppercase", background:"#00d18c", color:"#003d2a", borderRadius:4, padding:"1px 6px" }}>Today</span>
              <span style={{ fontSize:22 }}>{getWeatherEmoji(todayWeather.icon)}</span>
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
              <span style={{ fontSize:20, fontWeight:800, color:"#e8f0ed" }}>{todayWeather.temp}°F</span>
              <span style={{ fontSize:11, color:"#7a9e8e" }}>{todayWeather.high}° / {todayWeather.low}°</span>
            </div>
            <div style={{ fontSize:10, color:"#7a9e8e" }}>{getWeatherLabel(todayWeather.icon)}</div>
          </div>
        )}
        <div style={{ display:"flex", alignItems:"center", flex:1, gap:0 }}>
          {forecast.map((day,i)=>(
            <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 14px", borderRight:i<forecast.length-1?"1px solid #1a2e24":"none", gap:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ fontSize:11, color:"#7a9e8e", fontWeight:700 }}>{day.day.toUpperCase()}</span>
                <span style={{ fontSize:16 }}>{getWeatherEmoji(day.icon)}</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <span style={{ fontSize:12, color:"#e8f0ed", fontWeight:600 }}>{day.high}°</span>
                <span style={{ fontSize:11, color:"#4a7060" }}>{day.low}°</span>
              </div>
              <div style={{ fontSize:10, color:"#4a7060", whiteSpace:"nowrap" }}>{getWeatherLabel(day.icon)}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12, flexShrink:0, paddingLeft:16, borderLeft:"1px solid #1a2e24" }}>
          <span style={{ fontSize:12, color:"#7a9e8e" }}>{bottomDate}</span>
          <div style={{ width:1, height:16, background:"#1a2e24" }}/>
          <span style={{ fontSize:15, fontWeight:700, color:"#e8f0ed", letterSpacing:"1px" }}>{time}</span>
        </div>
      </div>

    </div>
  );
}
