import { useState, useMemo, useCallback, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart
} from "recharts";
import {
  Scale, Target, TrendingDown, TrendingUp, Calendar, Plus,
  ChevronLeft, Settings, Trash2, Award, Flame, ArrowDown,
  ArrowUp, Minus, Edit3, Check, X, Home, Utensils, Dumbbell,
  User, ChevronRight, Clock, Droplets, Zap, Activity,
  Sun, Moon, Sunrise, Star, Heart, BarChart3, AlertCircle,
  Sparkles, Trophy, CheckCircle2
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

const periodAvg = (entries, daysBack) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const filtered = entries.filter(e => new Date(e.date) >= cutoff);
  if (filtered.length === 0) return null;
  return Math.round((filtered.reduce((s, e) => s + e.weight, 0) / filtered.length) * 100) / 100;
};

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
  if (!bmi) ret
urn "";
  if (bmi < 18.5) return "Sottopeso";
  if (bmi < 25) return "Normopeso";
  if (bmi < 30) return "Sovrappeso";
  return "Obesit\u00e0";
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

// Get day name in Italian
const getDayName = (dateStr) => {
  return new Date(dateStr).toLocaleDateString("it-IT", { weekday: "short" });
};

// Motivational tips (rotate daily)
const dailyTips = [
  { text: "Pesati sempre alla stessa ora per risultati pi\u00f9 precisi, preferibilmente al mattino a digiuno.", icon: Clock },
  { text: "Le oscillazioni giornaliere di 0.5-1 kg sono normali. Guarda sempre il trend settimanale.", icon: Activity },
  { text: "Bere 2L di acqua al giorno aiuta il metabolismo e riduce la ritenzione idrica.", icon: Droplets },
  { text: "Il sonno influenza il peso: dormire 7-8 ore regola gli ormoni della fame.", icon: Moon },
  { text: "Non saltare i pasti: mangiare regolarmente mantiene stabile il metabolismo.", icon: Utensils },
  { text: "Lo stress aumenta il cortisolo, che favorisce l'accumulo di grasso addominale.", icon: Heart },
  { text: "Anche una camminata di 30 minuti al giorno fa una grande differenza nel lungo periodo.", icon: Activity },
];

const getDailyTip = () => {
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return dailyTips[dayOfYear % dailyTips.length];
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
  gradientWarm: "linear-gradient(135deg, #F
0B429, #E85D4E)",
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
            display: "flex", alignItems: "center", justifyContent: "center", flexShr
ink: 0,
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
   CIRCULAR PROGRESS COMPONENT
   ═══════════════════════════════════════════ */

con
st CircularProgress = ({ percentage, size = 64, strokeWidth = 5, color = T.teal }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={`${color}15`} strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease-in-out" }} />
    </svg>
  );
};

/* ═══════════════════════════════════════════
   STREAK CALENDAR WIDGET
   ═══════════════════════════════════════════ */

const StreakCalendar = ({ entries, streak }) => {
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = toISO(d);
    const hasEntry = entries.some(e => e.date === iso);
    last7.push({ date: iso, day: getDayName(iso), hasEntry, isToday: i === 0 });
  }

  return (
    <div style={{
      background: T.card, borderRadius: 20, padding: "18px 16px",
      boxShadow: T.shadow,
    }} className="animate-card animate-card-5">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: streak >= 3 ? `${T.gold}18` : `${T.textMuted}10`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }} className={streak >= 5 ? "streak-glow" : ""}>
            <Flame size={20} color={streak >= 3 ? T.gold : T.textMuted} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>Streak</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>
              {streak} {streak === 1 ? "giorno" : "giorni"}
            </div>
          </div>
        </div>
        {streak >= 7 && (
          <div style={{
            background: `${T.gold}15`, padding: "4px 10px", borderRadius: 8,
            fontSize: 10, fontWeight: 700, color: T.gold,
          }}>
            <Trophy size={11} style={{ verticalAlign: -1, marginRight: 3 }} />
            Record!
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, justifyContent: "space-between" }}>
        {last7.map((day, i) => (
          <div key={i} style={{ textAlign: "center", flex: 1 }}>
            <div style={{
              fontSize: 9, color: day.isToday ? T.teal : T.textMuted,
              fontWeight: day.isToday ? 700 : 500, textTransform: "uppercase",
              mar
ginBottom: 6,
            }}>
              {day.day}
            </div>
            <div style={{
              width: 32, height: 32, borderRadius: 10, margin: "0 auto",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: day.hasEntry
                ? (day.isToday ? T.gradient : `${T.mint}18`)
                : (day.isToday ? `${T.coral}12` : T.bg),
              border: day.isToday ? "none" : "none",
              transition: "all 0.3s ease",
            }}>
              {day.hasEntry ? (
                <CheckCircle2 size={14} color={day.isToday ? "#fff" : T.mint} strokeWidth={2.5} />
              ) : day.isToday ? (
                <Plus size={12} color={T.coral} strokeWidth={2.5} />
              ) : (
                <div style={{ width: 6, height: 6, borderRadius: 3, background: "#D1D5DB" }} />
              )}
            </div>
          </div>
        ))}
      </div>
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
    const bmi = calcBMI(latest.weight, settings.heig
ht);

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

    // Best weight (lowest if goal is lower, highest if goal is higher)
    const bestWeight = settings.goalWeight && latest.weight > settings.goalWeight
      ? Math.min(...sorted.map(e => e.weight))
      : Math.max(...sorted.map(e => e.weight));

    // Consistency: days tracked out of last 30
    const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    const daysTracked = sorted.filter(e => new Date(e.date) >= thirtyAgo).length;
    const consistency = Math.round((daysTracked / 30) * 100);

    // Today vs yesterday
    const todayEntry = sorted.find(e => e.date === today());
    const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayEntry = sorted.find(e => e.date === toISO(yesterdayDate));
    const vsYesterday = todayEntry && yesterdayEntry
      ? Math.round((todayEntry.weight - yesterdayEntry.weight) * 100) / 100
      : null;

    return {
      current: latest.weight, trend: latestSmoothed?.trend, weekChange, bmi, streak,
      predictedDate, weeklyRate,
      totalChange: Math.round((latest.weight - sorted[0].weight) * 100) / 100,
      totalEntries: sorted.length,
      bestWeight, consistency, daysTracked,
      todayLogged: !!todayEntry, vsYesterday,
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

  const delete
Entry = (id) => { setEntries(entries.filter(e => e.id !== id)); setShowConfirmDelete(null); };

  const goTo = useCallback((s) => { setScreen(s); setShowConfirmDelete(null); setEditingEntry(null); }, []);

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

          <div sty
le={{
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
                  <div style={{ fontSize: 11, color
: T.textMuted, fontWeight: 600, marginBottom: 3 }}>
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
                      {diff !== null && diff !== 0 && (
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
                  {entry.note && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{entry.note}</div>}
                </div>
                <div style={{ display: "flex", gap: 2 }}>
                  <button onClick={() => { setEditingEntry(entry.id); setEditWeight(String(entry.weight)); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                    <Edit3 size={15} color={T.teal} />
                  </button>
                  {showConfirmDelete === entry.id ? (
                    <button onClick={() => deleteEntry(entry.id)} style={{
                      background: "#FEE2E2", border: "none", borderRadius: 8,
 cursor: "pointer",
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
        <Header title="Fitness" subtitle="Attivit\u00e0" />
        <ComingSoonScreen
          icon={Dumbbell} title="Traccia il tuo Allenamento" color={T.purple}
          description="Registra camminate, sessioni in palestra e monitora i tuoi progressi fitness."
          features={[
            { icon: Activity, title: "Camminata & Corsa", desc: "Passi, distanza e calorie bruciate" },
            { icon: Dumbbell, title: "Palestra", desc: "Esercizi, serie, ripetizioni e carichi" },
            { icon: Flame, title: "Calorie Bruciate", desc: "Stima automatica per attivit\u00e0" },
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
      <div style={{ minHeight: "100vh", background: T.bg, fontFam
ily: "'Inter', -apple-system, sans-serif", paddingBottom: 100 }}>
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
            Obietti
vi
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

          <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginTop: 20 }}>
            Riepilogo
          </div>
          <div style={{
            background: T.card, borderRadius: 14, padding: "16px", boxShadow: T.shadow,
          }}>
            {[
              { label: "Peso attuale", value: `${metrics.current || "\u2014"} kg` },
              { label: "BMI", value: metrics.bmi ? `${metrics.bmi} (${bmiCategory(metrics.bmi)})` : "\u2014" },
              { label: "Variazione totale", value: metrics.totalChange ? `${metrics.totalChange > 0 ? "+" : ""}${metrics.totalChange} kg` : "\u2014" },
              { label: "Ritmo settimanale", value: metrics.weeklyRate ? `${metrics.weeklyRate > 0 ? "+" : ""}${metrics.weeklyRate} kg/sett` : "\u2014" },
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
            background: T.tealLight
, textAlign: "center",
          }}>
            <div style={{ fontSize: 12, color: T.teal, fontWeight: 600 }}>
              Weight Tracker v2.0 \u2014 I tuoi dati restano sul tuo dispositivo
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
    return { text: `Variazione settimanale: ${wc > 0 ? "+" :
 ""}${wc} kg. Continua a tracciare per avere dati pi\u00f9 precisi.`, mood: "neutral" };
  }, [sorted, comparisons, metrics, settings]);

  const moodColors = { great: T.mint, good: T.teal, neutral: T.textSec, attention: T.gold };
  const moodIcons = { great: Award, good: TrendingDown, neutral: Activity, attention: AlertCircle };
  const SummaryIcon = moodIcons[summaryMessage.mood] || Activity;

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;
  const tip = getDailyTip();
  const TipIcon = tip.icon;

  // Progress percentage
  const progressPct = useMemo(() => {
    if (!settings.goalWeight || !settings.startWeight || !metrics.current) return 0;
    const total = Math.abs(settings.startWeight - settings.goalWeight);
    const done = Math.abs(settings.startWeight - metrics.current);
    return total > 0 ? Math.min(Math.max((done / total) * 100, 0), 100) : 0;
  }, [settings, metrics]);

  /* ═══════════════════════════════════════
     SCREEN: DASHBOARD (Default)
     ═══════════════════════════════════════ */
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* ── HEADER with greeting ── */}
      <div style={{
        padding: "16px 20px 8px", background: T.bg,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: T.gradient,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>
                {settings.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                <GreetingIcon size={12} /> {greeting.text}
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: 0, letterSpacing: -0.5 }}>
                {settings.name}
              </h1>
            </div>
          </div>
          <button onClick={() => goTo("profile")} style={{
            background: T.card, border: "none", borderRadius: 12, padding: 10,
            cursor: "pointer", boxShadow: T.shadow,
          }} className="touch-card">
            <Settings size={20} color={T.teal} />
          </button>
        </div>
      </div>

      <div style={{ padding: "8px 20px 120px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ── 1. DAILY CHECK-IN PROMPT (if not logged today) ── */}
        {!metrics.todayLogged && (
          <div
            onClick={() => goTo("add")}
            className="animate-card animate-card-1 touch-card"
            style={{
      
        background: `linear-gradient(135deg, ${T.coral}12, ${T.gold}12)`,
              borderRadius: 18, padding: "16px 18px",
              border: `1px dashed ${T.gold}60`,
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 14,
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: `${T.gold}20`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Scale size={22} color={T.gold} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Non ti sei ancora pesato oggi</div>
              <div style={{ fontSize: 12, color: T.textSec, marginTop: 2 }}>Tocca per registrare il peso di oggi</div>
            </div>
            <ChevronRight size={18} color={T.textMuted} />
          </div>
        )}

        {/* ── 2. SMART SUMMARY ── */}
        <div style={{
          background: T.card, borderRadius: 20, padding: "18px 20px",
          boxShadow: T.shadow, borderLeft: `4px solid ${moodColors[summaryMessage.mood]}`,
        }} className="animate-card animate-card-1">
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

        {/* ── 3. WEIGHT & GOAL OVERVIEW with circular progress ── */}
        <div style={{
          background: T.gradient, borderRadius: 22, padding: "22px 20px",
          boxShadow: "0 4px 24px rgba(2,128,144,0.2)",
        }} className="animate-card animate-card-2">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Peso attuale</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 42, fontWeight: 800, color: "#fff" }}>{metrics.current || "\u2014"}</span>
                <span style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>kg</span>
              </div>

              {metrics.trend && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2, fontWeight: 500 }}>
                  Trend: {metrics.trend} kg
                </div>
              )}
              {metrics.vsYesterday !== null && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 12, fontWeight: 700, color: "#fff", marginTop: 6,
                  background: "rgba(255,255,255,0.2)", padding: "3px 10px", borderRadius: 8,
                }}>
                  {metrics.vsYesterday < 0 ? <ArrowDown size={12} /> : metrics.vsYesterday > 0 ? <ArrowUp size={12} /> : <Minus size={12} />}
                  {Math.abs(metrics.vsYesterday)} kg vs ieri
                </div>
              )}
            </div>

            {/* Circular progress + goal */}
            <div style={{ textAlign: "center", position: "relative" }}>
              <CircularProgress percentage={Math.round(progressPct)} size={72} strokeWidth={5} color="#fff" />
              <div style={{
                position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{Math.round(progressPct)}%</div>
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>
                Obiettivo: {settings.goalWeight} kg
              </div>
              {metrics.current && settings.goalWeight && (
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "#fff", marginTop: 2,
                  background: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: 6,
                }}>
                  -{Math.abs(Math.round((metrics.current - settings.goalWeight) * 10) / 10)} kg
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 4. PREDICTION (if available) ── */}
        {metrics.predictedDate && (
          <div style={{
            background: T.card, borderRadius: 18, padding: "16px 20px",
            boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 14,
            border: `1px solid ${T.tealLight}`,
          }} className="animate-card animate-card-3">
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
                Raggiungerai {settings.goalWeight} kg il {metrics.predic
tedDate}
              </div>
              {metrics.weeklyRate && (
                <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>
                  Al ritmo attuale di {metrics.weeklyRate > 0 ? "+" : ""}{metrics.weeklyRate} kg/settimana
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 5. CHART ── */}
        <div style={{ background: T.card, borderRadius: 20, padding: "18px 14px 10px", boxShadow: T.shadow }}
             className="animate-card animate-card-4">
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
            La linea grigia {"\u00e8"} il peso sulla bilancia. La linea teal {"\u00e8"} il trend reale, che filtra le oscillazioni quotidiane.
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
              <Line type="monotone" dataKey="trend" stroke={T.teal} strokeWidth={2.5} do
t={false} />
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

        {/* ── 6. STREAK CALENDAR ── */}
        <StreakCalendar entries={sorted} streak={metrics.streak || 0} />

        {/* ── 7. CONFRONTI TEMPORALI ── */}
        <div style={{ background: T.card, borderRadius: 20, padding: "18px 20px", boxShadow: T.shadow }}
             className="animate-card animate-card-6">
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 4 }}>Confronti</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 14 }}>
            Come sta andando rispetto ai periodi precedenti
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            {/* Week */}
            <div style={{ flex: 1, background: T.bg, borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8 }}>
                Settimana
              </div>
              {comparisons.avgThisWeek && comparisons.avgLastWeek ? (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{comparisons.avgThisWeek}</span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>kg</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>
                    vs {comparisons.avgLastWeek} kg scorsa
                  </div>
                  {comparisons.weekChg !== null && (
                    <div style={{
                      fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 8, display: "inline-flex",
                      alignItems: "center", gap: 3,
                      background: comparisons.weekChg <= 0 ? "#02C39A15" : "#E85D4E15",
                      color: comparisons.weekChg <= 0 ? T.mint : T.coral,
                    }}>
                      {comparisons.weekChg <= 0 ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
                      {comparisons.weekChg > 0 ? "+" : ""}{comparisons.w
eekChg} kg
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 12, color: T.textMuted }}>Servono 2 settimane di dati</div>
              )}
            </div>

            {/* Month */}
            <div style={{ flex: 1, background: T.bg, borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8 }}>
                Mese
              </div>
              {comparisons.avgThisMonth && comparisons.avgLastMonth ? (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{comparisons.avgThisMonth}</span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>kg</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>
                    vs {comparisons.avgLastMonth} kg scorso
                  </div>
                  {comparisons.monthChg !== null && (
                    <div style={{
                      fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 8, display: "inline-flex",
                      alignItems: "center", gap: 3,
                      background: comparisons.monthChg <= 0 ? "#02C39A15" : "#E85D4E15",
                      color: comparisons.monthChg <= 0 ? T.mint : T.coral,
                    }}>
                      {comparisons.monthChg <= 0 ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
                      {comparisons.monthChg > 0 ? "+" : ""}{comparisons.monthChg} kg
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 12, color: T.textMuted }}>Servono 2 mesi di dati</div>
              )}
            </div>
          </div>
        </div>

        {/* ── 8. STATS ROW (BMI, Rate, Best, Consistency) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
             className="animate-card animate-card-7">
          {/* BMI */}
          <div style={{
            background: T.card, borderRadius: 16, padding: "14px 16px", boxShadow: T.shadow,
          }} className="touch-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10, background: `${bmiColor(metrics.bmi)}15`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Activity size={15} color={bmiColor(metrics.bmi)} />
              </div>
              <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, textTransform: "uppercase" }}>BMI</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color
: T.text }}>{metrics.bmi || "\u2014"}</div>
            <div style={{ fontSize: 10, color: bmiColor(metrics.bmi), fontWeight: 600, marginTop: 2 }}>
              {bmiCategory(metrics.bmi)}
            </div>
          </div>

          {/* Weekly Rate */}
          <div style={{
            background: T.card, borderRadius: 16, padding: "14px 16px", boxShadow: T.shadow,
          }} className="touch-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: `${metrics.weeklyRate <= 0 ? T.mint : T.coral}15`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <TrendingDown size={15} color={metrics.weeklyRate <= 0 ? T.mint : T.coral} />
              </div>
              <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, textTransform: "uppercase" }}>Ritmo</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>
              {metrics.weeklyRate ? `${metrics.weeklyRate > 0 ? "+" : ""}${metrics.weeklyRate}` : "\u2014"}
            </div>
            <div style={{ fontSize: 10, color: T.textSec, fontWeight: 600, marginTop: 2 }}>kg/settimana</div>
          </div>

          {/* Best Weight */}
          <div style={{
            background: T.card, borderRadius: 16, padding: "14px 16px", boxShadow: T.shadow,
          }} className="touch-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10, background: `${T.purple}15`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Star size={15} color={T.purple} />
              </div>
              <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, textTransform: "uppercase" }}>Miglior peso</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>{metrics.bestWeight || "\u2014"}</div>
            <div style={{ fontSize: 10, color: T.purple, fontWeight: 600, marginTop: 2 }}>kg raggiunto</div>
          </div>

          {/* Consistency */}
          <div style={{
            background: T.card, borderRadius: 16, padding: "14px 16px", boxShadow: T.shadow,
          }} className="touch-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10, background: `${T.teal}15`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <BarChart3 size={15} color={T.teal} />
              </div>
              <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, textTransform: "uppercase" }}>Costanza</div>
           
 </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>{metrics.consistency || 0}%</div>
            <div style={{ fontSize: 10, color: T.teal, fontWeight: 600, marginTop: 2 }}>
              {metrics.daysTracked || 0}/30 giorni
            </div>
          </div>
        </div>

        {/* ── 9. DAILY TIP ── */}
        <div style={{
          background: `linear-gradient(135deg, ${T.teal}08, ${T.mint}08)`,
          borderRadius: 18, padding: "16px 18px",
          border: `1px solid ${T.tealLight}`,
        }} className="animate-card animate-card-7">
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: `${T.teal}15`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Sparkles size={16} color={T.teal} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: T.teal, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
                Consiglio del giorno
              </div>
              <div style={{ fontSize: 13, color: T.textSec, lineHeight: 1.5, fontWeight: 500 }}>
                {tip.text}
              </div>
            </div>
          </div>
        </div>

        {/* ── 10. RECENT ENTRIES ── */}
        <div style={{ background: T.card, borderRadius: 20, padding: "16px 18px", boxShadow: T.shadow }}
             className="animate-card animate-card-8">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Ultime Registrazioni</span>
            <button onClick={() => goTo("history")} style={{
              background: T.tealLight, border: "none", fontSize: 11, color: T.teal,
              fontWeight: 700, cursor: "pointer", padding: "5px 12px", borderRadius: 8,
              display: "flex", alignItems: "center", gap: 3,
            }} className="touch-card">
              Tutte <ChevronRight size={13} />
            </button>
          </div>
          {(() => {
            const recentReversed = [...sorted].reverse().slice(0, 5);
            return recentReversed.map((entry, idx) => {
              const next = idx < recentReversed.length - 1 ? recentReversed[idx + 1] : null;
              const diff = next ? Math.round((entry.weight - next.weight) * 100) / 100 : null;
              const isToday = entry.date === today();
              const isYesterday = (() => {
                const y = new Date(); y.setDate(y.getDate() - 1);
                return entry.date === toISO(y);
              })();

              return (
                <div key={entry.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "11px 0", borderBottom: idx < recentRev
ersed.length - 1 ? `1px solid ${T.border}` : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: 4,
                      background: isToday ? T.mint : isYesterday ? T.teal : T.border,
                    }} />
                    <div>
                      <span style={{ fontSize: 12, color: isToday ? T.teal : T.textMuted, fontWeight: isToday ? 700 : 500 }}>
                        {isToday ? "Oggi" : isYesterday ? "Ieri" : formatDate(entry.date)}
                      </span>
                      {entry.note && <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>{entry.note}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {diff !== null && diff !== 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6,
                        display: "inline-flex", alignItems: "center", gap: 2,
                        background: diff < 0 ? "#02C39A12" : "#E85D4E12",
                        color: diff < 0 ? T.mint : T.coral,
                      }}>
                        {diff < 0 ? <ArrowDown size={9} /> : <ArrowUp size={9} />}
                        {Math.abs(diff)}
                      </span>
                    )}
                    <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{entry.weight} kg</span>
                  </div>
                </div>
              );
            });
          })()}
        </div>

      </div>

      <BottomNav active="dashboard" onNavigate={goTo} onAdd={() => goTo("add")} />
    </div>
  );
}
