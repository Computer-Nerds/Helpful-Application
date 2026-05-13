import { useState, useEffect, useRef } from "react";
import { Track } from "@/api/entities";

function formatDur(s) {
  if (!s || isNaN(s)) return "--:--";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function WaveIcon({ playing }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      {[2, 5, 8, 11, 14].map((x, i) => (
        <rect key={i} x={x} y={playing ? 0 : 4} width="2" height={playing ? 18 : 10}
          fill="#00d18c" rx="1"
          style={{ transformOrigin: `${x + 1}px 9px`, animation: playing ? `wave${i} 0.8s ease-in-out ${i * 0.12}s infinite alternate` : "none" }} />
      ))}
      <style>{`
        @keyframes wave0 { from{transform:scaleY(0.3)} to{transform:scaleY(1)} }
        @keyframes wave1 { from{transform:scaleY(0.6)} to{transform:scaleY(0.2)} }
        @keyframes wave2 { from{transform:scaleY(0.2)} to{transform:scaleY(0.9)} }
        @keyframes wave3 { from{transform:scaleY(0.8)} to{transform:scaleY(0.3)} }
        @keyframes wave4 { from{transform:scaleY(0.4)} to{transform:scaleY(1)} }
      `}</style>
    </svg>
  );
}

async function uploadWav(file) {
  // Convert file to base64 and send to backend function
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(",")[1];
        const res = await fetch(`https://api.base44.com/api/apps/69cf6a85f0ef6a1f0f44476a/functions/uploadTrack`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: "audio/wav", base64 }),
        });
        const data = await res.json();
        if (data.url) resolve(data.url);
        else reject(new Error(data.error || "Upload failed"));
      } catch (e) { reject(e); }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function MusicApp({ onBack }) {
  const [tracks, setTracks]       = useState([]);
  const [current, setCurrent]     = useState(null);
  const [playing, setPlaying]     = useState(false);
  const [elapsed, setElapsed]     = useState(0);
  const [duration, setDuration]   = useState(0);
  const [volume, setVolume]       = useState(0.8);
  const [shuffle, setShuffle]     = useState(false);
  const [repeat, setRepeat]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [editId, setEditId]       = useState(null);
  const [editFields, setEditFields] = useState({});
  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver]   = useState(false);

  const audioRef  = useRef(null);
  const fileInput = useRef(null);
  const seekRef   = useRef(null);

  useEffect(() => { loadTracks(); }, []);

  async function loadTracks() {
    const data = await Track.list();
    setTracks(data);
    if (data.length > 0) setCurrent(c => c || data[0].id);
  }

  const currentTrack = tracks.find(t => t.id === current);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    const onTime   = () => setElapsed(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    const onEnded  = () => handleEnded();
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
  }, [current, shuffle, repeat, tracks]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    const wasPlaying = playing;
    audio.src = currentTrack.file_url;
    audio.load();
    setElapsed(0); setDuration(0);
    if (wasPlaying) audio.play().catch(() => {});
  }, [current]);

  function handleEnded() {
    if (repeat) { audioRef.current.currentTime = 0; audioRef.current.play(); return; }
    playNext();
  }

  function playNext() {
    if (tracks.length < 2) return;
    if (shuffle) {
      const others = tracks.filter(t => t.id !== current);
      setCurrent(others[Math.floor(Math.random() * others.length)].id);
    } else {
      const idx = tracks.findIndex(t => t.id === current);
      setCurrent(tracks[(idx + 1) % tracks.length].id);
    }
  }

  function playPrev() {
    if (elapsed > 3) { audioRef.current.currentTime = 0; return; }
    const idx = tracks.findIndex(t => t.id === current);
    setCurrent(tracks[(idx - 1 + tracks.length) % tracks.length].id);
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play().catch(() => {}); setPlaying(true); }
  }

  function seek(e) {
    const rect = seekRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
    setElapsed(pct * duration);
  }

  async function handleFiles(files) {
    const wavFiles = [...files].filter(f => f.type === "audio/wav" || f.name.endsWith(".wav"));
    if (!wavFiles.length) return;
    setUploading(true);
    for (let i = 0; i < wavFiles.length; i++) {
      const f = wavFiles[i];
      setUploadMsg(`Uploading ${i + 1}/${wavFiles.length}: ${f.name}`);
      try {
        const url = await uploadWav(f);
        const title = f.name.replace(/\.wav$/i, "").replace(/[-_]/g, " ");
        await Track.create({ title, artist: "", album: "", file_url: url });
      } catch (e) { console.error(e); setUploadMsg(`Error: ${e.message}`); }
    }
    setUploading(false);
    setUploadMsg("");
    setShowUpload(false);
    loadTracks();
  }

  async function deleteTrack(id) {
    await Track.delete(id);
    if (current === id) {
      const idx = tracks.findIndex(t => t.id === id);
      const next = tracks[idx + 1] || tracks[idx - 1];
      setCurrent(next?.id || null);
      setPlaying(false);
    }
    setTracks(ts => ts.filter(x => x.id !== id));
  }

  async function saveEdit(id) {
    await Track.update(id, editFields);
    setTracks(ts => ts.map(t => t.id === id ? { ...t, ...editFields } : t));
    setEditId(null);
  }

  const pct = duration > 0 ? (elapsed / duration) * 100 : 0;

  return (
    <div style={{ height: "100vh", background: "#0a0d0c", color: "#e8f0ed", fontFamily: "'Segoe UI',system-ui,sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <audio ref={audioRef} />

      {/* TOP BAR */}
      <div style={{ background: "#080c0a", borderBottom: "1px solid #141e1a", padding: "0 20px", height: 54, display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        {onBack && (
          <button onClick={onBack} style={{ background: "#1a1f1d", border: "1px solid #1f2e28", color: "#7a9e8e", borderRadius: 8, padding: "5px 14px", cursor: "pointer", fontSize: 13 }}>← Apps</button>
        )}
        <span style={{ fontSize: 16, fontWeight: 800 }}>🎵 Music</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowUpload(v => !v)}
          style={{ background: showUpload ? "rgba(0,209,140,0.15)" : "#1a1f1d", border: `1px solid ${showUpload ? "#00d18c" : "#1f2e28"}`, color: showUpload ? "#00d18c" : "#7a9e8e", borderRadius: 8, padding: "5px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          + Add Tracks
        </button>
      </div>

      {/* UPLOAD PANEL */}
      {showUpload && (
        <div style={{ background: "#0e1210", borderBottom: "1px solid #1a2e24", padding: "16px 24px", flexShrink: 0 }}>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => !uploading && fileInput.current.click()}
            style={{ border: `2px dashed ${dragOver ? "#00d18c" : "#1f2e28"}`, borderRadius: 12, padding: "28px 20px", textAlign: "center", cursor: uploading ? "default" : "pointer", transition: "all 0.2s", background: dragOver ? "rgba(0,209,140,0.05)" : "transparent" }}>
            {uploading ? (
              <div>
                <div style={{ fontSize: 14, color: "#00d18c", marginBottom: 6 }}>⏳ {uploadMsg}</div>
                <div style={{ fontSize: 12, color: "#4a7060" }}>Please wait...</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🎵</div>
                <div style={{ fontSize: 14, color: "#7a9e8e" }}>Drop <b>.wav</b> files here or <span style={{ color: "#00d18c" }}>click to browse</span></div>
                <div style={{ fontSize: 12, color: "#3a5548", marginTop: 4 }}>Multiple files supported</div>
              </>
            )}
          </div>
          <input ref={fileInput} type="file" accept=".wav,audio/wav" multiple onChange={e => handleFiles(e.target.files)} style={{ display: "none" }} />
        </div>
      )}

      {/* TRACK LIST */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {tracks.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#3a5548" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎵</div>
            <div style={{ fontSize: 15 }}>No tracks yet</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Click "+ Add Tracks" to upload .wav files</div>
          </div>
        )}
        {tracks.map((track, idx) => {
          const isCurrent = track.id === current;
          return (
            <div key={track.id}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", background: isCurrent ? "rgba(0,209,140,0.07)" : "transparent", borderLeft: `3px solid ${isCurrent ? "#00d18c" : "transparent"}`, cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = "transparent"; }}>

              <div style={{ width: 28, textAlign: "center", flexShrink: 0 }}
                onClick={() => { setCurrent(track.id); setPlaying(true); setTimeout(() => audioRef.current?.play(), 80); }}>
                {isCurrent && playing ? <WaveIcon playing /> : <span style={{ fontSize: 12, color: "#3a5548" }}>{idx + 1}</span>}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}
                onClick={() => { setCurrent(track.id); setPlaying(true); setTimeout(() => audioRef.current?.play(), 80); }}>
                {editId === track.id ? (
                  <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
                    <input value={editFields.title || ""} onChange={e => setEditFields(f => ({ ...f, title: e.target.value }))} placeholder="Title"
                      style={{ background: "#1a1f1d", border: "1px solid #1f2e28", color: "#e8f0ed", borderRadius: 6, padding: "3px 8px", fontSize: 13, width: 160 }} />
                    <input value={editFields.artist || ""} onChange={e => setEditFields(f => ({ ...f, artist: e.target.value }))} placeholder="Artist"
                      style={{ background: "#1a1f1d", border: "1px solid #1f2e28", color: "#e8f0ed", borderRadius: 6, padding: "3px 8px", fontSize: 13, width: 120 }} />
                    <input value={editFields.album || ""} onChange={e => setEditFields(f => ({ ...f, album: e.target.value }))} placeholder="Album"
                      style={{ background: "#1a1f1d", border: "1px solid #1f2e28", color: "#e8f0ed", borderRadius: 6, padding: "3px 8px", fontSize: 13, width: 120 }} />
                    <button onClick={() => saveEdit(track.id)}
                      style={{ background: "#00d18c", border: "none", color: "#003d2a", borderRadius: 6, padding: "3px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Save</button>
                    <button onClick={() => setEditId(null)}
                      style={{ background: "none", border: "1px solid #1f2e28", color: "#7a9e8e", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>✕</button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 14, fontWeight: isCurrent ? 600 : 400, color: isCurrent ? "#e8f0ed" : "#c0d4cc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {track.title || "Untitled"}
                    </div>
                    <div style={{ fontSize: 12, color: "#4a7060", marginTop: 1 }}>
                      {[track.artist, track.album].filter(Boolean).join(" · ") || <span style={{ fontStyle: "italic" }}>Unknown</span>}
                    </div>
                  </>
                )}
              </div>

              <div style={{ fontSize: 12, color: "#3a5548", flexShrink: 0, width: 40, textAlign: "right" }}>
                {isCurrent ? formatDur(duration) : ""}
              </div>

              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={e => { e.stopPropagation(); setEditId(track.id); setEditFields({ title: track.title, artist: track.artist, album: track.album }); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#3a5548", fontSize: 14, padding: "2px 4px" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#7a9e8e"} onMouseLeave={e => e.currentTarget.style.color = "#3a5548"}>✏️</button>
                <button onClick={e => { e.stopPropagation(); if (confirm(`Delete "${track.title}"?`)) deleteTrack(track.id); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#3a5548", fontSize: 14, padding: "2px 4px" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#f87171"} onMouseLeave={e => e.currentTarget.style.color = "#3a5548"}>🗑️</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* PLAYER BAR */}
      <div style={{ background: "#080c0a", borderTop: "1px solid #141e1a", padding: "0 24px", height: 88, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, flexShrink: 0 }}>
        <div ref={seekRef} onClick={seek}
          style={{ height: 4, background: "#1a2e24", borderRadius: 2, cursor: "pointer", position: "relative" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "#00d18c", borderRadius: 2, transition: "width 0.3s linear" }} />
          <div style={{ position: "absolute", top: "50%", left: `${pct}%`, transform: "translate(-50%,-50%)", width: 10, height: 10, borderRadius: "50%", background: "#00d18c", opacity: pct > 0 ? 1 : 0, transition: "left 0.3s linear" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#e8f0ed" }}>
              {currentTrack?.title || "No track selected"}
            </div>
            <div style={{ fontSize: 12, color: "#4a7060", marginTop: 1 }}>{currentTrack?.artist || ""}</div>
          </div>

          <span style={{ fontSize: 12, color: "#3a5548", fontVariantNumeric: "tabular-nums", minWidth: 80, textAlign: "center" }}>
            {formatDur(elapsed)} / {formatDur(duration)}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setShuffle(v => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, opacity: shuffle ? 1 : 0.3, padding: "2px 4px" }} title="Shuffle">🔀</button>
            <button onClick={playPrev}
              style={{ background: "#1a1f1d", border: "1px solid #1f2e28", color: "#7a9e8e", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 16 }}>⏮</button>
            <button onClick={togglePlay}
              style={{ background: "#00d18c", border: "none", color: "#003d2a", borderRadius: 12, padding: "10px 24px", cursor: "pointer", fontSize: 20, fontWeight: 800, minWidth: 64 }}>
              {playing ? "⏸" : "▶"}
            </button>
            <button onClick={playNext}
              style={{ background: "#1a1f1d", border: "1px solid #1f2e28", color: "#7a9e8e", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 16 }}>⏭</button>
            <button onClick={() => setRepeat(v => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, opacity: repeat ? 1 : 0.3, padding: "2px 4px" }} title="Repeat">🔁</button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120 }}>
            <span style={{ fontSize: 14 }}>{volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}</span>
            <input type="range" min={0} max={1} step={0.01} value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              style={{ width: 80, accentColor: "#00d18c", cursor: "pointer" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
