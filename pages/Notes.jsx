import { useState, useEffect } from "react";

const WEATHER_KEY = "95b942dc3f7006dda16797bd6b501d29";
const CITY = "Oklahoma City";

export default function Dashboard() {
  const [page, setPage] = useState("home");
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [greeting, setGreeting] = useState("");
  const [tasks, setTasks] = useState(() => JSON.parse(localStorage.getItem("tasks") || "[]"));
  const [taskInput, setTaskInput] = useState("");
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      setTime(`${h}:${m}`);
      setDate(now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));
      const hr = now.getHours();
      setGreeting(hr < 12 ? "Good morning 👋" : hr < 17 ? "Good afternoon 👋" : "Good evening 👋");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function fetchWeather() {
      try {
        // Current weather
        const cur = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(CITY)}&appid=${WEATHER_KEY}&units=imperial`);
        const curData = await cur.json();
        setWeather({
          temp: Math.round(curData.main.temp),
          desc: curData.weather[0].description,
          icon: curData.weather[0].id,
        });

        // 5-day forecast (3-hour intervals, we group by day)
        const fore = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(CITY)}&appid=${WEATHER_KEY}&units=imperial`);
        const foreData = await fore.json();

        // Group by day
        const days = {};
        foreData.list.forEach(item => {
          const d = new Date(item.dt * 1000);
          const key = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
          if (!days[key]) days[key] = { dayName, temps: [], icons: [] };
          days[key].temps.push(item.main.temp);
          days[key].icons.push(item.weather[0].id);
        });

        // Take next 5 days (skip today)
        const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        const result = Object.entries(days)
          .filter(([key]) => key !== today)
          .slice(0, 5)
          .map(([_, v]) => ({
            day: v.dayName,
            low: Math.round(Math.min(...v.temps)),
            high: Math.round(Math.max(...v.temps)),
            icon: Math.round(v.icons.reduce((a, b) => a + b, 0) / v.icons.length),
          }));

        setForecast(result);
      } catch (e) {
        console.error("Weather fetch failed", e);
      }
    }
    fetchWeather();
    const id = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  function getWeatherEmoji(id) {
    if (!id) return "🌡️";
    if (id >= 200 && id < 300) return "⛈️";
    if (id >= 300 && id < 400) return "🌦️";
    if (id >= 500 && id < 600) return "🌧️";
    if (id >= 600 && id < 700) return "❄️";
    if (id >= 700 && id < 800) return "🌫️";
    if (id === 800) return "☀️";
    if (id === 801) return "🌤️";
    if (id === 802) return "⛅";
    if (id >= 803) return "☁️";
    return "🌡️";
  }

  function saveTasks(t) { setTasks(t); localStorage.setItem("tasks", JSON.stringify(t)); }
  function addTask() { if (!taskInput.trim()) return; saveTasks([{ text: taskInput.trim(), done: false }, ...tasks]); setTaskInput(""); }
  function toggleTask(i) { const t = [...tasks]; t[i].done = !t[i].done; saveTasks(t); }
  function removeTask(i) { saveTasks(tasks.filter((_, idx) => idx !== i)); }

  const openCount = tasks.filter(t => !t.done).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#111312", color: "#e8f0ed" }}>

      {/* Top Bar */}
      <div style={{
        height: 44, background: "#d8ddd9", display: "flex", alignItems: "center",
        padding: "0 20px", flexShrink: 0, borderBottom: "1px solid #b0b8b4"
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1a2e25", letterSpacing: "0.3px" }}>Helpful App</span>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Sidebar */}
        <nav style={{ width: 64, background: "#005e40", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0", gap: 4, flexShrink: 0 }}>
          {[
            { id: "home",    icon: "🏠", label: "Home" },
            { id: "planner", icon: "📄", label: "Planner" },
          ].map(item => (
            <button key={item.id} onClick={() => setPage(item.id)} title={item.label} style={{
              width: 44, height: 44, borderRadius: 12, border: "none",
              background: page === item.id ? "rgba(255,255,255,0.18)" : "transparent",
              color: page === item.id ? "#fff" : "rgba(255,255,255,0.55)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              borderLeft: page === item.id ? "3px solid #fff" : "3px solid transparent", transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
            </button>
          ))}

          <div style={{ width: 36, height: 1, background: "rgba(255,255,255,0.12)", margin: "8px 0" }} />

          <button onClick={() => setPage("apps")} title="Apps" style={{
            width: 44, height: 44, borderRadius: 12, border: "none",
            background: page === "apps" ? "rgba(255,255,255,0.18)" : "transparent",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            borderLeft: page === "apps" ? "3px solid #fff" : "3px solid transparent", transition: "all 0.15s",
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 9, height: 9, borderRadius: 2, background: page === "apps" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)" }} />
              ))}
            </div>
          </button>

          <div style={{ flex: 1 }} />

          <button onClick={() => setPage("security")} title="Security" style={{
            width: 44, height: 44, borderRadius: 12, border: "none",
            background: page === "security" ? "rgba(255,255,255,0.18)" : "transparent",
            color: page === "security" ? "#fff" : "rgba(255,255,255,0.55)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            borderLeft: page === "security" ? "3px solid #fff" : "3px solid transparent", transition: "all 0.15s",
          }}>
            <span style={{ fontSize: 20 }}>🛡️</span>
          </button>
        </nav>

        {/* Content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {page === "home" && (
            <div style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
              <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{greeting}</div>
              <div style={{ fontSize: 14, color: "#7a9e8e", marginBottom: 28 }}>{date}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
                <div style={{ background: "#1a1f1d", border: "1px solid #1f2e28", borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 12, color: "#7a9e8e", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Tasks Today</div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{openCount}</div>
                  <div style={{ fontSize: 12, color: "#7a9e8e", marginTop: 4 }}>Open tasks in planner</div>
                </div>
                <div style={{ background: "#1a1f1d", border: "1px solid #1f2e28", borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 12, color: "#7a9e8e", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Time</div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{time}</div>
                  <div style={{ fontSize: 12, color: "#7a9e8e", marginTop: 4 }}>Local time</div>
                </div>
                {weather && (
                  <div style={{ background: "#1a1f1d", border: "1px solid #1f2e28", borderRadius: 14, padding: 20 }}>
                    <div style={{ fontSize: 12, color: "#7a9e8e", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Weather</div>
                    <div style={{ fontSize: 28, fontWeight: 700 }}>{getWeatherEmoji(weather.icon)} {weather.temp}°F</div>
                    <div style={{ fontSize: 12, color: "#7a9e8e", marginTop: 4, textTransform: "capitalize" }}>{weather.desc}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {page === "planner" && (
            <div style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
              <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Planner</div>
              <div style={{ fontSize: 14, color: "#7a9e8e", marginBottom: 28 }}>Your tasks for today</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                <input value={taskInput} onChange={e => setTaskInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} placeholder="Add a new task…"
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #1f2e28", background: "#1a1f1d", color: "#e8f0ed", fontSize: 14, outline: "none" }} />
                <button onClick={addTask} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "#00d18c", color: "#003d2a", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Add</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {tasks.length === 0 && <div style={{ color: "#7a9e8e", fontSize: 14 }}>No tasks yet — add one above!</div>}
                {tasks.map((task, i) => (
                  <div key={i} style={{ background: "#1a1f1d", border: "1px solid #1f2e28", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <input type="checkbox" checked={task.done} onChange={() => toggleTask(i)} style={{ width: 18, height: 18, accentColor: "#00d18c", cursor: "pointer", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, color: task.done ? "#7a9e8e" : "#e8f0ed", textDecoration: task.done ? "line-through" : "none" }}>{task.text}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "rgba(0,209,140,0.15)", color: "#00d18c" }}>Today</span>
                    <button onClick={() => removeTask(i)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {page === "apps" && (
            <div style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
              <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Apps</div>
              <div style={{ fontSize: 14, color: "#7a9e8e", marginBottom: 28 }}>Your apps live here</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 16 }}>
                {[
                  { icon: "📝", label: "Notes",   bg: "#1a2e25" },
                  { icon: "♟️", label: "Chess",   bg: "#1a1a2e" },
                  { icon: "🎹", label: "Piano",   bg: "#2e1a1a" },
                  { icon: "🇪🇸", label: "Spanish", bg: "#2a1a2e" },
                ].map(app => (
                  <div key={app.label} style={{ background: "#1a1f1d", border: "1px solid #1f2e28", borderRadius: 16, padding: "24px 16px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: app.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{app.icon}</div>
                    <span style={{ fontSize: 13 }}>{app.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {page === "security" && (
            <div style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
              <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Security</div>
              <div style={{ fontSize: 14, color: "#7a9e8e", marginBottom: 28 }}>Camera feeds will live here</div>
              <div style={{ background: "#1a1f1d", border: "2px dashed #1f2e28", borderRadius: 16, padding: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#7a9e8e" }}>
                <span style={{ fontSize: 48, marginBottom: 16 }}>📷</span>
                <span style={{ fontSize: 16, fontWeight: 600 }}>Camera feed coming soon</span>
                <span style={{ fontSize: 13, marginTop: 8 }}>Connect a camera to see a live feed here</span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Bottom Bar */}
      <div style={{
        height: 52, background: "#0a0f0d", borderTop: "1px solid #1a2e24",
        display: "flex", alignItems: "center", padding: "0 20px", gap: 0, flexShrink: 0,
      }}>
        {/* 5-day forecast */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
          {forecast.length === 0 && <span style={{ fontSize: 12, color: "#4a7060" }}>Loading forecast…</span>}
          {forecast.map((day, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 14px", borderRight: i < forecast.length - 1 ? "1px solid #1a2e24" : "none"
            }}>
              <span style={{ fontSize: 12, color: "#7a9e8e", fontWeight: 600, minWidth: 28 }}>{day.day}</span>
              <span style={{ fontSize: 16 }}>{getWeatherEmoji(day.icon)}</span>
              <span style={{ fontSize: 12, color: "#e8f0ed", fontWeight: 600 }}>{day.high}°</span>
              <span style={{ fontSize: 12, color: "#4a7060" }}>{day.low}°</span>
            </div>
          ))}
        </div>

        {/* Time & Date right */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: "#7a9e8e" }}>{date}</span>
          <div style={{ width: 1, height: 16, background: "#1a2e24" }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#e8f0ed", letterSpacing: "1px" }}>{time}</span>
        </div>
      </div>

    </div>
  );
}
