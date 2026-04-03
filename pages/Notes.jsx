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
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(CITY)}&appid=${WEATHER_KEY}&units=imperial`
        );
        const data = await res.json();
        if (data.cod === 200 || data.cod === undefined) {
          setWeather({
            temp: Math.round(data.main.temp),
            feels: Math.round(data.main.feels_like),
            desc: data.weather[0].description,
            icon: data.weather[0].id,
            humidity: data.main.humidity,
            wind: Math.round(data.wind.speed),
            city: data.name,
          });
        }
      } catch (e) {
        console.error("Weather fetch failed", e);
      }
    }
    fetchWeather();
    const id = setInterval(fetchWeather, 10 * 60 * 1000); // refresh every 10 min
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

  function saveTasks(t) {
    setTasks(t);
    localStorage.setItem("tasks", JSON.stringify(t));
  }

  function addTask() {
    if (!taskInput.trim()) return;
    saveTasks([{ text: taskInput.trim(), done: false }, ...tasks]);
    setTaskInput("");
  }

  function toggleTask(i) {
    const t = [...tasks];
    t[i].done = !t[i].done;
    saveTasks(t);
  }

  function removeTask(i) {
    saveTasks(tasks.filter((_, idx) => idx !== i));
  }

  const openCount = tasks.filter(t => !t.done).length;

  const styles = {
    root: { display: "flex", flexDirection: "column", height: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#111312", color: "#e8f0ed" },
    body: { display: "flex", flex: 1, overflow: "hidden" },
    sidebar: { width: 64, background: "#005e40", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0", gap: 4, flexShrink: 0 },
    navBtn: (active) => ({
      width: 44, height: 44, borderRadius: 12, border: "none",
      background: active ? "rgba(255,255,255,0.18)" : "transparent",
      color: active ? "#fff" : "rgba(255,255,255,0.55)",
      cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative",
      borderLeft: active ? "3px solid #fff" : "3px solid transparent",
      transition: "all 0.15s",
    }),
    divider: { width: 36, height: 1, background: "rgba(255,255,255,0.12)", margin: "8px 0" },
    spacer: { flex: 1 },
    content: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
    page: { flex: 1, padding: "32px 36px", overflowY: "auto" },
    pageTitle: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
    pageSubtitle: { fontSize: 14, color: "#7a9e8e", marginBottom: 28 },
    card: { background: "#1a1f1d", border: "1px solid #1f2e28", borderRadius: 14, padding: 20 },
    cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 28 },
    cardLabel: { fontSize: 12, color: "#7a9e8e", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 },
    cardValue: { fontSize: 28, fontWeight: 700 },
    cardSub: { fontSize: 12, color: "#7a9e8e", marginTop: 4 },

    // Bottom bar
    bottomBar: {
      height: 42,
      background: "#0a0f0d",
      borderTop: "1px solid #1a2e24",
      display: "flex",
      alignItems: "center",
      padding: "0 20px",
      gap: 24,
      flexShrink: 0,
    },
    weatherSection: {
      display: "flex", alignItems: "center", gap: 20, flex: 1,
    },
    weatherChip: {
      display: "flex", alignItems: "center", gap: 6,
      fontSize: 13, color: "#a0c9b8",
    },
    weatherLabel: {
      fontSize: 11, color: "#4a7060", textTransform: "uppercase", letterSpacing: "0.5px", marginRight: 2,
    },
    timeDateSection: {
      display: "flex", alignItems: "center", gap: 16, flexShrink: 0,
    },
    timeText: { fontSize: 14, fontWeight: 700, color: "#e8f0ed", letterSpacing: "1px" },
    dateText: { fontSize: 12, color: "#7a9e8e" },
    dot: { width: 4, height: 4, borderRadius: "50%", background: "#1f4033" },
  };

  return (
    <div style={styles.root}>
      <div style={styles.body}>
        {/* Sidebar */}
        <nav style={styles.sidebar}>
          {[
            { id: "home",    icon: "🏠", label: "Home" },
            { id: "planner", icon: "📄", label: "Planner" },
          ].map(item => (
            <button key={item.id} style={styles.navBtn(page === item.id)} onClick={() => setPage(item.id)} title={item.label}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
            </button>
          ))}

          <div style={styles.divider} />

          <button style={styles.navBtn(page === "apps")} onClick={() => setPage("apps")} title="Apps">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 9, height: 9, borderRadius: 2, background: page === "apps" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)" }} />
              ))}
            </div>
          </button>

          <div style={styles.spacer} />

          <button style={styles.navBtn(page === "security")} onClick={() => setPage("security")} title="Security">
            <span style={{ fontSize: 20 }}>🛡️</span>
          </button>
        </nav>

        {/* Content */}
        <div style={styles.content}>
          {page === "home" && (
            <div style={styles.page}>
              <div style={styles.pageTitle}>{greeting}</div>
              <div style={styles.pageSubtitle}>{date}</div>
              <div style={styles.cardGrid}>
                <div style={styles.card}>
                  <div style={styles.cardLabel}>Tasks Today</div>
                  <div style={styles.cardValue}>{openCount}</div>
                  <div style={styles.cardSub}>Open tasks in planner</div>
                </div>
                <div style={styles.card}>
                  <div style={styles.cardLabel}>Time</div>
                  <div style={styles.cardValue}>{time}</div>
                  <div style={styles.cardSub}>Local time</div>
                </div>
                {weather && (
                  <div style={styles.card}>
                    <div style={styles.cardLabel}>Weather</div>
                    <div style={styles.cardValue}>{getWeatherEmoji(weather.icon)} {weather.temp}°F</div>
                    <div style={styles.cardSub} style={{ textTransform: "capitalize" }}>{weather.desc}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {page === "planner" && (
            <div style={styles.page}>
              <div style={styles.pageTitle}>Planner</div>
              <div style={styles.pageSubtitle}>Your tasks for today</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                <input
                  value={taskInput}
                  onChange={e => setTaskInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTask()}
                  placeholder="Add a new task…"
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #1f2e28", background: "#1a1f1d", color: "#e8f0ed", fontSize: 14, outline: "none" }}
                />
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
            <div style={styles.page}>
              <div style={styles.pageTitle}>Apps</div>
              <div style={styles.pageSubtitle}>Your apps live here</div>
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
            <div style={styles.page}>
              <div style={styles.pageTitle}>Security</div>
              <div style={styles.pageSubtitle}>Camera feeds will live here</div>
              <div style={{ background: "#1a1f1d", border: "2px dashed #1f2e28", borderRadius: 16, padding: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#7a9e8e" }}>
                <span style={{ fontSize: 48, marginBottom: 16 }}>📷</span>
                <span style={{ fontSize: 16, fontWeight: 600 }}>Camera feed coming soon</span>
                <span style={{ fontSize: 13, marginTop: 8 }}>Connect a camera to see a live feed here</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Weather Bar */}
      <div style={styles.bottomBar}>
        <div style={styles.weatherSection}>
          {weather ? (
            <>
              <div style={styles.weatherChip}>
                <span style={{ fontSize: 16 }}>{getWeatherEmoji(weather.icon)}</span>
                <span style={{ fontWeight: 700, color: "#e8f0ed" }}>{weather.temp}°F</span>
                <span style={{ color: "#7a9e8e", textTransform: "capitalize" }}>{weather.desc}</span>
              </div>
              <div style={styles.dot} />
              <div style={styles.weatherChip}>
                <span style={styles.weatherLabel}>Feels like</span>
                <span>{weather.feels}°F</span>
              </div>
              <div style={styles.dot} />
              <div style={styles.weatherChip}>
                <span style={styles.weatherLabel}>Humidity</span>
                <span>{weather.humidity}%</span>
              </div>
              <div style={styles.dot} />
              <div style={styles.weatherChip}>
                <span style={styles.weatherLabel}>Wind</span>
                <span>{weather.wind} mph</span>
              </div>
              <div style={styles.dot} />
              <div style={styles.weatherChip}>
                <span style={{ fontSize: 11, color: "#4a7060" }}>📍 {weather.city}</span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: "#4a7060" }}>Loading weather…</div>
          )}
        </div>

        {/* Time & Date — bottom right */}
        <div style={styles.timeDateSection}>
          <div style={styles.dot} />
          <div style={styles.dateText}>{date}</div>
          <div style={styles.dot} />
          <div style={styles.timeText}>{time}</div>
        </div>
      </div>
    </div>
  );
}
