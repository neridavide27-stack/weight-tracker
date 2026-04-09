"use client";
import React, { useState, useMemo, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart, ReferenceArea,
} from "recharts";
import {
  Scale, Target, TrendingDown, TrendingUp, Calendar, Plus,
  ChevronLeft, Settings, Trash2, Award, Flame, ArrowDown,
  ArrowUp, Minus, Edit3, Check, X, ChevronRight, Activity,
  AlertCircle, Info,
} from "lucide-react";

/* ═══════════════════════════════════════════
   UTILITIES (same as main app)
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

const getTrendAtDate = (smoothedEntries, dateStr) => {
  if (!smoothedEntries || smoothedEntries.length === 0) return null;
  const exact = smoothedEntries.find(e => e.date === dateStr);
  if (exact) return exact.trend;
  const before = smoothedEntries.filter(e => e.date < dateStr);
  const after = smoothedEntries.filter(e => e.date > dateStr);
  if (before.length === 0) return after[0]?.trend ?? null;
  if (after.length === 0) return before[before.length - 1]?.trend ?? null;
  const b = before[before.length - 1];
  const a = after[0];
  const daysTotal = (new Date(a.date) - new Date(b.date)) / 86400000;
  const daysBefore = (new Date(dateStr) - new Date(b.date)) / 86400000;
  if (daysTotal === 0) return b.trend;
  return Math.round((b.trend + (a.trend - b.trend) * (daysBefore / daysTotal)) * 100) / 100;
};

const getMondays = (count) => {
  const mondays = [];
  const d = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  for (let i = 0; i < count; i++) {
    mondays.push(toISO(d));
    d.setDate(d.getDate() - 7);
  }
  return mondays;
};

const getFirstOfMonths = (count) => {
  const firsts = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < count; i++) {
    firsts.push(toISO(d));
    d.setMonth(d.getMonth() - 1);
  }
  return firsts;
};

/* ═══════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════ */

const CircularProgress = ({ percentage, size = 64, strokeWidth = 5, color }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(percentage, 0), 100) / 100) * circumference;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={`${color}20`} strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease-in-out" }} />
    </svg>
  );
};

const InfoPopup = ({ show, onClose, title, children }) => {
  if (!show) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 50, padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 20, padding: "24px 20px",
        maxWidth: 360, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#1A2030" }}>{title}</span>
          <button onClick={onClose} style={{
            background: "#F0F0F0", border: "none", borderRadius: 8, width: 28, height: 28,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}><X size={14} color="#6B7280" /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, T }) => {
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

/* ═══════════════════════════════════════════
   WEIGHT SECTION COMPONENT
   ═══════════════════════════════════════════ */

export default function WeightSection({ T, entries, setEntries, settings, goTo }) {
  // Internal screen: main | add | history
  const [screen, setScreen] = useState("main");
  const [newWeight, setNewWeight] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newDate, setNewDate] = useState(today());
  const [editingEntry, setEditingEntry] = useState(null);
  const [editWeight, setEditWeight] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState(null);
  const [chartRange, setChartRange] = useState("1M");
  const [chartSettings, setChartSettings] = useState({
    showObjective: true, showBMIZones: false, showScale: true, showTrend: true,
  });
  const [showChartSettings, setShowChartSettings] = useState(false);
  const [compTab, setCompTab] = useState("week");
  const [showTrendInfo, setShowTrendInfo] = useState(false);
  const [showPredInfo, setShowPredInfo] = useState(false);

  // Core computations
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
      ? Math.round((todayEntry.weight - yesterdayEntry.weight) * 100) / 100 : null;

    const totalChange = Math.round((latest.weight - sorted[0].weight) * 100) / 100;

    return {
      current: latest.weight, trend: latestSmoothed?.trend ?? null, bmi, streak,
      predictedDate, weeklyRate, weeksToGoal, totalChange,
      totalEntries: sorted.length, todayLogged: todayEntry != null, vsYesterday,
    };
  }, [sorted, smoothed, settings]);

  const weightDomain = useMemo(() => {
    if (chartData.length === 0) return [60, 90];
    const weights = chartData.flatMap(d => [d.weight, d.trend].filter(v => v != null));
    return [Math.floor(Math.min(...weights) - 1), Math.ceil(Math.max(...weights) + 1)];
  }, [chartData]);

  const bmiZones = useMemo(() => {
    if (!settings.height) return [];
    const h = settings.height / 100;
    const h2 = h * h;
    return [
      { name: "Sottopeso", y1: 0, y2: Math.round(18.5 * h2 * 10) / 10, color: "#3B82F6" },
      { name: "Normopeso", y1: Math.round(18.5 * h2 * 10) / 10, y2: Math.round(25 * h2 * 10) / 10, color: "#02C39A" },
      { name: "Sovrappeso", y1: Math.round(25 * h2 * 10) / 10, y2: Math.round(30 * h2 * 10) / 10, color: "#F0B429" },
      { name: "Obesità", y1: Math.round(30 * h2 * 10) / 10, y2: 200, color: "#E85D4E" },
    ];
  }, [settings.height]);

  const comparisons = useMemo(() => {
    const mondays = getMondays(4);
    const firsts = getFirstOfMonths(4);
    const weeklyData = mondays.map((date, i) => {
      const end = new Date(date); end.setDate(end.getDate() + 6);
      const trend = getTrendAtDate(smoothed, date);
      const prevTrend = i < mondays.length - 1 ? getTrendAtDate(smoothed, mondays[i + 1]) : null;
      const diff = (trend != null && prevTrend != null) ? Math.round((trend - prevTrend) * 100) / 100 : null;
      const label = i === 0 ? "Questa settimana" : i === 1 ? "Settimana scorsa" : `-${i} settimane`;
      const dl = `${formatDate(date)} — ${formatDate(toISO(end))}`;
      return { date, dateLabel: dl, trend: trend != null ? Math.round(trend * 10) / 10 : null, diff, label, isCurrent: i === 0 };
    });
    const monthlyData = firsts.map((date, i) => {
      const trend = getTrendAtDate(smoothed, date);
      const prevTrend = i < firsts.length - 1 ? getTrendAtDate(smoothed, firsts[i + 1]) : null;
      const diff = (trend != null && prevTrend != null) ? Math.round((trend - prevTrend) * 100) / 100 : null;
      const mName = new Date(date).toLocaleDateString("it-IT", { month: "long" });
      const label = i === 0 ? `${mName} (corrente)` : mName;
      return { date, dateLabel: formatDate(date), trend: trend != null ? Math.round(trend * 10) / 10 : null, diff, label, isCurrent: i === 0 };
    });
    return { weeklyData, monthlyData };
  }, [smoothed]);

  const recentWithRitmo = useMemo(() => {
    const recent = [...sorted].reverse().slice(0, 5);
    return recent.map((entry, idx) => {
      const smoothedIdx = smoothed.findIndex(e => e.date === entry.date);
      let ritmo = null;
      if (smoothedIdx > 0) {
        const curr = smoothed[smoothedIdx];
        const prev = smoothed[smoothedIdx - 1];
        if (curr && prev) {
          const dBetween = Math.max(1, (new Date(curr.date) - new Date(prev.date)) / 86400000);
          ritmo = Math.round((curr.trend - prev.trend) / dBetween * 7 * 100) / 100;
        }
      }
      const next = idx < recent.length - 1 ? recent[idx + 1] : null;
      const diff = next != null ? Math.round((entry.weight - next.weight) * 100) / 100 : null;
      return { ...entry, ritmo, diff };
    });
  }, [sorted, smoothed]);

  // Progress
  const progressPct = (() => {
    if (!settings.goalWeight || !settings.startWeight || metrics.current == null) return 0;
    const total = Math.abs(settings.startWeight - settings.goalWeight);
    const done = Math.abs(settings.startWeight - metrics.current);
    return total > 0 ? Math.min(Math.max((done / total) * 100, 0), 100) : 0;
  })();

  const kgMancanti = (metrics.current != null && settings.goalWeight)
    ? Math.abs(Math.round((metrics.current - settings.goalWeight) * 10) / 10) : null;
  const kgPersi = (metrics.totalChange != null) ? Math.abs(metrics.totalChange) : null;

  // Entry actions
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
    setScreen("main");
  }, [entries, newWeight, newNote, newDate, setEntries]);

  const deleteEntry = useCallback((id) => {
    setEntries(entries.filter(e => e.id !== id));
    setShowConfirmDelete(null);
  }, [entries, setEntries]);

  /* ═══════════════════════════════════════
     SCREEN: ADD WEIGHT
     ═══════════════════════════════════════ */
  if (screen === "add") {
    const currentWeight = metrics.current;
    const parsedNew = parseFloat(newWeight.replace(",", "."));
    const validNew = !isNaN(parsedNew) && parsedNew >= 20 && parsedNew <= 300;
    const diff = (validNew && currentWeight) ? Math.round((parsedNew - currentWeight) * 100) / 100 : null;

    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <div style={{ padding: "16px 20px 8px", background: T.bg, position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setScreen("main")} style={{
                background: T.card, border: "none", cursor: "pointer", padding: 8,
                borderRadius: 10, display: "flex", alignItems: "center", boxShadow: T.shadow,
              }}><ChevronLeft size={20} color={T.teal} /></button>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0, letterSpacing: -0.5 }}>Nuovo Peso</h1>
            </div>
          </div>
        </div>
        <div style={{ padding: "30px 20px" }}>
          {currentWeight != null && (
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: T.textMuted }}>Peso attuale</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: T.text }}>{currentWeight} <span style={{ fontSize: 14, color: T.textMuted }}>kg</span></div>
            </div>
          )}
          <div style={{ background: T.card, borderRadius: 20, padding: "24px 20px", boxShadow: T.shadow }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSec, display: "block", marginBottom: 8 }}>Data</label>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${T.border}`, fontSize: 15, fontWeight: 600, color: T.text, fontFamily: "inherit", background: T.bg }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSec, display: "block", marginBottom: 8 }}>Peso (kg)</label>
              <input type="number" step="0.1" min="20" max="300" value={newWeight} onChange={(e) => setNewWeight(e.target.value)}
                placeholder="es. 83.5" autoFocus
                style={{ width: "100%", padding: "14px", borderRadius: 12, border: `1.5px solid ${validNew && newWeight ? T.teal : T.border}`, fontSize: 22, fontWeight: 800, textAlign: "center", color: T.text, fontFamily: "inherit", background: T.bg }} />
              {diff != null && (
                <div style={{ textAlign: "center", marginTop: 10 }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 14px", borderRadius: 10,
                    background: diff < 0 ? "#02C39A12" : diff > 0 ? "#E85D4E12" : "#F0F0F0",
                    color: diff < 0 ? T.mint : diff > 0 ? T.coral : T.textMuted, fontSize: 13, fontWeight: 700,
                  }}>
                    {diff < 0 ? <ArrowDown size={14} /> : diff > 0 ? <ArrowUp size={14} /> : <Minus size={14} />}
                    {diff > 0 ? "+" : ""}{diff} kg rispetto ad adesso
                  </span>
                </div>
              )}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSec, display: "block", marginBottom: 8 }}>Note (opzionale)</label>
              <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)}
                placeholder="Come ti senti oggi?"
                style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${T.border}`, fontSize: 14, color: T.text, fontFamily: "inherit", background: T.bg }} />
            </div>
            <button onClick={addEntry} disabled={!validNew}
              style={{
                width: "100%", padding: "14px", borderRadius: 14, border: "none",
                background: validNew ? T.gradient : "#D1D5DB", color: "#fff",
                fontSize: 16, fontWeight: 800, cursor: validNew ? "pointer" : "not-allowed",
                fontFamily: "inherit", boxShadow: validNew ? "0 4px 16px rgba(2,128,144,0.3)" : "none",
              }}>
              Registra peso
            </button>
          </div>
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
        <div style={{ padding: "16px 20px 8px", background: T.bg, position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setScreen("main")} style={{
              background: T.card, border: "none", cursor: "pointer", padding: 8,
              borderRadius: 10, display: "flex", alignItems: "center", boxShadow: T.shadow,
            }}><ChevronLeft size={20} color={T.teal} /></button>
            <div>
              <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>Peso</div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0 }}>Cronologia</h1>
            </div>
          </div>
        </div>
        <div style={{ padding: "8px 16px 120px" }}>
          {reversed.map((entry, idx) => {
            const prev = idx < reversed.length - 1 ? reversed[idx + 1] : null;
            const diff = prev ? Math.round((entry.weight - prev.weight) * 100) / 100 : null;
            const isEditing = editingEntry === entry.id;
            return (
              <div key={entry.id} style={{
                background: T.card, borderRadius: 14, padding: "12px 16px", marginBottom: 6,
                boxShadow: T.shadow, display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{formatDateFull(entry.date)}</div>
                  {entry.note && <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{entry.note}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {diff != null && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                      background: diff < 0 ? "#02C39A12" : diff > 0 ? "#E85D4E12" : "#F0F0F0",
                      color: diff < 0 ? T.mint : diff > 0 ? T.coral : T.textMuted,
                    }}>{diff > 0 ? "+" : ""}{diff}</span>
                  )}
                  {isEditing ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="number" step="0.1" value={editWeight}
                        onChange={(e) => setEditWeight(e.target.value)}
                        style={{ width: 60, padding: "4px 6px", borderRadius: 8, border: `1px solid ${T.teal}`, fontSize: 13, fontWeight: 700, textAlign: "center", fontFamily: "inherit" }} />
                      <button onClick={() => {
                        const w = parseFloat(editWeight);
                        if (!isNaN(w) && w >= 20 && w <= 300) {
                          setEntries(entries.map(e => e.id === entry.id ? { ...e, weight: w } : e));
                        }
                        setEditingEntry(null);
                      }} style={{ background: T.mint, border: "none", borderRadius: 6, padding: 4, cursor: "pointer" }}>
                        <Check size={14} color="#fff" />
                      </button>
                      <button onClick={() => setEditingEntry(null)} style={{ background: "#E8ECEF", border: "none", borderRadius: 6, padding: 4, cursor: "pointer" }}>
                        <X size={14} color={T.textMuted} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{entry.weight} <span style={{ fontSize: 11, color: T.textMuted }}>kg</span></span>
                      <button onClick={() => { setEditingEntry(entry.id); setEditWeight(String(entry.weight)); }}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                        <Edit3 size={14} color={T.textMuted} />
                      </button>
                      {showConfirmDelete === entry.id ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => deleteEntry(entry.id)} style={{ background: T.coral, border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Elimina</button>
                          <button onClick={() => setShowConfirmDelete(null)} style={{ background: "#E8ECEF", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 700, color: T.textMuted, cursor: "pointer" }}>No</button>
                        </div>
                      ) : (
                        <button onClick={() => setShowConfirmDelete(entry.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                          <Trash2 size={14} color={T.textMuted} />
                        </button>
                      )}
                    </>
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
     SCREEN: MAIN (Weight Dashboard)
     ═══════════════════════════════════════ */
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* HEADER */}
      <div style={{ padding: "16px 16px 0", background: T.bg, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 12, background: T.gradient,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Scale size={18} color="#fff" />
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Peso</span>
          </div>
          <button onClick={() => setScreen("add")} style={{
            background: T.gradient, border: "none", borderRadius: 12,
            padding: "8px 16px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
            boxShadow: "0 3px 12px rgba(2,128,144,0.25)",
          }}>
            <Plus size={16} color="#fff" strokeWidth={2.5} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "inherit" }}>Registra</span>
          </button>
        </div>
      </div>

      <div style={{ padding: "14px 16px 120px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* CHECK-IN or CONFIRMED */}
        {!metrics.todayLogged ? (
          <div onClick={() => setScreen("add")} style={{
            background: `linear-gradient(135deg, ${T.coral}12, ${T.gold}12)`,
            borderRadius: 16, padding: "14px 16px", border: `1px dashed ${T.gold}70`, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${T.gold}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Scale size={20} color={T.gold} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Non ti sei ancora pesato oggi</div>
              <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>Tocca per registrare il peso di oggi</div>
            </div>
            <ChevronRight size={16} color={T.textMuted} />
          </div>
        ) : (
          <div style={{
            background: `${T.mint}10`, borderRadius: 14, padding: "10px 16px",
            display: "flex", alignItems: "center", gap: 10, border: `1px solid ${T.mint}30`,
          }}>
            <Check size={16} color={T.mint} />
            <span style={{ fontSize: 12, fontWeight: 600, color: T.mint }}>Pesato oggi — {metrics.current} kg</span>
            {metrics.vsYesterday != null && (
              <span style={{ fontSize: 11, fontWeight: 700, color: metrics.vsYesterday <= 0 ? T.mint : T.coral, marginLeft: "auto" }}>
                {metrics.vsYesterday > 0 ? "+" : ""}{metrics.vsYesterday} kg
              </span>
            )}
          </div>
        )}

        {/* CARD PRINCIPALE */}
        <div style={{ background: T.gradient, borderRadius: 20, padding: "20px", boxShadow: "0 4px 24px rgba(2,128,144,0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Peso attuale</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 4 }}>
                <span style={{ fontSize: 38, fontWeight: 900, color: "#fff" }}>{metrics.current != null ? metrics.current : "—"}</span>
                <span style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>kg</span>
              </div>
              {metrics.trend != null && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2, fontWeight: 500, display: "flex", alignItems: "center", gap: 3 }}>
                  Trend: <span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>{metrics.trend} kg</span>
                  <button onClick={() => setShowTrendInfo(true)} style={{
                    width: 15, height: 15, borderRadius: "50%", background: "rgba(255,255,255,0.25)", border: "none",
                    color: "rgba(255,255,255,0.85)", fontSize: 9, fontWeight: 800, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", marginLeft: 2, flexShrink: 0,
                  }}>i</button>
                </div>
              )}
              {metrics.vsYesterday != null && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6,
                  background: "rgba(255,255,255,0.18)", padding: "3px 10px", borderRadius: 8,
                }}>
                  {metrics.vsYesterday < 0 ? <ArrowDown size={11} color="#fff" />
                    : metrics.vsYesterday > 0 ? <ArrowUp size={11} color="#fff" />
                    : <Minus size={11} color="#fff" />}
                  <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>{Math.abs(metrics.vsYesterday)} kg vs ieri</span>
                </div>
              )}
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ position: "relative", width: 76, height: 76 }}>
                <CircularProgress percentage={Math.round(progressPct)} size={76} strokeWidth={5} color="#fff" />
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>{Math.round(progressPct)}%</div>
                </div>
              </div>
              {settings.goalWeight && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
                    Obiettivo <strong style={{ color: "rgba(255,255,255,0.9)" }}>{settings.goalWeight} kg</strong>
                  </div>
                  {kgMancanti != null && (
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", fontWeight: 700, marginTop: 2 }}>-{kgMancanti} kg al traguardo</div>
                  )}
                  {kgPersi != null && (
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: 600, marginTop: 1 }}>
                      {metrics.totalChange != null && metrics.totalChange < 0 ? `-${kgPersi} kg persi` : `+${kgPersi} kg`}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.15)", margin: "14px 0 12px" }} />
          {metrics.predictedDate ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                  <Target size={13} color="rgba(255,255,255,0.75)" />
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
                    Raggiungerai {settings.goalWeight} kg il <strong style={{ color: "#fff" }}>{metrics.predictedDate}</strong>
                  </span>
                </div>
                <button onClick={() => setShowPredInfo(true)} style={{
                  width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.25)", border: "none",
                  color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: 800, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 6,
                }}>i</button>
              </div>
              {metrics.weeklyRate != null && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 4, paddingLeft: 21 }}>
                  Al ritmo di {metrics.weeklyRate > 0 ? "+" : ""}{metrics.weeklyRate} kg/settimana
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>Aggiungi più dati per vedere la previsione</div>
          )}
        </div>

        {/* GRAFICO */}
        <div style={{ background: T.card, borderRadius: 18, padding: "16px 14px 8px", boxShadow: T.shadow }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, padding: "0 4px" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Andamento</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex", gap: 3 }}>
                {["1W", "1M", "3M", "ALL"].map(r => (
                  <button key={r} onClick={() => setChartRange(r)} style={{
                    padding: "4px 9px", borderRadius: 7, border: "none", fontSize: 10, fontWeight: 700,
                    background: chartRange === r ? T.teal : T.tealLight, color: chartRange === r ? "#fff" : T.teal,
                    cursor: "pointer", fontFamily: "'Inter', sans-serif",
                  }}>{r}</button>
                ))}
              </div>
              <button onClick={() => setShowChartSettings(p => !p)} style={{
                width: 28, height: 28, borderRadius: 8, border: "none",
                background: showChartSettings ? T.tealLight : T.bg, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><Settings size={14} color={showChartSettings ? T.teal : T.textMuted} /></button>
            </div>
          </div>
          {showChartSettings && (
            <div style={{ background: T.bg, borderRadius: 12, padding: "2px 14px", margin: "8px 4px" }}>
              {[
                { key: "showObjective", label: "Mostra obiettivo" },
                { key: "showBMIZones", label: "Mostra zone BMI" },
                { key: "showScale", label: "Mostra peso bilancia" },
                { key: "showTrend", label: "Mostra trend" },
              ].map(({ key, label }, i, arr) => (
                <div key={key} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "9px 0", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none",
                }}>
                  <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{label}</span>
                  <button onClick={() => setChartSettings(prev => ({ ...prev, [key]: !prev[key] }))} style={{
                    width: 40, height: 22, borderRadius: 11, border: "none",
                    background: chartSettings[key] ? T.teal : "#D1D5DB", position: "relative", cursor: "pointer", flexShrink: 0,
                  }}>
                    <div style={{
                      position: "absolute", top: 2, left: chartSettings[key] ? 20 : 2,
                      width: 18, height: 18, borderRadius: 9, background: "#fff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)", transition: "left 0.2s",
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
                <linearGradient id="areaGradWeight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.teal} stopOpacity={0.12} />
                  <stop offset="95%" stopColor={T.teal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8ECEF" vertical={false} />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 9, fill: T.textMuted }} tickLine={false} axisLine={false} />
              <YAxis domain={weightDomain} tick={{ fontSize: 9, fill: T.textMuted }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip T={T} />} />
              {chartSettings.showBMIZones && settings.height && bmiZones.map(zone => (
                <ReferenceArea key={zone.name} y1={zone.y1} y2={zone.y2} fill={zone.color} fillOpacity={0.07} />
              ))}
              {chartSettings.showObjective && settings.goalWeight && (
                <ReferenceLine y={settings.goalWeight} stroke={T.mint} strokeDasharray="6 4" strokeWidth={1.5} />
              )}
              {chartSettings.showTrend && <Area type="monotone" dataKey="trend" fill="url(#areaGradWeight)" stroke="none" />}
              {chartSettings.showScale && (
                <Line type="monotone" dataKey="weight" stroke="#C5D0D0" strokeWidth={1.5}
                  dot={{ r: 2.5, fill: "#C5D0D0", strokeWidth: 0 }} activeDot={{ r: 5, fill: T.teal }} />
              )}
              {chartSettings.showTrend && <Line type="monotone" dataKey="trend" stroke={T.teal} strokeWidth={2.5} dot={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* CONFRONTI */}
        <div style={{ background: T.card, borderRadius: 18, padding: "16px", boxShadow: T.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 12 }}>Confronti</div>
          <div style={{ display: "flex", gap: 0, background: "#E8ECEF", borderRadius: 10, padding: 3, marginBottom: 14 }}>
            {[["week", "Settimane"], ["month", "Mesi"]].map(([key, label]) => (
              <button key={key} onClick={() => setCompTab(key)} style={{
                flex: 1, padding: "7px 0", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: compTab === key ? "#fff" : "transparent", color: compTab === key ? T.teal : T.textMuted,
                boxShadow: compTab === key ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.2s", fontFamily: "'Inter', sans-serif",
              }}>{label}</button>
            ))}
          </div>
          {(compTab === "week" ? comparisons.weeklyData : comparisons.monthlyData).slice(0, 3).map((w, i) => (
            <div key={w.date} style={{
              background: T.card, borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
              display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8,
              borderLeft: w.isCurrent ? `3px solid ${T.teal}` : "3px solid transparent",
            }}>
              <div>
                <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>{w.label}</div>
                {w.trend != null ? (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 3 }}>
                      <span style={{ fontSize: 20, fontWeight: 900, color: T.text }}>{w.trend}</span>
                      <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>kg trend</span>
                    </div>
                    <div style={{ fontSize: 9, color: T.textMuted, marginTop: 1 }}>{w.dateLabel}</div>
                  </>
                ) : <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Dati non disponibili</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                {w.diff != null ? (
                  <div style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8,
                    display: "inline-flex", alignItems: "center", gap: 3,
                    background: w.diff <= 0 ? "#02C39A12" : "#E85D4E12", color: w.diff <= 0 ? T.mint : T.coral,
                  }}>{w.diff <= 0 ? "↓" : "↑"} {w.diff > 0 ? "+" : ""}{w.diff} kg</div>
                ) : null}
              </div>
            </div>
          ))}
          <button onClick={() => setScreen("history")} style={{
            width: "100%", padding: "10px", border: `1px dashed ${T.border}`, borderRadius: 12,
            background: "transparent", fontSize: 12, fontWeight: 700, color: T.teal,
            cursor: "pointer", fontFamily: "'Inter', sans-serif",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 2,
          }}>
            Vedi cronologia <ChevronRight size={13} />
          </button>
        </div>

        {/* ULTIME REGISTRAZIONI */}
        <div style={{ background: T.card, borderRadius: 18, padding: "14px 16px", boxShadow: T.shadow }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Ultime registrazioni</span>
            <button onClick={() => setScreen("history")} style={{
              background: T.tealLight, border: "none", fontSize: 11, color: T.teal, fontWeight: 700, cursor: "pointer",
              padding: "5px 12px", borderRadius: 8, display: "flex", alignItems: "center", gap: 3, fontFamily: "'Inter', sans-serif",
            }}>Tutte <ChevronRight size={13} /></button>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, textTransform: "uppercase" }}>Data</span>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", width: 44, textAlign: "center" }}>Diff</span>
              <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", width: 50, textAlign: "center" }}>Ritmo</span>
              <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", width: 60, textAlign: "right" }}>Peso</span>
            </div>
          </div>
          {recentWithRitmo.map((entry) => {
            const isToday = entry.date === today();
            const isYesterday = (() => { const y = new Date(); y.setDate(y.getDate() - 1); return entry.date === toISO(y); })();
            const dateLabel = isToday ? "Oggi" : isYesterday ? "Ieri" : formatDate(entry.date);
            return (
              <div key={entry.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 0", borderTop: `1px solid ${T.border}`,
                background: isToday ? `${T.teal}06` : "transparent", margin: isToday ? "0 -4px" : 0, padding: isToday ? "8px 4px" : "8px 0", borderRadius: isToday ? 8 : 0,
              }}>
                <div>
                  <span style={{ fontSize: 12, color: isToday ? T.teal : T.text, fontWeight: isToday ? 700 : 600 }}>{dateLabel}</span>
                  {(isToday || isYesterday) && <span style={{ fontSize: 10, color: T.textMuted, marginLeft: 4 }}>{formatDate(entry.date)}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 44, display: "flex", justifyContent: "center" }}>
                    {entry.diff != null ? (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                        background: entry.diff < 0 ? "#02C39A12" : entry.diff > 0 ? "#E85D4E12" : "#F0F0F0",
                        color: entry.diff < 0 ? T.mint : entry.diff > 0 ? T.coral : T.textMuted,
                      }}>{entry.diff > 0 ? "+" : ""}{entry.diff}</span>
                    ) : <span style={{ fontSize: 10, color: T.textMuted }}>—</span>}
                  </div>
                  <div style={{ width: 50, textAlign: "center" }}>
                    {entry.ritmo != null ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: entry.ritmo < 0 ? T.mint : entry.ritmo > 0 ? T.coral : T.textMuted }}>
                        {entry.ritmo > 0 ? "+" : ""}{entry.ritmo}
                      </span>
                    ) : <span style={{ fontSize: 10, color: T.textMuted }}>—</span>}
                  </div>
                  <div style={{ width: 60, textAlign: "right" }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{entry.weight} kg</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* INFO POPUPS */}
      <InfoPopup show={showTrendInfo} onClose={() => setShowTrendInfo(false)} title="Cos'è il Trend?">
        <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7 }}>
          Il peso sulla bilancia cambia ogni giorno per molte ragioni: quanta acqua hai bevuto, cosa hai mangiato, se hai fatto attività fisica. Queste oscillazioni possono essere di <strong>0.5–1.5 kg in un solo giorno</strong>.<br /><br />
          Il <strong>trend</strong> filtra queste oscillazioni e ti mostra la direzione reale del tuo peso.<br /><br />
          <span style={{ color: T.textMuted, fontSize: 12 }}>Tecnicamente usiamo una media mobile esponenziale (EMA) che pesa di più i giorni recenti.</span>
        </div>
      </InfoPopup>
      <InfoPopup show={showPredInfo} onClose={() => setShowPredInfo(false)} title="Come calcoliamo la previsione">
        <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7 }}>
          Guardiamo il tuo <strong>trend degli ultimi 14 giorni</strong> e calcoliamo quanto peso perdi in media a settimana.
          {metrics.weeklyRate != null && <><br /><br />Ritmo attuale: <strong>{metrics.weeklyRate} kg/settimana</strong></>}
          {metrics.weeksToGoal != null && <><br />Stima: <strong>~{metrics.weeksToGoal} settimane</strong> per raggiungere l'obiettivo</>}
        </div>
      </InfoPopup>
    </div>
  );
}
