import { useState, useMemo, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart
} from "recharts";
import {
  Scale, Target, TrendingDown, TrendingUp, Calendar, Plus,
  ChevronLeft, Settings, Trash2, Award, Flame, ArrowDown,
  ArrowUp, Minus, Edit3, Check, X, Home, Utensils, Dumbbell,
  User, ChevronRight, Clock, Droplets, Zap, Activity
} from "lucide-react";

/* ═══════════════════════════════════════════
   UTILITIES & ALGORITHMS
   ═══════════════════════════════════════════ */

const formatDate = (d) => new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
const formatDateFull = (d) => new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
const toISO = (d) => new Date(d).toISOString().split("T")[0];
const today = () => toISO(new Date());

const calcEMA = (entries, alpha = 0.15) => {
  if (entries.length === 0) return [];
  let ema = entries[0].weight;
  return entries.map((e, i) => {
    if (i === 0) return { ...e, trend: ema };
    ema = alpha * e.weight + (1 - alpha) * ema;
    return { ...e, trend: Math.round(ema * 100) / 100 };
  });
};

const linearRegression = (data) => {
  const n = data.length;
  if (n < 2) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  data.forEach((d, i) => {
    sumX += i; sumY += d.trend || d.weight;
    sumXY += i * (d.trend || d.weight); sumX2 += i * i;
  });
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
};

const calcBMI = (weight, heightCm) => {
  if (!weight || !heightCm) return null;
  const h = heightCm / 100;
  return Math.round((weight / (h * h)) * 10) / 10;
};

// Period average helper
const periodAvg = (entries, daysBack) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const filtered = entries.filter(e => new Date(e.date) >= cutoff);
  if (filtered.length === 0) return null;
  return Math.round((filtered.reduce((s, e) => s + e.weight, 0) / filtered.length) * 100) / 100;
};

// Period change: compare last N days avg vs previous N days avg
const periodChange = (entries, days) => {
  const now = new Date();
  const midpoint = new Date(); midpoint.setDate(now.getDate() - days);
  const earlier = new Date(); earlier.setDate(now.getDate() - days * 2);
  const recent = entries.filter(e => { const d = new Date(e.date); return d >= midpoint && d <= now; });
  const previous = entries.filter(e => { const d = new Date(e.date); return d >= earlier && d < midpoint; });
  if (recent.length === 0 || previous.length === 0) return null;
  const avgRecent = recent.reduce((s, e) => s + e.weight, 0) / recent.length;
  const avgPrev = previous.reduce((s, e) => s + e.weight, 0) / previous.length;
  return Math.round((avgRecent - avgPrev) * 100) / 100;
};

const bmiCategory = (bmi) => {
  if (!bmi) return "";
  if (bmi < 18.5) return "Sottopeso";
  if (bmi < 25) return "Normopeso";
  if (bmi < 30) return "Sovrappeso";
  return "Obesità";
};

const bmiColor = (bmi) => {
  if (!bmi) return "#6B7B7B";
  if (bmi < 18.5) return "#3B82F6";
  if (bmi < 25) return "#02C39A";
  if (bmi < 30) return "#F0B429";
  return "#E85D4E";
};

/* ═══════════════════════════════════════════
   DEMO DATA
   ═══════════════════════════════════════════ */

const generateSampleData = () => {
  const data = [];
  const startWeight = 85.5;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 45);
  for (let i = 0; i <= 45; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    if (Math.random() > 0.2) {
      const trend = startWeight - (i * 0.07);
      const noise = (Math.random() - 0.5) * 1.2;
      data.push({
        id: Date.now() + i,
        date: toISO(d),
        weight: Math.round((trend + noise) * 10) / 10,
        note: i % 10 === 0 ? "Giornata buona" : "",
      });
    }
  }
  return data;
};

/* ═══════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════ */

const T = {
  bg: "#F5F7FA",
  card: "#FFFFFF",
  teal: "#028090",
  tealLight: "#E0F2F1",
  mint: "#02C39A",
  coral: "#E85D4E",
  gold: "#F0B429",
  purple: "#7C5CFC",
  text: "#1A2030",
  textSec: "#6B7280",
  textMuted: "#9CA3AF",
  border: "#F0F0F0",
  gradient: "linear-gradient(135deg, #028090, #02C39A)",
  shadow: "0 2px 16px rgba(0,0,0,0.06)",
  shadowLg: "0 8px 32px rgba(0,0,0,0.08)",
};

/* ═══════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════ */

const Header = ({ title, subtitle, showBack, onBack, right }) => (
  <div style={{
    padding: "16px 20px 8px", background: T.bg,
    position: "sticky", top: 0, zIndex: 10,
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {showBack && (
          <button onClick={onBack} style={{
            background: T.card, border: "none", cursor: "pointer", padding: 8,
            borderRadius: 10, display: "flex", alignItems: "center",
            boxShadow: T.shadow,
          }}>
            <ChevronLeft size={20} color={T.teal} />
          </button>
        )}
        <div>
          {subtitle && <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>{subtitle}</div>}
          <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0, letterSpacing: -0.5 }}>{title}</h1>
        </div>
      </div>
      {right}
    </div>
  </div>
);

const StatCard = ({ icon: Icon, label, value, unit, sub, color = T.teal, compact = false }) => (
  <div style={{
    background: T.card, borderRadius: 16, padding: compact ? "12px 14px" : "16px 18px",
    boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0,
  }}>
    <div style={{
      width: compact ? 36 : 44, height: compact ? 36 : 44, borderRadius: 12,
      background: `${color}12`, display: "flex", alignItems: "center",
      justifyContent: "center", flexShrink: 0,
    }}>
      <Icon size={compact ? 17 : 20} color={color} />
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontSize: compact ? 18 : 24, fontWeight: 800, color: T.text }}>{value}</span>
        {unit && <span style={{ fontSize: 12, color: T.textSec, fontWeight: 500 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 10, color, fontWeight: 600, marginTop: 1 }}>{sub}</div>}
    </div>
  </div>
);

const MilestoneBar = ({ current, start, goal }) => {
  if (!goal || !start || !current) return null;
  const total = Math.abs(start - goal);
  if (total === 0) return null;
  const progress = Math.abs(start - current);
  const pct = Math.min(Math.max((progress / total) * 100, 0), 100);

  return (
    <div style={{ background: T.card, borderRadius: 16, padding: "16px 18px", boxShadow: T.shadow }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Progresso</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: T.teal }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ position: "relative", height: 8, background: T.tealLight, borderRadius: 4 }}>
        <div style={{
          height: "100%", borderRadius: 4, width: `${pct}%`,
          background: T.gradient, transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <span style={{ fontSize: 11, color: T.textMuted }}>{start} kg (inizio)</span>
        <span style={{ fontSize: 11, color: T.teal, fontWeight: 700 }}>{goal} kg (obiettivo)</span>
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{
      background: T.card, borderRadius: 12, padding: "10px 14px",
      boxShadow: T.shadowLg, border: `1px solid ${T.tealLight}`,
    }}>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>{formatDateFull(d.date)}</div>
      {d.weight && <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Peso: {d.weight} kg</div>}
      {d.trend && <div style={{ fontSize: 12, color: T.teal, fontWeight: 600 }}>Trend: {d.trend} kg</div>}
    </div>
  );
};

const ComingSoonScreen = ({ icon: Icon, title, description, features, color }) => (
  <div style={{ padding: "40px 20px", textAlign: "center" }}>
    <div style={{
      width: 80, height: 80, borderRadius: 24, background: `${color}12`,
      display: "flex", alignItems: "center", justifyContent: "center",
      margin: "0 auto 20px",
    }}>
      <Icon size={36} color={color} />
    </div>
    <h2 style={{ fontSize: 24, fontWeight: 800, color: T.text, marginBottom: 8 }}>{title}</h2>
    <p style={{ fontSize: 14, color: T.textSec, marginBottom: 32, lineHeight: 1.6, maxWidth: 300, margin: "0 auto 32px" }}>
      {description}
    </p>
    <div style={{ textAlign: "left", maxWidth: 320, margin: "0 auto" }}>
      {features.map((f, i) => (
        <div key={i} style={{
          background: T.card, borderRadius: 14, padding: "14px 16px", marginBottom: 10,
          boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: `${color}12`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <f.icon size={16} color={color} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{f.title}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>{f.desc}</div>
          </div>
        </div>
      ))}
    </div>
    <div style={{
      marginTop: 32, padding: "14px 24px", borderRadius: 14,
      background: `${color}10`, display: "inline-block",
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>In arrivo nella prossima versione</span>
    </div>
  </div>
);

/* ═══════════════════════════════════════════
   BOTTOM NAVIGATION
   ═══════════════════════════════════════════ */

const BottomNav = ({ active, onNavigate, onAdd }) => {
  const tabs = [
    { id: "dashboard", icon: Home, label: "Home" },
    { id: "food", icon: Utensils, label: "Cibo" },
    { id: "add", icon: Plus, label: "" },
    { id: "fitness", icon: Dumbbell, label: "Fitness" },
    { id: "profile", icon: User, label: "Profilo" },
  ];

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: T.card, borderTop: `1px solid ${T.border}`,
      display: "flex", justifyContent: "space-around", alignItems: "flex-end",
      padding: "6px 8px 22px", zIndex: 20,
      boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
    }}>
      {tabs.map(tab => {
        if (tab.id === "add") {
          return (
            <button key="add" onClick={onAdd} style={{
              width: 54, height: 54, borderRadius: "50%", border: "none",
              background: T.gradient, color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 24px rgba(2,128,144,0.35)",
              transform: "translateY(-14px)", transition: "transform 0.2s",
            }}>
              <Plus size={26} strokeWidth={2.5} />
            </button>
          );
        }
        const isActive = active === tab.id;
        return (
          <button key={tab.id} onClick={() => onNavigate(tab.id)} style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            padding: "6px 14px", opacity: isActive ? 1 : 0.5,
            transition: "opacity 0.2s",
          }}>
            <tab.icon size={21} color={isActive ? T.teal : T.textSec} strokeWidth={isActive ? 2.3 : 1.8} />
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.2,
              color: isActive ? T.teal : T.textSec,
            }}>{tab.label}</span>
            {isActive && <div style={{
              width: 4, height: 4, borderRadius: 2, background: T.teal, marginTop: -1,
            }} />}
          </button>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════ */

export default function WeightTrackerApp() {
  const [entries, setEntries] = useState(generateSampleData);
  const [screen, setScreen] = useState("dashboard");
  const [settings, setSettings] = useState({
    height: 175, goalWeight: 78, startWeight: 85.5, name: "Davide",
  });
  const [newWeight, setNewWeight] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newDate, setNewDate] = useState(today());
  const [chartRange, setChartRange] = useState("1M");
  const [editingEntry, setEditingEntry] = useState(null);
  const [editWeight, setEditWeight] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState(null);

  // Derived data
  const sorted = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)), [entries]);
  const smoothed = useMemo(() => calcEMA(sorted), [sorted]);

  const chartData = useMemo(() => {
    const now = new Date();
    const cutoff = new Date();
    if (chartRange === "1W") cutoff.setDate(now.getDate() - 7);
    else if (chartRange === "1M") cutoff.setDate(now.getDate() - 30);
    else if (chartRange === "3M") cutoff.setMonth(now.getMonth() - 3);
    else if (chartRange === "6M") cutoff.setMonth(now.getMonth() - 6);
    else cutoff.setFullYear(2000);
    return smoothed.filter(e => new Date(e.date) >= cutoff).map(e => ({ ...e, dateLabel: formatDate(e.date) }));
  }, [smoothed, chartRange]);

  const metrics = useMemo(() => {
    if (sorted.length === 0) return {};
    const latest = sorted[sorted.length - 1];
    const latestSmoothed = smoothed[smoothed.length - 1];
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekEntries = sorted.filter(e => new Date(e.date) >= weekAgo);
    const weekChange = weekEntries.length >= 2
      ? Math.round((weekEntries[weekEntries.length - 1].weight - weekEntries[0].weight) * 100) / 100 : null;
    const bmi = calcBMI(latest.weight, settings.height);

    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      const check = toISO(d);
      if (sorted.some(e => e.date === check)) { streak++; d.setDate(d.getDate() - 1); }
      else if (i === 0) { d.setDate(d.getDate() - 1); }
      else break;
    }

    const recent = smoothed.slice(-14);
    const reg = linearRegression(recent);
    let predictedDate = null;
    if (reg && reg.slope < 0 && settings.goalWeight) {
      const daysToGoal = (settings.goalWeight - (reg.intercept + reg.slope * (recent.length - 1))) / reg.slope;
      if (daysToGoal > 0 && daysToGoal < 365) {
        const pd = new Date(); pd.setDate(pd.getDate() + Math.round(daysToGoal));
        predictedDate = formatDateFull(pd);
      }
    }
    const weeklyRate = reg ? Math.round(reg.slope * 7 * 100) / 100 : null;

    return {
      current: latest.weight, trend: latestSmoothed?.trend, weekChange, bmi, streak,
      predictedDate, weeklyRate,
      totalChange: Math.round((latest.weight - sorted[0].weight) * 100) / 100,
      totalEntries: sorted.length,
    };
  }, [sorted, smoothed, settings]);

  const weightDomain = useMemo(() => {
    if (chartData.length === 0) return [60, 90];
    const weights = chartData.flatMap(d => [d.weight, d.trend].filter(Boolean));
    return [Math.floor(Math.min(...weights) - 1), Math.ceil(Math.max(...weights) + 1)];
  }, [chartData]);

  // Handlers
  const addEntry = () => {
    const w = parseFloat(newWeight.replace(",", "."));
    if (isNaN(w) || w < 20 || w > 300) return;
    const existing = entries.findIndex(e => e.date === newDate);
    if (existing >= 0) {
      const updated = [...entries];
      updated[existing] = { ...updated[existing], weight: w, note: newNote };
      setEntries(updated);
    } else {
      setEntries([...entries, { id: Date.now(), date: newDate, weight: w, note: newNote }]);
    }
    setNewWeight(""); setNewNote(""); setNewDate(today());
    setScreen("dashboard");
  };

  const deleteEntry = (id) => { setEntries(entries.filter(e => e.id !== id)); setShowConfirmDelete(null); };

  const goTo = useCallback((s) => { setScreen(s); setShowConfirmDelete(null); setEditingEntry(null); }, []);

  // Active tab for bottom nav
  const activeTab = ["dashboard", "food", "fitness", "profile"].includes(screen) ? screen : "dashboard";

  /* ═══════════════════════════════════════
     SCREEN: ADD WEIGHT
     ═══════════════════════════════════════ */
  if (screen === "add") {
    const w = parseFloat(newWeight.replace(",", "."));
    const valid = !isNaN(w) && w >= 20 && w <= 300;
    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <Header title="Nuovo Peso" showBack onBack={() => goTo("dashboard")} />
        <div style={{ padding: "20px 20px 100px" }}>
          <div style={{
            background: T.card, borderRadius: 24, padding: "36px 24px", textAlign: "center",
            boxShadow: T.shadowLg, marginBottom: 16,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: `${T.teal}12`,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <Scale size={26} color={T.teal} />
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 20, fontWeight: 600 }}>Quanto pesi oggi?</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <input
                type="number" inputMode="decimal" step="0.1" value={newWeight}
                onChange={e => setNewWeight(e.target.value)} placeholder="0.0" autoFocus
                style={{
                  fontSize: 60, fontWeight: 800, color: T.text, border: "none", outline: "none",
                  width: 180, textAlign: "center", background: "transparent",
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              />
              <span style={{ fontSize: 22, color: T.textMuted, fontWeight: 600 }}>kg</span>
            </div>
            {metrics.current && newWeight && valid && (
              <div style={{
                fontSize: 14, fontWeight: 700, marginTop: 12, padding: "6px 16px",
                borderRadius: 20, display: "inline-block",
                background: w < metrics.current ? "#02C39A15" : w > metrics.current ? "#E85D4E15" : "#F0F0F0",
                color: w < metrics.current ? T.mint : w > metrics.current ? T.coral : T.textSec,
              }}>
                {w < metrics.current ? <ArrowDown size={14} style={{ verticalAlign: -2 }} /> :
                 w > metrics.current ? <ArrowUp size={14} style={{ verticalAlign: -2 }} /> :
                 <Minus size={14} style={{ verticalAlign: -2 }} />}
                {" "}{Math.abs(Math.round((w - metrics.current) * 100) / 100)} kg
              </div>
            )}
          </div>

          <div style={{
            background: T.card, borderRadius: 16, padding: "14px 18px",
            boxShadow: T.shadow, marginBottom: 10,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <Calendar size={18} color={T.teal} />
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              style={{
                flex: 1, border: "none", outline: "none", fontSize: 15, color: T.text,
                fontFamily: "'Inter', sans-serif", background: "transparent",
              }}
            />
          </div>

          <div style={{
            background: T.card, borderRadius: 16, padding: "14px 18px",
            boxShadow: T.shadow, marginBottom: 28,
          }}>
            <input type="text" value={newNote} onChange={e => setNewNote(e.target.value)}
              placeholder="Aggiungi una nota (opzionale)"
              style={{
                width: "100%", border: "none", outline: "none", fontSize: 15, color: T.text,
                fontFamily: "'Inter', sans-serif", background: "transparent",
              }}
            />
          </div>

          <button onClick={addEntry} disabled={!valid} style={{
            width: "100%", padding: "17px", borderRadius: 16, border: "none",
            background: valid ? T.gradient : "#D1D5DB",
            color: "#fff", fontSize: 17, fontWeight: 800, cursor: valid ? "pointer" : "default",
            boxShadow: valid ? "0 4px 24px rgba(2,128,144,0.3)" : "none",
            letterSpacing: 0.3, transition: "all 0.2s",
          }}>
            Salva Peso
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     SCREEN: HISTORY
     ═══════════════════════════════════════ */
  if (screen === "history") {
    const reversed = [...sorted].reverse();
    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <Header title="Cronologia" subtitle="Peso" showBack onBack={() => goTo("dashboard")} />
        <div style={{ padding: "8px 20px 100px" }}>
          <div style={{
            fontSize: 12, color: T.textMuted, marginBottom: 14, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Clock size={13} /> {sorted.length} registrazioni
          </div>
          {reversed.map((entry, idx) => {
            const prev = idx < reversed.length - 1 ? reversed[idx + 1] : null;
            const diff = prev ? Math.round((entry.weight - prev.weight) * 100) / 100 : null;
            return (
              <div key={entry.id} style={{
                background: T.card, borderRadius: 14, padding: "14px 16px", marginBottom: 8,
                boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginBottom: 3 }}>
                    {formatDateFull(entry.date)}
                  </div>
                  {editingEntry === entry.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input type="number" inputMode="decimal" step="0.1" value={editWeight}
                        onChange={e => setEditWeight(e.target.value)}
                        style={{
                          fontSize: 17, fontWeight: 700, width: 80,
                          border: `2px solid ${T.teal}`, borderRadius: 10, padding: "3px 8px", outline: "none",
                        }}
                      />
                      <button onClick={() => {
                        const w = parseFloat(editWeight.replace(",", "."));
                        if (!isNaN(w) && w >= 20 && w <= 300)
                          setEntries(entries.map(e => e.id === entry.id ? { ...e, weight: w } : e));
                        setEditingEntry(null);
                      }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                        <Check size={18} color={T.mint} />
                      </button>
                      <button onClick={() => setEditingEntry(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                        <X size={18} color={T.coral} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{entry.weight}</span>
                      <span style={{ fontSize: 13, color: T.textSec }}>kg</span>
                      {diff !== null && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, marginLeft: 6, padding: "2px 8px", borderRadius: 8,
                          background: diff < 0 ? "#02C39A15" : diff > 0 ? "#E85D4E15" : "#F0F0F0",
                          color: diff < 0 ? T.mint : diff > 0 ? T.coral : T.textSec,
                        }}>
                          {diff > 0 ? "+" : ""}{diff}
                        </span>
                      )}
                    </div>
                  )}
                  {entry.note && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{entry.note}</div>}
                </div>
                <div style={{ display: "flex", gap: 2 }}>
                  <button onClick={() => { setEditingEntry(entry.id); setEditWeight(String(entry.weight)); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                    <Edit3 size={15} color={T.teal} />
                  </button>
                  {showConfirmDelete === entry.id ? (
                    <button onClick={() => deleteEntry(entry.id)} style={{
                      background: "#FEE2E2", border: "none", borderRadius: 8, cursor: "pointer",
                      padding: "4px 10px", fontSize: 11, color: T.coral, fontWeight: 700,
                    }}>Elimina</button>
                  ) : (
                    <button onClick={() => setShowConfirmDelete(entry.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                      <Trash2 size={15} color="#D1D5DB" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     SCREEN: FOOD (Coming Soon)
     ═══════════════════════════════════════ */
  if (screen === "food") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <Header title="Alimentazione" subtitle="Tracciamento" />
        <ComingSoonScreen
          icon={Utensils} title="Traccia la tua Alimentazione" color={T.coral}
          description="Monitora calorie e macronutrienti per avere un quadro completo del tuo percorso."
          features={[
            { icon: Zap, title: "Calorie Giornaliere", desc: "Budget calorico personalizzato" },
            { icon: Activity, title: "Macro Tracking", desc: "Proteine, carboidrati e grassi" },
            { icon: Clock, title: "Pasti & Snack", desc: "Registra colazione, pranzo, cena" },
            { icon: Droplets, title: "Idratazione", desc: "Traccia l'acqua bevuta ogni giorno" },
          ]}
        />
        <BottomNav active="food" onNavigate={goTo} onAdd={() => goTo("add")} />
      </div>
    );
  }

  /* ═══════════════════════════════════════
     SCREEN: FITNESS (Coming Soon)
     ═══════════════════════════════════════ */
  if (screen === "fitness") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <Header title="Fitness" subtitle="Attività" />
        <ComingSoonScreen
          icon={Dumbbell} title="Traccia il tuo Allenamento" color={T.purple}
          description="Registra camminate, sessioni in palestra e monitora i tuoi progressi fitness."
          features={[
            { icon: Activity, title: "Camminata & Corsa", desc: "Passi, distanza e calorie bruciate" },
            { icon: Dumbbell, title: "Palestra", desc: "Esercizi, serie, ripetizioni e carichi" },
            { icon: Flame, title: "Calorie Bruciate", desc: "Stima automatica per attività" },
            { icon: TrendingUp, title: "Progressi Forza", desc: "Traccia i tuoi personal record" },
          ]}
        />
        <BottomNav active="fitness" onNavigate={goTo} onAdd={() => goTo("add")} />
      </div>
    );
  }

  /* ═══════════════════════════════════════
     SCREEN: PROFILE / SETTINGS
     ═══════════════════════════════════════ */
  if (screen === "profile") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif", paddingBottom: 100 }}>
        <Header title="Profilo" subtitle="Impostazioni" />
        <div style={{ padding: "16px 20px" }}>
          {/* Profile card */}
          <div style={{
            background: T.gradient, borderRadius: 20, padding: "24px 20px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 16,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <User size={28} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{settings.name}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 500, marginTop: 2 }}>
                {metrics.totalEntries || 0} registrazioni  |  {metrics.streak || 0} giorni di streak
              </div>
            </div>
          </div>

          {/* Settings fields */}
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginTop: 8 }}>
            Dati personali
          </div>
          {[
            { label: "Nome", key: "name", type: "text", unit: "", icon: User },
            { label: "Altezza", key: "height", type: "number", unit: "cm", icon: Activity },
          ].map(({ label, key, type, unit, icon: Ic }) => (
            <div key={key} style={{
              background: T.card, borderRadius: 14, padding: "12px 16px", marginBottom: 8,
              boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: `${T.teal}10`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Ic size={16} color={T.teal} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{label}</div>
                <input type={type} inputMode={type === "number" ? "decimal" : "text"}
                  value={settings[key]}
                  onChange={e => setSettings({ ...settings, [key]: type === "number" ? parseFloat(e.target.value) || "" : e.target.value })}
                  style={{
                    border: "none", outline: "none", fontSize: 16, fontWeight: 700,
                    color: T.text, fontFamily: "'Inter', sans-serif", background: "transparent", width: "100%",
                  }}
                />
              </div>
              {unit && <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500 }}>{unit}</span>}
            </div>
          ))}

          <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginTop: 20 }}>
            Obiettivi
          </div>
          {[
            { label: "Peso iniziale", key: "startWeight", unit: "kg", icon: Scale },
            { label: "Peso obiettivo", key: "goalWeight", unit: "kg", icon: Target },
          ].map(({ label, key, unit, icon: Ic }) => (
            <div key={key} style={{
              background: T.card, borderRadius: 14, padding: "12px 16px", marginBottom: 8,
              boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: `${T.mint}10`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Ic size={16} color={T.mint} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{label}</div>
                <input type="number" inputMode="decimal"
                  value={settings[key]}
                  onChange={e => setSettings({ ...settings, [key]: parseFloat(e.target.value) || "" })}
                  style={{
                    border: "none", outline: "none", fontSize: 16, fontWeight: 700,
                    color: T.text, fontFamily: "'Inter', sans-serif", background: "transparent", width: "100%",
                  }}
                />
              </div>
              <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500 }}>{unit}</span>
            </div>
          ))}

          {/* Stats summary */}
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginTop: 20 }}>
            Riepilogo
          </div>
          <div style={{
            background: T.card, borderRadius: 14, padding: "16px", boxShadow: T.shadow,
          }}>
            {[
              { label: "Peso attuale", value: `${metrics.current || "—"} kg` },
              { label: "BMI", value: metrics.bmi ? `${metrics.bmi} (${bmiCategory(metrics.bmi)})` : "—" },
              { label: "Variazione totale", value: metrics.totalChange ? `${metrics.totalChange > 0 ? "+" : ""}${metrics.totalChange} kg` : "—" },
              { label: "Ritmo settimanale", value: metrics.weeklyRate ? `${metrics.weeklyRate > 0 ? "+" : ""}${metrics.weeklyRate} kg/sett` : "—" },
            ].map((item, i, arr) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", padding: "10px 0",
                borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none",
              }}>
                <span style={{ fontSize: 13, color: T.textSec }}>{item.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{item.value}</span>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 24, padding: "14px 16px", borderRadius: 14,
            background: T.tealLight, textAlign: "center",
          }}>
            <div style={{ fontSize: 12, color: T.teal, fontWeight: 600 }}>
              Weight Tracker v1.0 — I tuoi dati restano sul tuo dispositivo
            </div>
          </div>
        </div>
        <BottomNav active="profile" onNavigate={goTo} onAdd={() => goTo("add")} />
      </div>
    );
  }

  /* ═══════════════════════════════════════
     DASHBOARD HELPERS
     ═══════════════════════════════════════ */

  // Compute period comparisons
  const comparisons = useMemo(() => {
    const weekChg = periodChange(sorted, 7);
    const monthChg = periodChange(sorted, 30);
    const avgThisWeek = periodAvg(sorted, 7);
    const avgLastWeek = (() => {
      const from = new Date(); from.setDate(from.getDate() - 14);
      const to = new Date(); to.setDate(to.getDate() - 7);
      const f = sorted.filter(e => { const d = new Date(e.date); return d >= from && d < to; });
      return f.length ? Math.round((f.reduce((s, e) => s + e.weight, 0) / f.length) * 100) / 100 : null;
    })();
    const avgThisMonth = periodAvg(sorted, 30);
    const avgLastMonth = (() => {
      const from = new Date(); from.setDate(from.getDate() - 60);
      const to = new Date(); to.setDate(to.getDate() - 30);
      const f = sorted.filter(e => { const d = new Date(e.date); return d >= from && d < to; });
      return f.length ? Math.round((f.reduce((s, e) => s + e.weight, 0) / f.length) * 100) / 100 : null;
    })();
    return { weekChg, monthChg, avgThisWeek, avgLastWeek, avgThisMonth, avgLastMonth };
  }, [sorted]);

  // Smart summary message
  const summaryMessage = useMemo(() => {
    if (sorted.length < 3) return { text: "Inizia a registrare il tuo peso ogni giorno per vedere i tuoi progressi qui.", mood: "neutral" };
    const wc = comparisons.weekChg;
    const goal = settings.goalWeight;
    const current = metrics.current;
    const losing = goal && current > goal;

    if (wc === null) return { text: "Continua a registrare per calcolare i confronti settimanali.", mood: "neutral" };
    if (losing && wc < -0.3) return { text: `Ottimo lavoro! Questa settimana hai perso ${Math.abs(wc)} kg rispetto alla precedente. Stai andando alla grande.`, mood: "great" };
    if (losing && wc < 0) return { text: `Questa settimana hai perso ${Math.abs(wc)} kg rispetto alla precedente. Stai andando nella direzione giusta, continua cos\u00ec.`, mood: "good" };
    if (losing && wc === 0) return { text: "Il tuo peso \u00e8 stabile rispetto alla settimana scorsa. A volte il corpo ha bisogno di una pausa prima di scendere ancora.", mood: "neutral" };
    if (losing && wc > 0) return { text: `Questa settimana hai preso ${wc} kg rispetto alla precedente. \u00c8 normale avere oscillazioni, guarda il trend a lungo termine.`, mood: "attention" };
    if (!losing && wc > 0.3) return { text: `Ottimo! Questa settimana hai preso ${wc} kg rispetto alla precedente, in linea con il tuo obiettivo.`, mood: "great" };
    return { text: `Variazione settimanale: ${wc > 0 ? "+" : ""}${wc} kg. Continua a tracciare per avere dati pi\u00f9 precisi.`, mood: "neutral" };
  }, [sorted, comparisons, metrics, settings]);

  const moodColors = { great: T.mint, good: T.teal, neutral: T.textSec, attention: T.gold };
  const moodIcons = { great: Award, good: TrendingDown, neutral: Activity, attention: ArrowUp };
  const SummaryIcon = moodIcons[summaryMessage.mood] || Activity;

  /* ═══════════════════════════════════════
     SCREEN: DASHBOARD (Default)
     ═══════════════════════════════════════ */
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <Header title="Dashboard" subtitle={`Ciao, ${settings.name}`}
        right={
          <button onClick={() => goTo("profile")} style={{
            background: T.card, border: "none", borderRadius: 12, padding: 10,
            cursor: "pointer", boxShadow: T.shadow,
          }}>
            <Settings size={20} color={T.teal} />
          </button>
        }
      />

      <div style={{ padding: "8px 20px 120px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ── 1. SMART SUMMARY ── */}
        <div style={{
          background: T.card, borderRadius: 20, padding: "18px 20px",
          boxShadow: T.shadow, borderLeft: `4px solid ${moodColors[summaryMessage.mood]}`,
        }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: `${moodColors[summaryMessage.mood]}15`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <SummaryIcon size={20} color={moodColors[summaryMessage.mood]} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
                Il tuo riepilogo
              </div>
              <div style={{ fontSize: 14, color: T.text, lineHeight: 1.55, fontWeight: 500 }}>
                {summaryMessage.text}
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. WEIGHT & GOAL OVERVIEW ── */}
        <div style={{
          background: T.gradient, borderRadius: 20, padding: "22px 20px",
          boxShadow: "0 4px 24px rgba(2,128,144,0.2)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Peso attuale</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 38, fontWeight: 800, color: "#fff" }}>{metrics.current || "—"}</span>
                <span style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>kg</span>
              </div>
              {metrics.trend && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4, fontWeight: 500 }}>
                  Trend reale: {metrics.trend} kg
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Obiettivo</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4, justifyContent: "flex-end" }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{settings.goalWeight || "—"}</span>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>kg</span>
              </div>
              {metrics.current && settings.goalWeight && (
                <div style={{
                  fontSize: 12, fontWeight: 700, color: "#fff", marginTop: 6,
                  background: "rgba(255,255,255,0.2)", padding: "3px 10px", borderRadius: 8,
                  display: "inline-block",
                }}>
                  {Math.abs(Math.round((metrics.current - settings.goalWeight) * 10) / 10)} kg rimanenti
                </div>
              )}
            </div>
          </div>
          {/* Mini progress bar inside gradient card */}
          {settings.goalWeight && settings.startWeight && metrics.current && (() => {
            const total = Math.abs(settings.startWeight - settings.goalWeight);
            const done = Math.abs(settings.startWeight - metrics.current);
            const pct = total > 0 ? Math.min(Math.max((done / total) * 100, 0), 100) : 0;
            return (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Progresso</span>
                  <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>{Math.round(pct)}%</span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.2)", borderRadius: 3 }}>
                  <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: "#fff", transition: "width 0.6s" }} />
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── 3. PREDICTION (if available) ── */}
        {metrics.predictedDate && (
          <div style={{
            background: T.card, borderRadius: 18, padding: "16px 20px",
            boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 14,
            border: `1px solid ${T.tealLight}`,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14, background: `${T.mint}15`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Target size={20} color={T.mint} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>
                Previsione
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginTop: 2 }}>
                Raggiungerai {settings.goalWeight} kg il {metrics.predictedDate}
              </div>
              {metrics.weeklyRate && (
                <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>
                  Al ritmo attuale di {metrics.weeklyRate > 0 ? "+" : ""}{metrics.weeklyRate} kg/settimana
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 4. CHART ── */}
        <div style={{ background: T.card, borderRadius: 20, padding: "18px 14px 10px", boxShadow: T.shadow }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, padding: "0 4px" }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Andamento Peso</span>
            <div style={{ display: "flex", gap: 4 }}>
              {["1W", "1M", "3M", "6M", "ALL"].map(r => (
                <button key={r} onClick={() => setChartRange(r)} style={{
                  padding: "5px 10px", borderRadius: 8, border: "none", fontSize: 10, fontWeight: 700,
                  background: chartRange === r ? T.teal : T.tealLight,
                  color: chartRange === r ? "#fff" : T.teal,
                  cursor: "pointer", transition: "all 0.2s", letterSpacing: 0.3,
                }}>{r}</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, padding: "0 4px", marginBottom: 10 }}>
            La linea grigia \u00e8 il peso sulla bilancia. La linea teal \u00e8 il trend reale, che filtra le oscillazioni quotidiane.
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 8, left: -15, bottom: 5 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.teal} stopOpacity={0.12} />
                  <stop offset="95%" stopColor={T.teal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8ECEF" vertical={false} />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 9, fill: T.textMuted }} tickLine={false} axisLine={false} />
              <YAxis domain={weightDomain} tick={{ fontSize: 9, fill: T.textMuted }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              {settings.goalWeight && (
                <ReferenceLine y={settings.goalWeight} stroke={T.mint} strokeDasharray="6 4" strokeWidth={1.5} />
              )}
              <Area type="monotone" dataKey="trend" fill="url(#areaGrad)" stroke="none" />
              <Line type="monotone" dataKey="weight" stroke="#C5D0D0" strokeWidth={1.5}
                dot={{ r: 2.5, fill: "#C5D0D0", strokeWidth: 0 }} activeDot={{ r: 5, fill: T.teal }} />
              <Line type="monotone" dataKey="trend" stroke={T.teal} strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>

          <div style={{ display: "flex", gap: 16, justifyContent: "center", padding: "8px 0 2px" }}>
            {[
              { color: "#C5D0D0", label: "Peso bilancia" },
              { color: T.teal, label: "Trend reale" },
              ...(settings.goalWeight ? [{ color: T.mint, label: "Obiettivo", dashed: true }] : []),
            ].map((l, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 12, height: 3, borderRadius: 2, background: l.color, ...(l.dashed ? { borderTop: "1px dashed" } : {}) }} />
                <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 500 }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 5. CONFRONTI TEMPORALI ── */}
        <div style={{ background: T.card, borderRadius: 20, padding: "18px 20px", boxShadow: T.shadow }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 4 }}>Confronti</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 14 }}>
            Come sta andando rispetto ai periodi precedenti
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            {/* This week vs last week */}
            <div style={{ flex: 1, background: T.bg, borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8 }}>
                Settimana
              </div>
              {comparisons.avgThisWeek && comparisons.avgLastWeek ? (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{comparisons.avgThisWeek}</span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>kg media</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>
                    vs {comparisons.avgLastWeek} kg sett. scorsa
                  </div>
                  {comparisons.weekChg !== null && (
                    <div style={{
                      fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 8, display: "inline-block",
                      background: comparisons.weekChg <= 0 ? "#02C39A15" : "#E85D4E15",
                      color: comparisons.weekChg <= 0 ? T.mint : T.coral,
                    }}>
                      {comparisons.weekChg > 0 ? "+" : ""}{comparisons.weekChg} kg
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 12, color: T.textMuted }}>Servono almeno 2 settimane di dati</div>
              )}
            </div>

            {/* This month vs last month */}
            <div style={{ flex: 1, background: T.bg, borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8 }}>
                Mese
              </div>
              {comparisons.avgThisMonth && comparisons.avgLastMonth ? (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{comparisons.avgThisMonth}</span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>kg media</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>
                    vs {comparisons.avgLastMonth} kg mese scorso
                  </div>
                  {comparisons.monthChg !== null && (
                    <div style={{
                      fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 8, display: "inline-block",
                      background: comparisons.monthChg <= 0 ? "#02C39A15" : "#E85D4E15",
                      color: comparisons.monthChg <= 0 ? T.mint : T.coral,
                    }}>
                      {comparisons.monthChg > 0 ? "+" : ""}{comparisons.monthChg} kg
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 12, color: T.textMuted }}>Servono almeno 2 mesi di dati</div>
              )}
            </div>
          </div>

          {/* Extra stats row */}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {[
              { icon: Flame, label: "Streak", value: `${metrics.streak || 0} gg`, color: T.gold },
              { icon: Activity, label: "BMI", value: metrics.bmi ? `${metrics.bmi}` : "—", sub: bmiCategory(metrics.bmi), color: bmiColor(metrics.bmi) },
              { icon: TrendingDown, label: "Ritmo", value: metrics.weeklyRate ? `${metrics.weeklyRate > 0 ? "+" : ""}${metrics.weeklyRate}` : "—", sub: "kg/sett", color: metrics.weeklyRate <= 0 ? T.mint : T.coral },
            ].map((item, i) => (
              <div key={i} style={{
                flex: 1, background: T.bg, borderRadius: 12, padding: "12px",
                textAlign: "center",
              }}>
                <item.icon size={16} color={item.color} style={{ marginBottom: 4 }} />
                <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{item.value}</div>
                {item.sub && <div style={{ fontSize: 9, color: item.color, fontWeight: 600, marginTop: 1 }}>{item.sub}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* ── 6. RECENT ENTRIES ── */}
        <div style={{ background: T.card, borderRadius: 20, padding: "16px 18px", boxShadow: T.shadow }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Ultime Registrazioni</span>
            <button onClick={() => goTo("history")} style={{
              background: T.tealLight, border: "none", fontSize: 11, color: T.teal,
              fontWeight: 700, cursor: "pointer", padding: "5px 12px", borderRadius: 8,
              display: "flex", alignItems: "center", gap: 3,
            }}>
              Tutte <ChevronRight size={13} />
            </button>
          </div>
          {[...sorted].reverse().slice(0, 5).map((entry, idx) => {
            const prev = idx < [...sorted].reverse().length - 1 ? [...sorted].reverse()[idx + 1] : null;
            const diff = prev ? Math.round((entry.weight - prev.weight) * 100) / 100 : null;
            return (
              <div key={entry.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "11px 0", borderBottom: idx < 4 ? `1px solid ${T.border}` : "none",
              }}>
                <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>{formatDate(entry.date)}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {diff !== null && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6,
                      background: diff < 0 ? "#02C39A12" : diff > 0 ? "#E85D4E12" : "transparent",
                      color: diff < 0 ? T.mint : diff > 0 ? T.coral : T.textMuted,
                    }}>
                      {diff > 0 ? "+" : ""}{diff}
                    </span>
                  )}
                  <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{entry.weight} kg</span>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      <BottomNav active="dashboard" onNavigate={goTo} onAdd={() => goTo("add")} />
    </div>
  );
}
