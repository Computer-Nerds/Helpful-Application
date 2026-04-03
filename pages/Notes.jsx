import { useState, useEffect } from "react";
import { Note } from "@/api/entities";

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

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
    setContent(note.content || "");
  }

  async function newNote() {
    const note = await Note.create({ title: "Untitled", content: "" });
    await loadNotes();
    selectNote(note);
  }

  async function saveNote() {
    if (!selected) return;
    setSaving(true);
    await Note.update(selected.id, { title, content });
    await loadNotes();
    setSaving(false);
  }

  async function deleteNote() {
    if (!selected) return;
    await Note.delete(selected.id);
    setSelected(null);
    setTitle("");
    setContent("");
    await loadNotes();
  }

  // Auto-save on content/title change
  useEffect(() => {
    if (!selected) return;
    const timer = setTimeout(() => {
      saveNote();
    }, 800);
    return () => clearTimeout(timer);
  }, [title, content]);

  const filtered = notes.filter(n =>
    (n.title || "").toLowerCase().includes(search.toLowerCase()) ||
    (n.content || "").toLowerCase().includes(search.toLowerCase())
  );

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Inter', sans-serif", background: "#f7f7f5" }}>
      {/* Sidebar */}
      <div style={{ width: 260, background: "#1c1c1e", display: "flex", flexDirection: "column", borderRight: "1px solid #2c2c2e" }}>
        <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid #2c2c2e" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 12 }}>📝 Notes</div>
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
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {filtered.length === 0 && (
            <div style={{ color: "#555", fontSize: 13, textAlign: "center", marginTop: 32 }}>No notes yet</div>
          )}
          {filtered.map(note => (
            <div
              key={note.id}
              onClick={() => selectNote(note)}
              style={{
                padding: "10px 16px",
                cursor: "pointer",
                background: selected?.id === note.id ? "#2c2c2e" : "transparent",
                borderLeft: selected?.id === note.id ? "3px solid #f5a623" : "3px solid transparent",
                transition: "background 0.15s",
              }}
            >
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 500, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {note.title || "Untitled"}
              </div>
              <div style={{ color: "#888", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {note.content ? note.content.slice(0, 40) + (note.content.length > 40 ? "…" : "") : "No content"}
              </div>
              <div style={{ color: "#555", fontSize: 11, marginTop: 4 }}>{formatDate(note.updated_date)}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #2c2c2e" }}>
          <button
            onClick={newNote}
            style={{
              width: "100%", padding: "10px 0", borderRadius: 8, border: "none",
              background: "#f5a623", color: "#1c1c1e", fontWeight: 700, fontSize: 14,
              cursor: "pointer", transition: "opacity 0.15s"
            }}
          >
            + New Note
          </button>
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f7f7f5" }}>
        {selected ? (
          <>
            <div style={{ display: "flex", alignItems: "center", padding: "16px 28px", borderBottom: "1px solid #e5e5e3", background: "#fff" }}>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Note title"
                style={{
                  flex: 1, fontSize: 22, fontWeight: 700, border: "none", outline: "none",
                  background: "transparent", color: "#1c1c1e"
                }}
              />
              <span style={{ color: "#aaa", fontSize: 12, marginRight: 16 }}>
                {saving ? "Saving…" : "Saved"}
              </span>
              <button
                onClick={deleteNote}
                style={{
                  background: "none", border: "1px solid #e5e5e3", color: "#cc4444",
                  borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontSize: 13
                }}
              >
                Delete
              </button>
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Start writing…"
              style={{
                flex: 1, padding: "28px", fontSize: 15, lineHeight: 1.7,
                border: "none", outline: "none", resize: "none",
                background: "#f7f7f5", color: "#2c2c2e", fontFamily: "inherit"
              }}
            />
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#aaa" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
            <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>No note selected</div>
            <div style={{ fontSize: 14, marginBottom: 24 }}>Pick one from the sidebar or create a new one</div>
            <button
              onClick={newNote}
              style={{
                padding: "10px 24px", borderRadius: 8, border: "none",
                background: "#f5a623", color: "#1c1c1e", fontWeight: 700, fontSize: 14,
                cursor: "pointer"
              }}
            >
              + New Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
