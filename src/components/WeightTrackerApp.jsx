import { useState, useMemo, useCallback, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart, ReferenceArea
} from "recharts";
import {
  Scale, Target, TrendingDown, TrendingUp, Calendar, Plus,
  ChevronLeft, Settings, Trash2, Award, Flame, ArrowDown,
  ArrowUp, Minus, Edit3, Check, X, Home, Utensils, Dumbbell,
  User, ChevronRight, Clock, Droplets, Zap, Activity,
  Sun, Moon, Sunrise, Star, Heart, BarChart3, AlertCircle,
  Sparkles, Trophy, CheckCircle2, Info
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

// Time-based greeting
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 6) return { text: "Buonanotte", icon: Moon };
  if (h < 12) return { text: "Buongiorno", icon: Sunrise };
  if (h < 18) return { text: "Buon pomeriggio", icon: Sun };
  return { text: "Buonasera", icon: Moon };
};

const getDayName = (dateStr) => {
  return new Date(dateStr).toLocaleDateString("it-IT", { weekday: "short" });
};

// Get trend EMA value at a specific date with linear interpolation if missing
const getTrendAtDate = (smoothedEntries, dateStr) => {
  if (!smoothedEntries || smoothedEntries.length === 0) return null;
  const exact = smoothedEntries.find(e => e.date === dateStr);
  if (exact) return exact.trend;

  const target = new Date(dateStr).getTime();
  const sorted = [...smoothedEntries].sort((a, b) => a.date.localeCompare(b.date));

  let before = null, after = null;
  for (const e of sorted) {
    const t = new Date(e.date).getTime();
    if (t < target) before = e;
    if (t > target && !after) after = e;
  }

  if (!before || !after) return null;
  const bTime = new Date(before.date).getTime();
  const aTime = new Date(after.date).getTime();
  const ratio = (target - bTime) / (aTime - bTime);
  return Math.round((before.trend + ratio * (after.trend - before.trend)) * 100) / 100;
};

// Get ISO dates of last N Mondays (index 0 = most recent Monday)
const getMondays = (n = 4) => {
  const mondays = [];
  const d = new Date();
  const dayOfWeek = d.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  for (let i = 0; i < n; i++) {
    const monday = new Date(d);
    monday.setDate(d.getDate() - daysToMonday - i * 7);
    mondays.push(toISO(monday));
  }
  return mondays;
};

// Get ISO dates of 1st of last N months (index 0 = this month)
const getFirstOfMonths = (n = 4) => {
  const firsts = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const first = new Date(d.getFullYear(), d.getMonth() - i, 1);
    firsts.push(toISO(first));
  }
  return firsts;
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
  gradientWarm: "linear-gradient(135deg, #F0B429, #E85D4E)",
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

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{
      background: T.card, borderRadius: 12, padding: "10px 14px",
      boxShadow: T.shadowLg, border: `1px solid ${T.tealLight}`,
    }}>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>{formatDateFull(d.date)}</div>
      {d.weight != null && <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Peso: {d.weight} kg</div>}
      {d.trend != null && <div style={{ fontSize: 12, color: T.teal, fontWeight: 600 }}>Trend: {d.trend} kg</div>}
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

// Info popup (centered modal)
const InfoPopup = ({ show, onClose, title, children }) => {
  if (!show) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.card, borderRadius: 20, padding: 24, width: "100%", maxWidth: 340,
          boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{title}</span>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 20, color: T.textMuted, lineHeight: 1, padding: 2,
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};

// Toggle switch component
const Toggle = ({ on, onToggle, label }) => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "9px 0", borderBottom: `1px solid ${T.border}`,
  }}>
    <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{label}</span>
    <button
      onClick={onToggle}
      style={{
        width: 40, height: 22, borderRadius: 11, border: "none",
        background: on ? T.teal : "#D1D5DB",
        position: "relative", cursor: "pointer",
        flexShrink: 0, transition: "background 0.2s",
      }}
    >
      <div style={{
        position: "absolute", top: 2,
        left: on ? 20 : 2,
        width: 18, height: 18, borderRadius: 9, background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        transition: "left 0.2s",
      }} />
    </button>
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
   CIRCULAR PROGRESS COMPONENT
   ═══════════════════════════════════════════ */

const CircularProgress = ({ percentage, size = 64, strokeWidth = 5, color = T.teal }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(percentage, 0), 100) / 100) * circumference;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={`${color}20`} strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease-in-out" }} />
    </svg>
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

  // Dashboard UI state
  const [compTab, setCompTab] = useState("week");
  const [showTrendInfo, setShowTrendInfo] = useState(false);
  const [showPredInfo, setShowPredInfo] = useState(false);
  const [showChartSettings, setShowChartSettings] = useState(false);
  const [chartSettings, setChartSettings] = useState({
    showObjective: true,
    showBMIZones: false,
    showScale: true,
    showTrend: true,
  });

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
    let daysToGoal = null;
    if (reg && reg.slope < 0 && settings.goalWeight) {
      const currentTrendEnd = reg.intercept + reg.slope * (recent.length - 1);
      daysToGoal = (settings.goalWeight - currentTrendEnd) / reg.slope;
      if (daysToGoal > 0 && daysToGoal < 730) {
        const pd = new Date(); pd.setDate(pd.getDate() + Math.round(daysToGoal));
        predictedDate = formatDateFull(pd);
      }
    }
    const weeklyRate = reg ? Math.round(reg.slope * 7 * 100) / 100 : null;
    const weeksToGoal = daysToGoal ? Math.round(daysToGoal / 7) : null;

    const todayEntry = sorted.find(e => e.date === today());
    const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayEntry = sorted.find(e => e.date === toISO(yesterdayDate));
    const vsYesterday = (todayEntry != null && yesterdayEntry != null)
      ? Math.round((todayEntry.weight - yesterdayEntry.weight) * 100) / 100
      : null;

    const totalChange = Math.round((latest.weight - sorted[0].weight) * 100) / 100;

    return {
      current: latest.weight,
      trend: latestSmoothed != null ? latestSmoothed.trend : null,
      bmi,
      streak,
      predictedDate,
      weeklyRate,
      weeksToGoal,
      totalChange,
      totalEntries: sorted.length,
      todayLogged: todayEntry != null,
      vsYesterday,
    };
  }, [sorted, smoothed, settings]);

  const weightDomain = useMemo(() => {
    if (chartData.length === 0) return [60, 90];
    const weights = chartData.flatMap(d => [d.weight, d.trend].filter(v => v != null));
    return [Math.floor(Math.min(...weights) - 1), Math.ceil(Math.max(...weights) + 1)];
  }, [chartData]);

  // BMI zones for chart (weight boundaries based on user height)
  const bmiZones = useMemo(() => {
    if (!settings.height) return [];
    const h = settings.height / 100;
    const h2 = h * h;
    return [
      { name: "Sottopeso", y1: 0, y2: Math.round(18.5 * h2 * 10) / 10, color: "#3B82F6" },
      { name: "Normopeso", y1: Math.round(18.5 * h2 * 10) / 10, y2: Math.round(25 * h2 * 10) / 10, color: "#02C39A" },
      { name: "Sovrappeso", y1: Math.round(25 * h2 * 10) / 10, y2: Math.round(30 * h2 * 10) / 10, color: "#F0B429" },
      { name: "Obesità", y1: Math.round(30 * h2 * 10) / 10, y2: 300, color: "#E85D4E" },
    ];
  }, [settings.height]);

  // Comparisons: trend at Monday (weekly) and 1st of month (monthly)
  const comparisons = useMemo(() => {
    const mondays = getMondays(4);
    const firsts = getFirstOfMonths(4);

    const weeklyData = mondays.map((date, i) => {
      const trend = getTrendAtDate(smoothed, date);
      const prevTrend = i < mondays.length - 1 ? getTrendAtDate(smoothed, mondays[i + 1]) : null;
      const diff = (trend != null && prevTrend != null)
        ? Math.round((trend - prevTrend) * 100) / 100
        : null;
      let label;
      if (i === 0) label = "Questa sett.";
      else if (i === 1) label = "Sett. scorsa";
      else label = `${i} sett. fa`;
      const dateLabel = new Date(date).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
      return { date, dateLabel, trend, diff, label, isCurrent: i === 0 };
    });

    const monthlyData = firsts.map((date, i) => {
      const trend = getTrendAtDate(smoothed, date);
      const prevTrend = i < firsts.length - 1 ? getTrendAtDate(smoothed, firsts[i + 1]) : null;
      const diff = (trend != null && prevTrend != null)
        ? Math.round((trend - prevTrend) * 100) / 100
        : null;
      const d = new Date(date);
      const monthName = d.toLocaleDateString("it-IT", { month: "long" });
      const label = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      const dateLabel = "1 " + d.toLocaleDateString("it-IT", { month: "short" });
      return { date, dateLabel, trend, diff, label, isCurrent: i === 0 };
    });

    return { weeklyData, monthlyData };
  }, [smoothed]);

  // Recent entries with ritmo (weekly trend slope) and diff vs previous
  const recentWithRitmo = useMemo(() => {
    const recent = [...sorted].reverse().slice(0, 5);
    return recent.map((entry, idx) => {
      const smoothedIdx = smoothed.findIndex(e => e.date === entry.date);
      let ritmo = null;
      if (smoothedIdx > 0) {
        const curr = smoothed[smoothedIdx];
        const prev = smoothed[smoothedIdx - 1];
        if (curr != null && prev != null) {
          const daysBetween = Math.max(1, (new Date(curr.date) - new Date(prev.date)) / 86400000);
          ritmo = Math.round((curr.trend - prev.trend) / daysBetween * 7 * 100) / 100;
        }
      }
      const next = idx < recent.length - 1 ? recent[idx + 1] : null;
      const diff = next != null ? Math.round((entry.weight - next.weight) * 100) / 100 : null;
      return { ...entry, ritmo, diff };
    });
  }, [sorted, smoothed]);

  // Handlers
  const addEntry = useCallback(() => {
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
  }, [entries, newWeight, newNote, newDate]);

  const deleteEntry = useCallback((id) => { setEntries(prev => prev.filter(e => e.id !== id)); setShowConfirmDelete(null); }, []);

  const goTo = useCallback((s) => { setScreen(s); setShowConfirmDelete(null); setEditingEntry(null); }, []);

  const activeTab = ["dashboard", "food", "fitness", "profile"].includes(screen) ? screen : "dashboard";

  /* ═══════════════════════════════════════
     SCREEN: ADD WEIGHT
     ═══════════════════════════════════════ */
  if (screen === "add") {
    const w = parseFloat(newWeight.replace(",", "."));
    const valid = !isNaN(w) && w >= 20 && w <= 300;
    const currentWeight = metrics.current;
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
            {currentWeight != null && valid && (
              <div style={{
                fontSize: 14, fontWeight: 700, marginTop: 12, padding: "6px 16px",
                borderRadius: 20, display: "inline-block",
                background: w < currentWeight ? "#02C39A15" : w > currentWeight ? "#E85D4E15" : "#F0F0F0",
                color: w < currentWeight ? T.mint : w > currentWeight ? T.coral : T.textSec,
              }}>
                {w < currentWeight
                  ? <ArrowDown size={14} style={{ verticalAlign: -2 }} />
                  : w > currentWeight
                    ? <ArrowUp size={14} style={{ verticalAlign: -2 }} />
                    : <Minus size={14} style={{ verticalAlign: -2 }} />}
                {" "}{Math.abs(Math.round((w - currentWeight) * 100) / 100)} kg
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
            const diff = prev != null ? Math.round((entry.weight - prev.weight) * 100) / 100 : null;
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
                          setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, weight: w } : e));
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
                      {diff != null && diff !== 0 && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, marginLeft: 6, padding: "2px 8px", borderRadius: 8,
                          background: diff < 0 ? "#02C39A15" : "#E85D4E15",
                          color: diff < 0 ? T.mint : T.coral,
                        }}>
                          {diff > 0 ? "+" : ""}{diff}
                        </span>
                      )}
                    </div>
                  )}
                  {entry.note ? <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{entry.note}</div> : null}
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
                  onChange={e => setSettings(prev => ({ ...prev, [key]: type === "number" ? parseFloat(e.target.value) || "" : e.target.value }))}
                  style={{
                    border: "none", outline: "none", fontSize: 16, fontWeight: 700,
                    color: T.text, fontFamily: "'Inter', sans-serif", background: "transparent", width: "100%",
                  }}
                />
              </div>
              {unit ? <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500 }}>{unit}</span> : null}
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
                  onChange={e => setSettings(prev => ({ ...prev, [key]: parseFloat(e.target.value) || "" }))}
                  style={{
                    border: "none", outline: "none", fontSize: 16, fontWeight: 700,
                    color: T.text, fontFamily: "'Inter', sans-serif", background: "transparent", width: "100%",
                  }}
                />
              </div>
              <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500 }}>{unit}</span>
            </div>
          ))}

          <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginTop: 20 }}>
            Riepilogo
          </div>
          <div style={{ background: T.card, borderRadius: 14, padding: "16px", boxShadow: T.shadow }}>
            {[
              { label: "Peso attuale", value: metrics.current != null ? `${metrics.current} kg` : "—" },
              { label: "BMI", value: metrics.bmi ? `${metrics.bmi} (${bmiCategory(metrics.bmi)})` : "—" },
              { label: "Variazione totale", value: metrics.totalChange != null ? `${metrics.totalChange > 0 ? "+" : ""}${metrics.totalChange} kg` : "—" },
              { label: "Ritmo settimanale", value: metrics.weeklyRate != null ? `${metrics.weeklyRate > 0 ? "+" : ""}${metrics.weeklyRate} kg/sett` : "—" },
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

          <div style={{ marginTop: 24, padding: "14px 16px", borderRadius: 14, background: T.tealLight, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: T.teal, fontWeight: 600 }}>
              Weight Tracker v2.0 — I tuoi dati restano sul tuo dispositivo
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

  // Smart summary using new comparison data (trend-based)
  const weekDiff = comparisons.weeklyData?.[0]?.diff ?? null;
  const summaryMessage = (() => {
    if (sorted.length < 3) return { text: "Inizia a registrare il tuo peso ogni giorno per vedere i tuoi progressi qui.", mood: "neutral" };
    const goal = settings.goalWeight;
    const current = metrics.current;
    const losing = goal != null && current != null && current > goal;

    if (weekDiff == null) return { text: "Continua a registrare per calcolare i confronti settimanali.", mood: "neutral" };
    if (losing && weekDiff < -0.3) return { text: `Ottimo lavoro! Il trend è sceso di ${Math.abs(weekDiff)} kg questa settimana. Stai andando alla grande.`, mood: "great" };
    if (losing && weekDiff < 0) return { text: `Il trend è sceso di ${Math.abs(weekDiff)} kg questa settimana. Stai andando nella direzione giusta, continua così.`, mood: "good" };
    if (losing && weekDiff === 0) return { text: "Il trend è stabile rispetto alla settimana scorsa. A volte il corpo ha bisogno di una pausa prima di scendere ancora.", mood: "neutral" };
    if (losing && weekDiff > 0) return { text: `Il trend è salito di ${weekDiff} kg questa settimana. È normale avere oscillazioni, guarda il trend a lungo termine.`, mood: "attention" };
    if (!losing && weekDiff > 0.3) return { text: `Ottimo! Il trend è salito di ${weekDiff} kg questa settimana, in linea con il tuo obiettivo.`, mood: "great" };
    return { text: `Variazione trend settimanale: ${weekDiff > 0 ? "+" : ""}${weekDiff} kg. Continua a tracciare per dati più precisi.`, mood: "neutral" };
  })();

  const moodColors = { great: T.mint, good: T.teal, neutral: T.textSec, attention: T.gold };
  const moodIcons = { great: Award, good: TrendingDown, neutral: Activity, attention: AlertCircle };
  const SummaryIcon = moodIcons[summaryMessage.mood] || Activity;

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  // Progress percentage
  const progressPct = (() => {
    if (!settings.goalWeight || !settings.startWeight || metrics.current == null) return 0;
    const total = Math.abs(settings.startWeight - settings.goalWeight);
    const done = Math.abs(settings.startWeight - metrics.current);
    return total > 0 ? Math.min(Math.max((done / total) * 100, 0), 100) : 0;
  })();

  const kgMancanti = (metrics.current != null && settings.goalWeight)
    ? Math.abs(Math.round((metrics.current - settings.goalWeight) * 10) / 10)
    : null;

  const kgPersi = (metrics.totalChange != null)
    ? Math.abs(metrics.totalChange)
    : null;

  /* ═══════════════════════════════════════
     SCREEN: DASHBOARD
     ═══════════════════════════════════════ */
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{
        padding: "16px 16px 0", background: T.bg,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 14,
              background: T.gradient,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>
                {(settings.name || "?").charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                <GreetingIcon size={11} /> {greeting.text}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.text, letterSpacing: -0.5 }}>
                {settings.name}
              </div>
            </div>
          </div>
          <button onClick={() => goTo("profile")} style={{
            background: T.card, border: "none", borderRadius: 12, padding: 10,
            cursor: "pointer", boxShadow: T.shadow,
          }}>
            <Settings size={18} color={T.teal} />
          </button>
        </div>
      </div>

      <div style={{ padding: "14px 16px 120px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ── CHECK-IN PROMPT ── */}
        {!metrics.todayLogged && (
          <div
            onClick={() => goTo("add")}
            style={{
              background: `linear-gradient(135deg, ${T.coral}12, ${T.gold}12)`,
              borderRadius: 16, padding: "14px 16px",
              border: `1px dashed ${T.gold}70`,
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 12,
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: `${T.gold}20`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Scale size={20} color={T.gold} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Non ti sei ancora pesato oggi</div>
              <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>Tocca per registrare il peso di oggi</div>
            </div>
            <ChevronRight size={16} color={T.textMuted} />
          </div>
        )}

        {/* ══════════════════════════════════════════
            1. CARD PRINCIPALE
            ══════════════════════════════════════════ */}
        <div style={{
          background: T.gradient, borderRadius: 20, padding: "20px",
          boxShadow: "0 4px 24px rgba(2,128,144,0.2)",
        }}>
          {/* Top row: peso + circular progress */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Peso attuale
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 4 }}>
                <span style={{ fontSize: 38, fontWeight: 900, color: "#fff" }}>
                  {metrics.current != null ? metrics.current : "—"}
                </span>
                <span style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>kg</span>
              </div>

              {/* Trend con info */}
              {metrics.trend != null && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2, fontWeight: 500, display: "flex", alignItems: "center", gap: 3 }}>
                  {"Trend: "}
                  <span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>{metrics.trend} kg</span>
                  <button
                    onClick={() => setShowTrendInfo(true)}
                    style={{
                      width: 15, height: 15, borderRadius: "50%",
                      background: "rgba(255,255,255,0.25)", border: "none",
                      color: "rgba(255,255,255,0.85)", fontSize: 9, fontWeight: 800,
                      cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
                      marginLeft: 2, flexShrink: 0,
                    }}
                  >i</button>
                </div>
              )}

              {/* vs ieri */}
              {metrics.vsYesterday != null && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6,
                  background: "rgba(255,255,255,0.18)", padding: "3px 10px", borderRadius: 8,
                }}>
                  {metrics.vsYesterday < 0
                    ? <ArrowDown size={11} color="#fff" />
                    : metrics.vsYesterday > 0
                      ? <ArrowUp size={11} color="#fff" />
                      : <Minus size={11} color="#fff" />}
                  <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>
                    {Math.abs(metrics.vsYesterday)} kg vs ieri
                  </span>
                </div>
              )}
            </div>

            {/* Circular progress + obiettivo */}
            <div style={{ textAlign: "center" }}>
              <div style={{ position: "relative", width: 76, height: 76 }}>
                <CircularProgress percentage={Math.round(progressPct)} size={76} strokeWidth={5} color="#fff" />
                <div style={{
                  position: "absolute", top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>{Math.round(progressPct)}%</div>
                </div>
              </div>
              {settings.goalWeight ? (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
                    {"Obiettivo "}
                    <strong style={{ color: "rgba(255,255,255,0.9)" }}>{settings.goalWeight} kg</strong>
                  </div>
                  {kgMancanti != null && (
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", fontWeight: 700, marginTop: 2 }}>
                      {"-"}{kgMancanti} kg al traguardo
                    </div>
                  )}
                  {kgPersi != null && (
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: 600, marginTop: 1 }}>
                      {metrics.totalChange != null && metrics.totalChange < 0 ? `-${kgPersi} kg persi` : `+${kgPersi} kg`}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.15)", margin: "14px 0 12px" }} />

          {/* Previsione */}
          {metrics.predictedDate ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                  <Target size={13} color="rgba(255,255,255,0.75)" />
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
                    {"Raggiungerai "}{settings.goalWeight}{" kg il "}
                    <strong style={{ color: "#fff" }}>{metrics.predictedDate}</strong>
                  </span>
                </div>
                <button
                  onClick={() => setShowPredInfo(true)}
                  style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: "rgba(255,255,255,0.25)", border: "none",
                    color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: 800,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, marginLeft: 6,
                  }}
                >i</button>
              </div>
              {metrics.weeklyRate != null && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 4, paddingLeft: 21 }}>
                  {"Al ritmo di "}{metrics.weeklyRate > 0 ? "+" : ""}{metrics.weeklyRate} kg/settimana
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>
              Aggiungi più dati per vedere la previsione
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════
            2. CONFRONTI
            ══════════════════════════════════════════ */}
        <div style={{ background: T.card, borderRadius: 18, padding: "16px", boxShadow: T.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 12 }}>Confronti</div>

          {/* Tab row */}
          <div style={{
            display: "flex", gap: 0, background: "#E8ECEF", borderRadius: 10, padding: 3, marginBottom: 14,
          }}>
            {[["week", "Settimane"], ["month", "Mesi"]].map(([key, label]) => (
              <button key={key} onClick={() => setCompTab(key)} style={{
                flex: 1, padding: "7px 0", border: "none", borderRadius: 8,
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: compTab === key ? "#fff" : "transparent",
                color: compTab === key ? T.teal : T.textMuted,
                boxShadow: compTab === key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.2s", fontFamily: "'Inter', sans-serif",
              }}>{label}</button>
            ))}
          </div>

          {/* SETTIMANE */}
          {compTab === "week" && (
            <div>
              {comparisons.weeklyData.slice(0, 3).map((w, i) => (
                <div key={w.date} style={{
                  background: T.card, borderRadius: 14, padding: "14px 16px",
                  boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: 8,
                  borderLeft: w.isCurrent ? `3px solid ${T.teal}` : "3px solid transparent",
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>
                      {w.label}
                    </div>
                    {w.trend != null ? (
                      <>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 3 }}>
                          <span style={{ fontSize: 20, fontWeight: 900, color: T.text }}>{w.trend}</span>
                          <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>kg trend</span>
                        </div>
                        <div style={{ fontSize: 9, color: T.textMuted, marginTop: 1 }}>{w.dateLabel}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Dati non disponibili</div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {w.diff != null ? (
                      <div style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8,
                        display: "inline-flex", alignItems: "center", gap: 3,
                        background: w.diff <= 0 ? "#02C39A12" : "#E85D4E12",
                        color: w.diff <= 0 ? T.mint : T.coral,
                      }}>
                        {w.diff <= 0 ? "↓" : "↑"}
                        {" "}{w.diff > 0 ? "+" : ""}{w.diff} kg
                      </div>
                    ) : i === comparisons.weeklyData.slice(0, 3).length - 1 ? (
                      <div style={{
                        fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 8,
                        background: "#F0F0F0", color: T.textMuted,
                      }}>Prima sett.</div>
                    ) : null}
                  </div>
                </div>
              ))}
              <button
                onClick={() => goTo("history")}
                style={{
                  width: "100%", padding: "10px", border: `1px dashed ${T.border}`, borderRadius: 12,
                  background: "transparent", fontSize: 12, fontWeight: 700, color: T.teal,
                  cursor: "pointer", fontFamily: "'Inter', sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  marginTop: 2,
                }}
              >
                Vedi tutte le settimane <ChevronRight size={13} />
              </button>
            </div>
          )}

          {/* MESI */}
          {compTab === "month" && (
            <div>
              {comparisons.monthlyData.slice(0, 3).map((m, i) => (
                <div key={m.date} style={{
                  background: T.card, borderRadius: 14, padding: "14px 16px",
                  boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: 8,
                  borderLeft: m.isCurrent ? `3px solid ${T.teal}` : "3px solid transparent",
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>
                      {m.label}
                    </div>
                    {m.trend != null ? (
                      <>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 3 }}>
                          <span style={{ fontSize: 20, fontWeight: 900, color: T.text }}>{m.trend}</span>
                          <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>kg trend</span>
                        </div>
                        <div style={{ fontSize: 9, color: T.textMuted, marginTop: 1 }}>{m.dateLabel}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Dati non disponibili</div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {m.diff != null ? (
                      <div style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8,
                        display: "inline-flex", alignItems: "center", gap: 3,
                        background: m.diff <= 0 ? "#02C39A12" : "#E85D4E12",
                        color: m.diff <= 0 ? T.mint : T.coral,
                      }}>
                        {m.diff <= 0 ? "↓" : "↑"}
                        {" "}{m.diff > 0 ? "+" : ""}{m.diff} kg
                      </div>
                    ) : (
                      <div style={{
                        fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 8,
                        background: "#F0F0F0", color: T.textMuted,
                      }}>Primo mese</div>
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={() => goTo("history")}
                style={{
                  width: "100%", padding: "10px", border: `1px dashed ${T.border}`, borderRadius: 12,
                  background: "transparent", fontSize: 12, fontWeight: 700, color: T.teal,
                  cursor: "pointer", fontFamily: "'Inter', sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  marginTop: 2,
                }}
              >
                Vedi tutti i mesi <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════
            3. RIEPILOGO INTELLIGENTE
            ══════════════════════════════════════════ */}
        <div style={{
          background: T.card, borderRadius: 16, padding: "14px 16px",
          boxShadow: T.shadow, borderLeft: `4px solid ${moodColors[summaryMessage.mood]}`,
        }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: `${moodColors[summaryMessage.mood]}15`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <SummaryIcon size={16} color={moodColors[summaryMessage.mood]} />
            </div>
            <div style={{ fontSize: 13, color: T.text, lineHeight: 1.55, fontWeight: 500 }}>
              {summaryMessage.text}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            4. GRAFICO con impostazioni
            ══════════════════════════════════════════ */}
        <div style={{ background: T.card, borderRadius: 18, padding: "16px 14px 8px", boxShadow: T.shadow }}>
          {/* Header grafico */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, padding: "0 4px" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Andamento</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex", gap: 3 }}>
                {["1W", "1M", "3M", "ALL"].map(r => (
                  <button key={r} onClick={() => setChartRange(r)} style={{
                    padding: "4px 9px", borderRadius: 7, border: "none", fontSize: 10, fontWeight: 700,
                    background: chartRange === r ? T.teal : T.tealLight,
                    color: chartRange === r ? "#fff" : T.teal,
                    cursor: "pointer", fontFamily: "'Inter', sans-serif",
                  }}>{r}</button>
                ))}
              </div>
              {/* Gear button */}
              <button
                onClick={() => setShowChartSettings(prev => !prev)}
                style={{
                  width: 28, height: 28, borderRadius: 8, border: "none",
                  background: showChartSettings ? T.tealLight : T.bg,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Settings size={14} color={showChartSettings ? T.teal : T.textMuted} />
              </button>
            </div>
          </div>

          {/* Settings panel */}
          {showChartSettings && (
            <div style={{
              background: T.bg, borderRadius: 12, padding: "2px 14px 2px",
              margin: "8px 4px",
            }}>
              {[
                { key: "showObjective", label: "Mostra obiettivo" },
                { key: "showBMIZones", label: "Mostra zone BMI" },
                { key: "showScale", label: "Mostra peso bilancia" },
                { key: "showTrend", label: "Mostra trend" },
              ].map(({ key, label }, i, arr) => (
                <div key={key} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "9px 0",
                  borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none",
                }}>
                  <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{label}</span>
                  <button
                    onClick={() => setChartSettings(prev => ({ ...prev, [key]: !prev[key] }))}
                    style={{
                      width: 40, height: 22, borderRadius: 11, border: "none",
                      background: chartSettings[key] ? T.teal : "#D1D5DB",
                      position: "relative", cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: "absolute", top: 2,
                      left: chartSettings[key] ? 20 : 2,
                      width: 18, height: 18, borderRadius: 9, background: "#fff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                      transition: "left 0.2s",
                    }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 10, color: T.textMuted, padding: "4px 4px 8px" }}>
            {[
              chartSettings.showScale ? "Grigio = bilancia" : null,
              chartSettings.showTrend ? "Teal = trend" : null,
              chartSettings.showObjective && settings.goalWeight ? "Verde = obiettivo" : null,
            ].filter(Boolean).join("  ·  ")}
          </div>

          <ResponsiveContainer width="100%" height={190}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 8, left: -15, bottom: 5 }}>
              <defs>
                <linearGradient id="areaGradNew" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.teal} stopOpacity={0.12} />
                  <stop offset="95%" stopColor={T.teal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8ECEF" vertical={false} />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 9, fill: T.textMuted }} tickLine={false} axisLine={false} />
              <YAxis domain={weightDomain} tick={{ fontSize: 9, fill: T.textMuted }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />

              {/* BMI zones */}
              {chartSettings.showBMIZones && settings.height && bmiZones.map(zone => (
                <ReferenceArea key={zone.name} y1={zone.y1} y2={zone.y2} fill={zone.color} fillOpacity={0.07} />
              ))}

              {/* Obiettivo */}
              {chartSettings.showObjective && settings.goalWeight && (
                <ReferenceLine y={settings.goalWeight} stroke={T.mint} strokeDasharray="6 4" strokeWidth={1.5} />
              )}

              {/* Trend area */}
              {chartSettings.showTrend && (
                <Area type="monotone" dataKey="trend" fill="url(#areaGradNew)" stroke="none" />
              )}

              {/* Peso bilancia */}
              {chartSettings.showScale && (
                <Line type="monotone" dataKey="weight" stroke="#C5D0D0" strokeWidth={1.5}
                  dot={{ r: 2.5, fill: "#C5D0D0", strokeWidth: 0 }} activeDot={{ r: 5, fill: T.teal }} />
              )}

              {/* Trend line */}
              {chartSettings.showTrend && (
                <Line type="monotone" dataKey="trend" stroke={T.teal} strokeWidth={2.5} dot={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ══════════════════════════════════════════
            5. ULTIME REGISTRAZIONI
            ══════════════════════════════════════════ */}
        <div style={{ background: T.card, borderRadius: 18, padding: "14px 16px", boxShadow: T.shadow }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Ultime registrazioni</span>
            <button onClick={() => goTo("history")} style={{
              background: T.tealLight, border: "none", fontSize: 11, color: T.teal,
              fontWeight: 700, cursor: "pointer", padding: "5px 12px", borderRadius: 8,
              display: "flex", alignItems: "center", gap: 3, fontFamily: "'Inter', sans-serif",
            }}>
              Tutte <ChevronRight size={13} />
            </button>
          </div>

          {/* Header colonne */}
          <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, textTransform: "uppercase" }}>Data</span>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", width: 44, textAlign: "center" }}>Diff</span>
              <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", width: 50, textAlign: "center" }}>Ritmo</span>
              <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", width: 60, textAlign: "right" }}>Peso</span>
            </div>
          </div>

          {recentWithRitmo.map((entry, idx) => {
            const isToday = entry.date === today();
            const isYesterday = (() => {
              const y = new Date(); y.setDate(y.getDate() - 1);
              return entry.date === toISO(y);
            })();
            const dateLabel = isToday ? "Oggi" : isYesterday ? "Ieri" : formatDate(entry.date);
            const dateSubLabel = !isToday && !isYesterday ? "" : formatDate(entry.date);

            return (
              <div key={entry.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 0", borderTop: `1px solid ${T.border}`,
              }}>
                <div>
                  <span style={{ fontSize: 12, color: isToday ? T.teal : T.text, fontWeight: isToday ? 700 : 600 }}>
                    {dateLabel}
                  </span>
                  {(isToday || isYesterday) && (
                    <span style={{ fontSize: 10, color: T.textMuted, marginLeft: 4 }}>
                      {formatDate(entry.date)}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Diff */}
                  <div style={{ width: 44, display: "flex", justifyContent: "center" }}>
                    {entry.diff != null ? (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                        background: entry.diff < 0 ? "#02C39A12" : entry.diff > 0 ? "#E85D4E12" : "#F0F0F0",
                        color: entry.diff < 0 ? T.mint : entry.diff > 0 ? T.coral : T.textMuted,
                        display: "inline-flex", alignItems: "center",
                      }}>
                        {entry.diff > 0 ? "+" : ""}{entry.diff}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: T.textMuted }}>—</span>
                    )}
                  </div>
                  {/* Ritmo */}
                  <div style={{ width: 50, textAlign: "center" }}>
                    {entry.ritmo != null ? (
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: entry.ritmo < 0 ? T.mint : entry.ritmo > 0 ? T.coral : T.textMuted,
                      }}>
                        {entry.ritmo > 0 ? "+" : ""}{entry.ritmo}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: T.textMuted }}>—</span>
                    )}
                  </div>
                  {/* Peso */}
                  <div style={{ width: 60, textAlign: "right" }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{entry.weight} kg</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      <BottomNav active="dashboard" onNavigate={goTo} onAdd={() => goTo("add")} />

      {/* ══════════════════════════════════════════
          INFO POPUP: Cos'è il Trend
          ══════════════════════════════════════════ */}
      <InfoPopup show={showTrendInfo} onClose={() => setShowTrendInfo(false)} title="Cos'è il Trend?">
        <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7 }}>
          {"Il peso sulla bilancia cambia ogni giorno per molte ragioni: quanta acqua hai bevuto, cosa hai mangiato, se hai fatto attività fisica. Queste oscillazioni possono essere di "}
          <strong>0.5–1.5 kg in un solo giorno</strong>
          {"."}<br /><br />
          {"Il "}
          <strong>trend</strong>
          {" filtra queste oscillazioni e ti mostra la direzione reale del tuo peso. È come guardare il percorso dall'alto invece che passo per passo."}<br /><br />
          {"Per questo lo usiamo in tutti i calcoli (previsioni, confronti, ritmo): il trend è più affidabile del singolo dato della bilancia."}
          <br /><br />
          <span style={{ color: T.textMuted, fontSize: 12 }}>
            Tecnicamente usiamo una media mobile esponenziale (EMA) che pesa di più i giorni recenti.
          </span>
        </div>
      </InfoPopup>

      {/* ══════════════════════════════════════════
          INFO POPUP: Come viene calcolata la previsione
          ══════════════════════════════════════════ */}
      <InfoPopup show={showPredInfo} onClose={() => setShowPredInfo(false)} title="Come calcoliamo la previsione">
        <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7 }}>
          {"Guardiamo il tuo "}
          <strong>trend degli ultimi 14 giorni</strong>
          {" e calcoliamo quanto peso perdi in media a settimana."}
          <br /><br />
          {metrics.weeklyRate != null && metrics.weeksToGoal != null ? (
            <>
              {"Se mantieni il ritmo attuale di "}
              <strong>{metrics.weeklyRate > 0 ? "+" : ""}{metrics.weeklyRate} kg/sett</strong>
              {", raggiungerai l'obiettivo in circa "}
              <strong>{metrics.weeksToGoal} {metrics.weeksToGoal === 1 ? "settimana" : "settimane"}</strong>
              {"."}
            </>
          ) : "Continua a registrare per vedere la previsione."}
          <br /><br />
          <span style={{ color: T.textMuted, fontSize: 12 }}>
            La previsione si aggiorna ogni giorno in base ai tuoi dati più recenti.
          </span>
        </div>
      </InfoPopup>

    </div>
  );
}
