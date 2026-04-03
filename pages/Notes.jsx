import { useState, useEffect, useRef, useCallback } from "react";
import { Note } from "@/api/entities";

const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFontSize, setActiveFontSize] = useState(16);
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false });
  const editorRef = useRef(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    loadNotes();
  }, []);

  async function loadNotes() {
    const data = await Note.list("-updated_date");
    setNotes(data);
  }

  function selectNote(note) {
    setSelected(note);
    setTitle(note.title || "");
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = note.content || "<p><br></p>";
      }
    }, 0);
  }

  async function newNote() {
    const note = await Note.create({ title: "Untitled", content: "<p><br></p>" });
    await loadNotes();
    selectNote(note);
    setTimeout(() => editorRef.current?.focus(), 100);
  }

  async function saveNote(noteId, noteTitle, content) {
    setSaving(true);
    await Note.update(noteId, { title: noteTitle, content });
    await loadNotes();
    setSaving(false);
  }

  function triggerSave() {
    if (!selected) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const content = editorRef.current?.innerHTML || "";
      saveNote(selected.id, title, content);
    }, 800);
  }

  async function deleteNote() {
    if (!selected) return;
    await Note.delete(selected.id);
    setSelected(null);
    await loadNotes();
  }

  function exec(command, value = null) {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    updateActiveFormats();
    triggerSave();
  }

  function updateActiveFormats() {
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
    });
  }

  function handleFontSize(size) {
    setActiveFontSize(size);
    // execCommand fontSize only supports 1-7, so we use a workaround
    document.execCommand("styleWithCSS", false, true);
    document.execCommand("fontSize", false, "7");
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const spans = editorRef.current?.querySelectorAll('font[size="7"]');
      spans?.forEach(span => {
        span.removeAttribute("size");
        span.style.fontSize = size + "px";
      });
    }
    editorRef.current?.focus();
    triggerSave();
  }

  function handleKeyDown(e) {
    if (e.key === "Tab") {
      e.preventDefault();
      exec("insertText", "\t");
    }
  }

  function filtered() {
    return notes.filter(n =>
      (n.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (n.content || "").replace(/<[^>]+>/g, "").toLowerCase().includes(search.toLowerCase())
    );
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function stripHtml(html) {
    return (html || "").replace(/<[^>]+>/g, "").slice(0, 50);
  }

  const btnStyle = (active) => ({
    padding: "5px 10px",
    borderRadius: 6,
    border: "1px solid #e0e0e0",
    background: active ? "#1c1c1e" : "#fff",
    color: active ? "#fff" : "#333",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    transition: "all 0.15s",
  });

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Inter', sans-serif", background: "#f0f0f0" }}>
      {/* Sidebar */}
      <div style={{ width: 250, background: "#1c1c1e", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 12 }}>📝 Docs</div>
          <input
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "7px 10px", borderRadius: 8, border: "none",
              background: "#2c2c2e", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box"
            }}
          />
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered().length === 0 && (
            <div style={{ color: "#555", fontSize: 13, textAlign: "center", marginTop: 32 }}>No docs yet</div>
          )}
          {filtered().map(note => (
            <div
              key={note.id}
              onClick={() => selectNote(note)}
              style={{
                padding: "10px 16px",
                cursor: "pointer",
                background: selected?.id === note.id ? "#2c2c2e" : "transparent",
                borderLeft: selected?.id === note.id ? "3px solid #f5a623" : "3px solid transparent",
              }}
            >
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {note.title || "Untitled"}
              </div>
              <div style={{ color: "#888", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {stripHtml(note.content) || "No content"}
              </div>
              <div style={{ color: "#555", fontSize: 11, marginTop: 3 }}>{formatDate(note.updated_date)}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #2c2c2e" }}>
          <button onClick={newNote} style={{
            width: "100%", padding: "10px 0", borderRadius: 8, border: "none",
            background: "#f5a623", color: "#1c1c1e", fontWeight: 700, fontSize: 14, cursor: "pointer"
          }}>
            + New Doc
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {selected ? (
          <>
            {/* Toolbar */}
            <div style={{
              background: "#fff", borderBottom: "1px solid #e0e0e0",
              padding: "8px 20px", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap"
            }}>
              {/* Font Size */}
              <select
                value={activeFontSize}
                onChange={e => handleFontSize(Number(e.target.value))}
                style={{
                  padding: "5px 8px", borderRadius: 6, border: "1px solid #e0e0e0",
                  fontSize: 13, cursor: "pointer", outline: "none", background: "#fff"
                }}
              >
                {FONT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
              </select>

              <div style={{ width: 1, height: 24, background: "#e0e0e0", margin: "0 4px" }} />

              {/* Bold */}
              <button style={btnStyle(activeFormats.bold)} onClick={() => exec("bold")} title="Bold">B</button>
              {/* Italic */}
              <button style={{ ...btnStyle(activeFormats.italic), fontStyle: "italic" }} onClick={() => exec("italic")} title="Italic">I</button>
              {/* Underline */}
              <button style={{ ...btnStyle(activeFormats.underline), textDecoration: "underline" }} onClick={() => exec("underline")} title="Underline">U</button>

              <div style={{ width: 1, height: 24, background: "#e0e0e0", margin: "0 4px" }} />

              {/* Headings */}
              <button style={btnStyle(false)} onClick={() => exec("formatBlock", "h1")} title="Heading 1">H1</button>
              <button style={btnStyle(false)} onClick={() => exec("formatBlock", "h2")} title="Heading 2">H2</button>
              <button style={btnStyle(false)} onClick={() => exec("formatBlock", "p")} title="Paragraph">¶</button>

              <div style={{ width: 1, height: 24, background: "#e0e0e0", margin: "0 4px" }} />

              {/* Lists */}
              <button style={btnStyle(false)} onClick={() => exec("insertUnorderedList")} title="Bullet List">• List</button>
              <button style={btnStyle(false)} onClick={() => exec("insertOrderedList")} title="Numbered List">1. List</button>

              <div style={{ width: 1, height: 24, background: "#e0e0e0", margin: "0 4px" }} />

              {/* Alignment */}
              <button style={btnStyle(false)} onClick={() => exec("justifyLeft")} title="Align Left">⬅</button>
              <button style={btnStyle(false)} onClick={() => exec("justifyCenter")} title="Center">↔</button>
              <button style={btnStyle(false)} onClick={() => exec("justifyRight")} title="Align Right">➡</button>

              <div style={{ flex: 1 }} />
              <span style={{ color: "#aaa", fontSize: 12 }}>{saving ? "Saving…" : "Saved ✓"}</span>
              <button onClick={deleteNote} style={{
                background: "none", border: "1px solid #e0e0e0", color: "#cc4444",
                borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 13
              }}>Delete</button>
            </div>

            {/* Title */}
            <div style={{ background: "#f0f0f0", paddingTop: 40, paddingBottom: 0, display: "flex", justifyContent: "center" }}>
              <div style={{ width: 816, maxWidth: "100%" }}>
                <input
                  value={title}
                  onChange={e => { setTitle(e.target.value); triggerSave(); }}
                  placeholder="Untitled document"
                  style={{
                    width: "100%", fontSize: 28, fontWeight: 700, border: "none", outline: "none",
                    background: "transparent", color: "#1c1c1e", padding: "0 60px", boxSizing: "border-box"
                  }}
                />
              </div>
            </div>

            {/* Page */}
            <div style={{ flex: 1, overflowY: "auto", background: "#f0f0f0", padding: "20px 0 60px" }}>
              <div style={{ margin: "0 auto", width: 816, maxWidth: "100%", background: "#fff", minHeight: 1056, boxShadow: "0 1px 4px rgba(0,0,0,0.12)", padding: "60px" }}>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={triggerSave}
                  onKeyDown={handleKeyDown}
                  onKeyUp={updateActiveFormats}
                  onMouseUp={updateActiveFormats}
                  style={{
                    outline: "none", minHeight: 900, fontSize: activeFontSize + "px",
                    lineHeight: 1.7, color: "#1c1c1e", wordBreak: "break-word"
                  }}
                />
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#aaa" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📄</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: "#555" }}>No document open</div>
            <div style={{ fontSize: 14, marginBottom: 28 }}>Select a doc from the sidebar or start a new one</div>
            <button onClick={newNote} style={{
              padding: "12px 28px", borderRadius: 8, border: "none",
              background: "#f5a623", color: "#1c1c1e", fontWeight: 700, fontSize: 15, cursor: "pointer"
            }}>
              + New Doc
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
