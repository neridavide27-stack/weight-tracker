"use client";
import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Scale, Target, TrendingDown, TrendingUp, Calendar, Plus,
  ChevronLeft, Settings, Trash2, Award, Flame, ArrowDown,
  ArrowUp, Minus, Edit3, Check, X, ChevronRight, Activity,
  AlertCircle, Info, Clock, BarChart3, Heart, Eye, EyeOff,
} from "lucide-react";

/* ═══════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════ */

const formatDate = (d) => new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
const formatDateFull = (d) => new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
const toISO = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const today = () => {
  const now = new Date();
  return toISO(now);
};

const calcEMA = (entries, alpha = 0.25) => {
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
  if (!bmi) return null;
  if (bmi < 18.5) return "Sottopeso";
  if (bmi < 25)   return "Normopeso";
  if (bmi < 30)   return "Sovrappeso";
  if (bmi < 35)   return "Obeso I";
  return "Obeso II";
};

const bmiColor = (bmi) => {
  if (!bmi) return "#94a3b8";
  if (bmi < 18.5) return "#3b82f6";
  if (bmi < 25)   return "#22c55e";
  if (bmi < 30)   return "#f59e0b";
  if (bmi < 35)   return "#ef4444";
  return "#7c3aed";
};

/* ═══════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════ */

const THEMES = {
  light: {
    bg: "#f0f4f8",
    card: "#ffffff",
    text: "#1e293b",
    sub: "#64748b",
    border: "#e2e8f0",
    teal: "#0ea5e9",
    green: "#22c55e",
    red: "#ef4444",
    orange: "#f59e0b",
    purple: "#8b5cf6",
    accent: "#0ea5e9",
    pill: "#f1f5f9",
    pillText: "#475569",
    shadow: "0 2px 12px rgba(0,0,0,0.08)",
    shadowMd: "0 4px 24px rgba(0,0,0,0.12)",
    inputBg: "#f8fafc",
    navBg: "#ffffff",
    divider: "#f1f5f9",
  },
  dark: {
    bg: "#0f172a",
    card: "#1e293b",
    text: "#f1f5f9",
    sub: "#94a3b8",
    border: "#334155",
    teal: "#38bdf8",
    green: "#4ade80",
    red: "#f87171",
    orange: "#fbbf24",
    purple: "#a78bfa",
    accent: "#38bdf8",
    pill: "#334155",
    pillText: "#94a3b8",
    shadow: "0 2px 12px rgba(0,0,0,0.3)",
    shadowMd: "0 4px 24px rgba(0,0,0,0.4)",
    inputBg: "#0f172a",
    navBg: "#1e293b",
    divider: "#334155",
  },
};

/* ═══════════════════════════════════════════
   SNAPSHOT CARD  (Trend · BMI · Streak · Storico)
   ═══════════════════════════════════════════ */

function SnapshotCard({ smoothed, sorted, settings, T, onShowHistory }) {
  const currentTrend = smoothed.length > 0 ? smoothed[smoothed.length - 1].trend : null;
  const bmi = calcBMI(currentTrend, settings.height);
  const cat = bmiCategory(bmi);
  const catColor = bmiColor(bmi);

  const streak = useMemo(() => {
    if (sorted.length === 0) return 0;
    const dateSet = new Set(sorted.map((e) => e.date));
    const todayStr = today();
    const yd = new Date();
    yd.setDate(yd.getDate() - 1);
    const yesterdayStr = toISO(yd);
    if (!dateSet.has(todayStr) && !dateSet.has(yesterdayStr)) return 0;
    let cur = new Date(dateSet.has(todayStr) ? todayStr : yesterdayStr);
    let count = 0;
    while (dateSet.has(toISO(cur))) {
      count++;
      cur.setDate(cur.getDate() - 1);
    }
    return count;
  }, [sorted]);

  // Direction arrow
  const reg14 = useMemo(() => {
    const last14 = smoothed.slice(-14);
    return linearRegression(last14);
  }, [smoothed]);

  const direction = reg14
    ? reg14.slope < -0.01 ? "down" : reg14.slope > 0.01 ? "up" : "flat"
    : "flat";

  return (
    <div style={{
      background: T.card,
      borderRadius: 20,
      padding: "20px",
      boxShadow: T.shadow,
      marginBottom: 12,
    }}>
      {/* Top row: big trend number + direction */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.sub, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Tendenza attuale
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 52, fontWeight: 800, color: T.text, lineHeight: 1 }}>
              {currentTrend !== null ? currentTrend.toFixed(1) : "—"}
            </span>
            <span style={{ fontSize: 18, fontWeight: 600, color: T.sub }}>kg</span>
          </div>
        </div>

        {/* Direction indicator */}
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: direction === "down" ? `${T.green}22`
            : direction === "up" ? `${T.red}22`
            : `${T.sub}22`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {direction === "down" && <TrendingDown size={24} color={T.green} />}
          {direction === "up" && <TrendingUp size={24} color={T.red} />}
          {direction === "flat" && <Minus size={24} color={T.sub} />}
        </div>
      </div>

      {/* Pills row: BMI + Streak */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {/* BMI pill */}
        <div style={{
          flex: 1, borderRadius: 12, padding: "10px 14px",
          background: `${catColor}18`,
          border: `1.5px solid ${catColor}40`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: catColor, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>
            BMI
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: catColor }}>{bmi ?? "—"}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: catColor, opacity: 0.85 }}>{cat ?? ""}</span>
          </div>
        </div>

        {/* Streak pill */}
        <div style={{
          flex: 1, borderRadius: 12, padding: "10px 14px",
          background: streak > 0 ? "#f97316" + "18" : T.pill,
          border: `1.5px solid ${streak > 0 ? "#f97316" + "40" : T.border}`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: streak > 0 ? "#f97316" : T.sub, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>
            Streak
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: streak > 0 ? "#f97316" : T.sub }}>
              {streak > 0 ? "🔥" : "—"} {streak > 0 ? streak : ""}
            </span>
            {streak > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: "#f97316", opacity: 0.85 }}>giorni</span>}
          </div>
        </div>
      </div>

      {/* Storico button */}
      <button
        onClick={onShowHistory}
        style={{
          width: "100%", padding: "12px", borderRadius: 12,
          background: T.pill, border: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <Activity size={16} color={T.teal} />
        <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Storico misurazioni</span>
        <ChevronRight size={16} color={T.sub} />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   GOAL CARD
   ═══════════════════════════════════════════ */

function GoalCard({ smoothed, sorted, settings, T }) {
  const [showMilestones, setShowMilestones] = useState(false);

  const startWeight = sorted.length > 0 ? sorted[0].weight : null;
  const goalWeight  = settings.goalWeight;
  const height      = settings.height;
  const weeklyTarget = settings.weeklyTarget || 0.5;

  const currentTrend = smoothed.length > 0 ? smoothed[smoothed.length - 1].trend : null;

  const kgPersi   = startWeight && currentTrend ? Math.round((startWeight - currentTrend) * 10) / 10 : 0;
  const kgMancanti = currentTrend && goalWeight ? Math.round((currentTrend - goalWeight) * 10) / 10 : null;
  const progress   = startWeight && goalWeight && currentTrend
    ? Math.min(100, Math.max(0, Math.round(((startWeight - currentTrend) / (startWeight - goalWeight)) * 100)))
    : 0;

  // Linear regression on last 14 EMA points for actual pace
  const reg = useMemo(() => {
    const last14 = smoothed.slice(-14);
    return linearRegression(last14);
  }, [smoothed]);

  // ETA via actual regression pace
  const weeklyRateActual = reg ? Math.round(reg.slope * 7 * 100) / 100 : null;
  const predictedDateActual = useMemo(() => {
    if (!reg || !currentTrend || !goalWeight || reg.slope >= 0) return null;
    const daysNeeded = Math.ceil((currentTrend - goalWeight) / Math.abs(reg.slope));
    const d = new Date();
    d.setDate(d.getDate() + daysNeeded);
    return d;
  }, [reg, currentTrend, goalWeight]);

  // ETA via weekly target pace
  const weeksAtTarget = kgMancanti && weeklyTarget > 0 ? Math.ceil(kgMancanti / weeklyTarget) : null;
  const predictedDateTarget = useMemo(() => {
    if (!weeksAtTarget) return null;
    const d = new Date();
    d.setDate(d.getDate() + weeksAtTarget * 7);
    return d;
  }, [weeksAtTarget]);

  // Milestones
  const BMI_CATS = [
    { label: "Sovrappeso", bmi: 30, desc: "< 30 BMI" },
    { label: "Normopeso",  bmi: 25, desc: "< 25 BMI" },
    { label: "Sottopeso",  bmi: 18.5, desc: "< 18.5 BMI" },
  ];
  const h = height ? height / 100 : 1.75;
  const bmiMilestones = settings.showBmiMilestones
    ? BMI_CATS.map((c) => ({ label: c.label, target: Math.round(c.bmi * h * h * 10) / 10, desc: c.desc }))
        .filter((m) => m.target > goalWeight && m.target < (startWeight || 999))
    : [];

  const step = settings.milestoneStep || 2;
  const customMilestones = settings.showCustomMilestones && startWeight
    ? Array.from({ length: Math.floor((startWeight - goalWeight) / step) }, (_, i) => {
        const t = Math.round((startWeight - step * (i + 1)) * 10) / 10;
        return t > goalWeight ? { label: `${t} kg`, target: t } : null;
      }).filter(Boolean)
    : [];

  const allMilestones = [...bmiMilestones, ...customMilestones, { label: "🎯 Obiettivo!", target: goalWeight }]
    .sort((a, b) => b.target - a.target);

  const bmiNow = calcBMI(currentTrend, height);
  const catNow = bmiCategory(bmiNow);

  const goalReached = kgMancanti !== null && kgMancanti <= 0;

  return (
    <div style={{
      background: T.card,
      borderRadius: 20,
      padding: "20px",
      boxShadow: T.shadow,
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${T.teal}22`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Target size={18} color={T.teal} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Obiettivo</span>
        </div>
        {goalReached && (
          <span style={{
            fontSize: 12, fontWeight: 700, color: T.green,
            background: `${T.green}22`, padding: "4px 10px", borderRadius: 20,
          }}>🎉 Raggiunto!</span>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: T.sub }}>
            Inizio: <strong style={{ color: T.text }}>{startWeight ?? "—"} kg</strong>
          </span>
          <span style={{ fontSize: 12, color: T.sub }}>
            Obiettivo: <strong style={{ color: T.teal }}>{goalWeight ?? "—"} kg</strong>
          </span>
        </div>
        <div style={{ height: 10, borderRadius: 10, background: T.border, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${progress}%`,
            background: `linear-gradient(90deg, ${T.teal}, ${T.green})`,
            borderRadius: 10,
            transition: "width 0.5s ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 12, color: T.green }}>
            {kgPersi > 0 ? `−${kgPersi} kg persi` : "Nessun progresso ancora"}
          </span>
          <span style={{ fontSize: 12, color: T.sub }}>{progress}%</span>
        </div>
      </div>

      {/* Kg mancanti */}
      {kgMancanti !== null && kgMancanti > 0 && (
        <div style={{
          textAlign: "center", padding: "10px", borderRadius: 12,
          background: T.pill, marginBottom: 14,
        }}>
          <span style={{ fontSize: 13, color: T.sub }}>Ancora </span>
          <span style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{kgMancanti} kg</span>
          <span style={{ fontSize: 13, color: T.sub }}> all'obiettivo</span>
        </div>
      )}

      {/* Dual ETA strip */}
      {kgMancanti !== null && kgMancanti > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {/* Actual pace */}
          <div style={{
            flex: 1, borderRadius: 12, padding: "10px 12px",
            background: T.pill, border: `1px solid ${T.border}`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>
              Al tuo ritmo
            </div>
            {predictedDateActual ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                  {predictedDateActual.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
                </div>
                <div style={{ fontSize: 10, color: T.sub, marginTop: 1 }}>
                  {weeklyRateActual !== null ? `${weeklyRateActual > 0 ? "+" : ""}${weeklyRateActual} kg/sett` : ""}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: T.sub }}>Dati insufficienti</div>
            )}
          </div>

          {/* Target pace */}
          <div style={{
            flex: 1, borderRadius: 12, padding: "10px 12px",
            background: `${T.teal}12`, border: `1px solid ${T.teal}30`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.teal, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>
              All'obiettivo sett.
            </div>
            {predictedDateTarget ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                  {predictedDateTarget.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
                </div>
                <div style={{ fontSize: 10, color: T.teal, marginTop: 1 }}>
                  −{weeklyTarget} kg/sett
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: T.sub }}>—</div>
            )}
          </div>
        </div>
      )}

      {/* BMI current */}
      {bmiNow && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", borderRadius: 10, background: T.pill, marginBottom: 14,
        }}>
          <span style={{ fontSize: 12, color: T.sub }}>BMI attuale</span>
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: bmiColor(bmiNow),
            padding: "2px 10px", borderRadius: 20,
            background: `${bmiColor(bmiNow)}22`,
          }}>{bmiNow} · {catNow}</span>
        </div>
      )}

      {/* Milestones toggle */}
      {allMilestones.length > 1 && (
        <button
          onClick={() => setShowMilestones((v) => !v)}
          style={{
            width: "100%", padding: "10px", borderRadius: 10,
            background: "transparent", border: `1px solid ${T.border}`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <Award size={14} color={T.orange} />
          <span style={{ fontSize: 13, fontWeight: 600, color: T.sub }}>
            {showMilestones ? "Nascondi tappe" : `Tappe intermedie (${allMilestones.length})`}
          </span>
          <ChevronRight size={14} color={T.sub} style={{ transform: showMilestones ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
        </button>
      )}

      {/* Milestones list */}
      {showMilestones && (
        <div style={{ marginTop: 10 }}>
          {allMilestones.map((m, i) => {
            const done = currentTrend !== null && currentTrend <= m.target;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 0",
                borderBottom: i < allMilestones.length - 1 ? `1px solid ${T.divider}` : "none",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: done ? `${T.green}22` : T.pill,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {done ? <Check size={14} color={T.green} /> : <Target size={14} color={T.sub} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: done ? T.green : T.text }}>{m.label}</div>
                  {m.desc && <div style={{ fontSize: 11, color: T.sub }}>{m.desc}</div>}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: done ? T.green : T.sub }}>{m.target} kg</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   WEEK CARD  (Mon–Sun canvas chart + weekly progress)
   ═══════════════════════════════════════════ */

function WeekCard({ smoothed, sorted, settings, T, onWeeklyTargetChange }) {
  const canvasRef = useRef(null);
  const weeklyTarget = settings.weeklyTarget || 0.5;

  // Build Mon–Sun slots for current week
  const weekSlots = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = toISO(d);
      const isPast = d <= now;
      const entry = sorted.find((e) => e.date === iso) || null;
      const smooth = smoothed.find((e) => e.date === iso) || null;
      return {
        iso,
        label: ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"][i],
        isPast,
        isToday: iso === today(),
        weight: entry ? entry.weight : null,
        trend: smooth ? smooth.trend : null,
      };
    });
  }, [sorted, smoothed]);

  // Weekly delta: last measured weight this week vs first
  const weekWeights = weekSlots.filter((s) => s.weight !== null);
  const weekDelta = weekWeights.length >= 2
    ? Math.round((weekWeights[weekWeights.length - 1].weight - weekWeights[0].weight) * 100) / 100
    : weekWeights.length === 1
    ? null
    : null;

  // Progress toward weekly target (negative = good for weight loss)
  const weekProgress = weekDelta !== null && weeklyTarget > 0
    ? Math.min(100, Math.max(0, Math.round((Math.abs(weekDelta) / weeklyTarget) * 100)))
    : 0;
  const weekOnTrack = weekDelta !== null && weekDelta <= 0 && Math.abs(weekDelta) >= weeklyTarget * 0.5;

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, W, H);

    const padL = 36, padR = 10, padT = 14, padB = 38;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const colW = chartW / 7;
    const slotX = (i) => padL + colW * i + colW / 2;

    // Collect only the weights for scaling
    const allWeights = weekSlots.filter((s) => s.weight !== null).map((s) => s.weight);
    const allTrends  = weekSlots.filter((s) => s.trend !== null).map((s) => s.trend);
    const allVals    = [...allWeights, ...allTrends];

    if (allVals.length === 0) {
      // No data: draw empty state
      ctx.fillStyle = "#94a3b8";
      ctx.font = "13px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Nessuna misurazione questa settimana", W / 2, H / 2);
      return;
    }

    const minV = Math.min(...allVals) - 0.5;
    const maxV = Math.max(...allVals) + 0.5;
    const range = maxV - minV || 1;

    const toY = (v) => padT + chartH - ((v - minV) / range) * chartH;

    // Grid lines
    const numLines = 4;
    ctx.strokeStyle = "#e2e8f030";
    ctx.lineWidth = 1;
    for (let i = 0; i <= numLines; i++) {
      const v = minV + (range / numLines) * i;
      const y = toY(v);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillStyle = "#94a3b8";
      ctx.font = `10px system-ui`;
      ctx.textAlign = "right";
      ctx.fillText(v.toFixed(1), padL - 4, y + 3);
    }

    // Bar for each recorded day
    weekSlots.forEach((s, i) => {
      if (s.weight === null) return;
      const x = slotX(i);
      const y = toY(s.weight);
      const barH = toY(minV) - y;
      const barW = Math.max(colW * 0.45, 8);

      ctx.fillStyle = s.isToday
        ? "#0ea5e9" + "cc"
        : s.isPast
        ? "#94a3b8" + "66"
        : "#e2e8f044";
      ctx.beginPath();
      const bx = x - barW / 2, by = y, bw = barW, bh = barH, br = 4;
      if (ctx.roundRect) {
        ctx.roundRect(bx, by, bw, bh, br);
      } else {
        ctx.moveTo(bx + br, by);
        ctx.lineTo(bx + bw - br, by);
        ctx.arcTo(bx + bw, by, bx + bw, by + br, br);
        ctx.lineTo(bx + bw, by + bh);
        ctx.lineTo(bx, by + bh);
        ctx.lineTo(bx, by + br);
        ctx.arcTo(bx, by, bx + br, by, br);
        ctx.closePath();
      }
      ctx.fill();

      // Weight label above bar
      ctx.fillStyle = s.isToday ? "#0ea5e9" : "#64748b";
      ctx.font = `bold 10px system-ui`;
      ctx.textAlign = "center";
      ctx.fillText(s.weight.toFixed(1), x, y - 3);
    });

    // EMA trend line (only through days with trend values)
    const trendPoints = weekSlots.map((s, i) => s.trend !== null ? { x: slotX(i), y: toY(s.trend) } : null).filter(Boolean);
    if (trendPoints.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(trendPoints[0].x, trendPoints[0].y);
      for (let i = 1; i < trendPoints.length; i++) {
        const prev = trendPoints[i - 1];
        const curr = trendPoints[i];
        const cpX = (prev.x + curr.x) / 2;
        ctx.bezierCurveTo(cpX, prev.y, cpX, curr.y, curr.x, curr.y);
      }
      ctx.strokeStyle = "#0ea5e9";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.stroke();

      // Trend dots
      trendPoints.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#0ea5e9";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    // Day labels at bottom
    const DAY_LABELS = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
    DAY_LABELS.forEach((label, i) => {
      const x = slotX(i);
      const isToday = weekSlots[i].isToday;
      ctx.fillStyle = isToday ? "#0ea5e9" : "#94a3b8";
      ctx.font = isToday ? `bold 11px system-ui` : `11px system-ui`;
      ctx.textAlign = "center";
      ctx.fillText(label, x, H - padB + 14);

      // Today dot indicator
      if (isToday) {
        ctx.beginPath();
        ctx.arc(x, H - padB + 22, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#0ea5e9";
        ctx.fill();
      }
    });

  }, [weekSlots, T]);

  return (
    <div style={{
      background: T.card,
      borderRadius: 20,
      padding: "20px",
      boxShadow: T.shadow,
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${T.purple}22`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Calendar size={18} color={T.purple} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Questa settimana</span>
        </div>

        {/* Weekly target stepper */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => onWeeklyTargetChange(Math.max(0.1, weeklyTarget - 0.1))}
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: T.pill, border: `1px solid ${T.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Minus size={12} color={T.sub} />
          </button>
          <div style={{ textAlign: "center", minWidth: 52 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>−{weeklyTarget.toFixed(1)}</div>
            <div style={{ fontSize: 9, color: T.sub, lineHeight: 1 }}>kg/sett</div>
          </div>
          <button
            onClick={() => onWeeklyTargetChange(Math.min(2, weeklyTarget + 0.1))}
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: T.pill, border: `1px solid ${T.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Plus size={12} color={T.sub} />
          </button>
        </div>
      </div>

      {/* Canvas chart */}
      <div style={{ borderRadius: 12, overflow: "hidden", marginBottom: 14, background: T.inputBg }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: 180, display: "block" }}
        />
      </div>

      {/* Weekly progress */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: T.sub }}>Progresso settimanale</span>
          {weekDelta !== null && (
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: weekDelta < 0 ? T.green : T.red,
            }}>
              {weekDelta > 0 ? "+" : ""}{weekDelta} kg
            </span>
          )}
        </div>

        <div style={{ height: 8, borderRadius: 8, background: T.border, overflow: "hidden", marginBottom: 6 }}>
          <div style={{
            height: "100%",
            width: `${weekProgress}%`,
            background: weekOnTrack
              ? `linear-gradient(90deg, ${T.green}, ${T.teal})`
              : `linear-gradient(90deg, ${T.orange}, ${T.red})`,
            borderRadius: 8,
            transition: "width 0.4s ease",
          }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: T.sub }}>
            {weekWeights.length === 0
              ? "Nessuna misurazione questa settimana"
              : weekDelta === null
              ? "Serve almeno 2 misurazioni"
              : weekOnTrack
              ? "✅ In linea con l'obiettivo!"
              : Math.abs(weekDelta) < weeklyTarget
              ? `Mancano ancora ${(weeklyTarget - Math.abs(weekDelta)).toFixed(1)} kg all'obiettivo`
              : "⚠️ Fuori obiettivo"}
          </span>
          <span style={{ fontSize: 11, color: T.sub }}>{weekProgress}%</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   HISTORY BOTTOM SHEET
   ═══════════════════════════════════════════ */

function HistoryBottomSheet({ sorted, smoothed, settings, T, onDelete, onClose }) {
  const smoothedMap = useMemo(() => {
    const m = {};
    smoothed.forEach((e) => { m[e.date] = e.trend; });
    return m;
  }, [smoothed]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "flex-end",
    }}
    onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxHeight: "80vh",
          background: T.card,
          borderRadius: "20px 20px 0 0",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: T.border }} />
        </div>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 20px 12px",
        }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>Storico misurazioni</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={20} color={T.sub} />
          </button>
        </div>

        {/* List */}
        <div style={{ overflowY: "auto", flex: 1, padding: "0 20px 20px" }}>
          {sorted.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: T.sub }}>
              Nessuna misurazione registrata
            </div>
          ) : (
            [...sorted].reverse().map((e) => {
              const trend = smoothedMap[e.date];
              const bmi   = calcBMI(e.weight, settings.height);
              return (
                <div key={e.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 0",
                  borderBottom: `1px solid ${T.divider}`,
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: `${T.teal}18`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Scale size={18} color={T.teal} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{e.weight} kg</div>
                    <div style={{ fontSize: 12, color: T.sub }}>
                      {formatDateFull(e.date)}
                      {trend !== undefined && <span style={{ color: T.teal }}> · Trend: {trend?.toFixed(1)}</span>}
                    </div>
                  </div>
                  {bmi && (
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: bmiColor(bmi),
                      background: `${bmiColor(bmi)}22`,
                      padding: "2px 8px", borderRadius: 20,
                    }}>{bmi}</span>
                  )}
                  <button
                    onClick={() => onDelete(e.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}
                  >
                    <Trash2 size={16} color={T.red} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   REPORT SHEET (placeholder)
   ═══════════════════════════════════════════ */

function ReportSheet({ T, onClose }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxHeight: "80vh",
          background: T.card,
          borderRadius: "20px 20px 0 0",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: T.border }} />
        </div>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 20px 12px",
        }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>Report peso</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={20} color={T.sub} />
          </button>
        </div>

        {/* Placeholder content */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: 40, gap: 16,
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: `${T.teal}22`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <BarChart3 size={32} color={T.teal} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 6 }}>
              Report in arrivo
            </div>
            <div style={{ fontSize: 14, color: T.sub, lineHeight: 1.5 }}>
              Statistiche avanzate, grafici e analisi del progresso saranno disponibili qui.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   LOG ENTRY MODAL
   ═══════════════════════════════════════════ */

function LogEntryModal({ T, onSave, onClose }) {
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());

  const handleSave = () => {
    const w = parseFloat(weight);
    if (!w || w < 20 || w > 300) return;
    onSave({ weight: w, note, date });
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: T.card,
          borderRadius: "20px 20px 0 0",
          padding: "20px 20px 40px",
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: T.border }} />
        </div>

        <div style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 20 }}>
          Registra peso
        </div>

        {/* Weight input */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.sub, display: "block", marginBottom: 6 }}>
            Peso (kg)
          </label>
          <input
            type="number"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="es. 82.5"
            autoFocus
            style={{
              width: "100%", padding: "14px 16px",
              fontSize: 20, fontWeight: 700,
              background: T.inputBg, border: `1.5px solid ${T.border}`,
              borderRadius: 12, color: T.text,
              outline: "none", fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Date input */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.sub, display: "block", marginBottom: 6 }}>
            Data
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              width: "100%", padding: "12px 16px",
              fontSize: 15,
              background: T.inputBg, border: `1.5px solid ${T.border}`,
              borderRadius: 12, color: T.text,
              outline: "none", fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Note input */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.sub, display: "block", marginBottom: 6 }}>
            Nota (opzionale)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Come ti senti oggi?"
            style={{
              width: "100%", padding: "12px 16px",
              fontSize: 15,
              background: T.inputBg, border: `1.5px solid ${T.border}`,
              borderRadius: 12, color: T.text,
              outline: "none", fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!weight || parseFloat(weight) < 20 || parseFloat(weight) > 300}
          style={{
            width: "100%", padding: "15px",
            background: weight && parseFloat(weight) >= 20 ? T.teal : T.border,
            color: weight && parseFloat(weight) >= 20 ? "#fff" : T.sub,
            border: "none", borderRadius: 14,
            fontSize: 16, fontWeight: 700,
            cursor: weight ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            transition: "background 0.2s",
          }}
        >
          Salva misurazione
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SETTINGS SCREEN
   ═══════════════════════════════════════════ */

function SettingsScreen({ settings, T, onSave, onBack }) {
  const [local, setLocal] = useState({ ...settings });

  const set = (key, val) => setLocal((s) => ({ ...s, [key]: val }));

  const Toggle = ({ value, onToggle }) => (
    <div
      onClick={onToggle}
      style={{
        width: 44, height: 26, borderRadius: 13,
        background: value ? T.teal : T.border,
        cursor: "pointer", position: "relative",
        transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute",
        left: value ? 20 : 2, top: 2,
        width: 22, height: 22, borderRadius: 11,
        background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        transition: "left 0.2s",
      }} />
    </div>
  );

  const Card = ({ title, icon: Icon, iconColor, children }) => (
    <div style={{
      background: T.card, borderRadius: 16,
      padding: "16px", marginBottom: 14,
      boxShadow: T.shadow,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${iconColor}22`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={16} color={iconColor} />
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{title}</span>
      </div>
      {children}
    </div>
  );

  const Row = ({ label, sub, right }) => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 0",
      borderBottom: `1px solid ${T.divider}`,
    }}>
      <div>
        <div style={{ fontSize: 14, color: T.text }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: T.bg }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "16px 20px",
        background: T.card,
        borderBottom: `1px solid ${T.border}`,
      }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <ChevronLeft size={22} color={T.teal} />
        </button>
        <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>Impostazioni peso</span>
      </div>

      {/* Scrollable content — paddingBottom 100 so save button isn't hidden by nav */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 100px" }}>

        {/* Goal card */}
        <Card title="Obiettivo" icon={Target} iconColor={T.teal}>
          <Row
            label="Peso obiettivo"
            sub="Il tuo peso target finale"
            right={
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number"
                  step="0.5"
                  value={local.goalWeight || ""}
                  onChange={(e) => set("goalWeight", parseFloat(e.target.value) || local.goalWeight)}
                  style={{
                    width: 72, padding: "6px 10px", borderRadius: 8,
                    border: `1.5px solid ${T.border}`,
                    background: T.inputBg, color: T.text,
                    fontSize: 15, fontWeight: 700, textAlign: "right",
                    fontFamily: "inherit",
                  }}
                />
                <span style={{ fontSize: 13, color: T.sub }}>kg</span>
              </div>
            }
          />
          <Row
            label="Obiettivo settimanale"
            sub="Perdita target ogni settimana"
            right={
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => set("weeklyTarget", Math.round(Math.max(0.1, (local.weeklyTarget || 0.5) - 0.1) * 10) / 10)}
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: T.pill, border: `1px solid ${T.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer",
                  }}
                ><Minus size={12} color={T.sub} /></button>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.text, minWidth: 52, textAlign: "center" }}>
                  −{(local.weeklyTarget || 0.5).toFixed(1)} kg
                </span>
                <button
                  onClick={() => set("weeklyTarget", Math.round(Math.min(2, (local.weeklyTarget || 0.5) + 0.1) * 10) / 10)}
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: T.pill, border: `1px solid ${T.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer",
                  }}
                ><Plus size={12} color={T.sub} /></button>
              </div>
            }
          />
        </Card>

        {/* EMA card */}
        <Card title="Calcolo trend" icon={Activity} iconColor={T.purple}>
          <Row
            label="Sensibilità EMA (α)"
            sub={`α = ${local.emaAlpha || 0.25} · valori più alti = più reattivo`}
            right={
              <input
                type="range" min="0.05" max="0.5" step="0.05"
                value={local.emaAlpha || 0.25}
                onChange={(e) => set("emaAlpha", parseFloat(e.target.value))}
                style={{ width: 80, accentColor: T.purple }}
              />
            }
          />
        </Card>

        {/* Milestones card */}
        <Card title="Tappe & traguardi" icon={Award} iconColor={T.orange}>
          <Row
            label="Tappe personalizzate"
            sub={`Ogni ${local.milestoneStep || 2} kg`}
            right={<Toggle value={local.showCustomMilestones} onToggle={() => set("showCustomMilestones", !local.showCustomMilestones)} />}
          />
          {local.showCustomMilestones && (
            <div style={{ padding: "8px 0" }}>
              <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>Intervallo tappe</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[0.5, 1, 2, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() => set("milestoneStep", v)}
                    style={{
                      flex: 1, padding: "8px",
                      borderRadius: 8,
                      background: local.milestoneStep === v ? T.orange : T.pill,
                      border: `1px solid ${local.milestoneStep === v ? T.orange : T.border}`,
                      color: local.milestoneStep === v ? "#fff" : T.sub,
                      fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >{v} kg</button>
                ))}
              </div>
            </div>
          )}
          <Row
            label="Traguardi BMI"
            sub="Normopeso, sovrappeso, ecc."
            right={<Toggle value={local.showBmiMilestones} onToggle={() => set("showBmiMilestones", !local.showBmiMilestones)} />}
          />
        </Card>

        {/* Save button */}
        <button
          onClick={() => { onSave(local); onBack(); }}
          style={{
            width: "100%", padding: "15px",
            background: T.teal, color: "#fff",
            border: "none", borderRadius: 14,
            fontSize: 16, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Salva impostazioni
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN WEIGHT SECTION
   ═══════════════════════════════════════════ */

export default function WeightSection({ entries, settings, onAddEntry, onDeleteEntry, onUpdateSettings, darkMode, setEntries, setSettings, T: TProp }) {
  // Build full theme — merge any external T prop into the base theme, filling missing keys
  const baseTheme = THEMES[darkMode ? "dark" : "light"];
  const T = TProp ? {
    ...baseTheme,
    // Map app-T aliases → WeightSection names, then let explicit overrides win
    sub:      TProp.textSec   || TProp.sub      || baseTheme.sub,
    green:    TProp.mint      || TProp.green     || baseTheme.green,
    red:      TProp.coral     || TProp.red       || baseTheme.red,
    orange:   TProp.gold      || TProp.orange    || baseTheme.orange,
    pill:     TProp.tealLight || TProp.pill      || baseTheme.pill,
    pillText: TProp.textMuted || TProp.pillText  || baseTheme.pillText,
    shadowMd: TProp.shadowLg  || TProp.shadowMd  || baseTheme.shadowMd,
    inputBg:  TProp.bg        || TProp.inputBg   || baseTheme.inputBg,
    divider:  TProp.border    || TProp.divider   || baseTheme.divider,
    ...TProp,
  } : baseTheme;

  // Normalize callbacks — support both new-style (onAddEntry) and old-style (setEntries)
  const _addEntry = onAddEntry || (setEntries
    ? (data) => { const id = Date.now().toString(); setEntries((prev) => [...prev, { id, ...data }]); }
    : null);
  const _deleteEntry = onDeleteEntry || (setEntries
    ? (id) => setEntries((prev) => prev.filter((e) => e.id !== id))
    : null);
  const _updateSettings = onUpdateSettings || (setSettings ? (s) => setSettings(s) : null);

  const [screen, setScreen]         = useState("main"); // "main" | "settings"
  const [showLog, setShowLog]        = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showReport, setShowReport]  = useState(false);

  // Sorted entries (chronological)
  const sorted = useMemo(() =>
    [...entries].sort((a, b) => a.date.localeCompare(b.date)),
    [entries]
  );

  // EMA smoothed
  const smoothed = useMemo(() =>
    calcEMA(sorted, settings.emaAlpha || 0.25),
    [sorted, settings.emaAlpha]
  );

  // Handle new entry
  const handleAddEntry = useCallback((data) => {
    if (_addEntry) _addEntry(data);
  }, [_addEntry]);

  // Handle delete
  const handleDelete = useCallback((id) => {
    if (_deleteEntry) _deleteEntry(id);
  }, [_deleteEntry]);

  // Handle weekly target change from WeekCard stepper
  const handleWeeklyTargetChange = useCallback((val) => {
    if (_updateSettings) _updateSettings({ ...settings, weeklyTarget: Math.round(val * 10) / 10 });
  }, [settings, _updateSettings]);

  // Handle settings save
  const handleSaveSettings = useCallback((newSettings) => {
    if (_updateSettings) _updateSettings(newSettings);
  }, [_updateSettings]);

  /* ── Settings screen ── */
  if (screen === "settings") {
    return (
      <SettingsScreen
        settings={settings}
        T={T}
        onSave={handleSaveSettings}
        onBack={() => setScreen("main")}
      />
    );
  }

  /* ── Main dashboard ── */
  return (
    <div style={{ background: T.bg, minHeight: "100%", position: "relative" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px 12px",
        background: T.card,
        borderBottom: `1px solid ${T.border}`,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Peso</div>
          <div style={{ fontSize: 12, color: T.sub }}>
            {sorted.length > 0
              ? `${sorted.length} misurazioni · aggiornato ${formatDate(sorted[sorted.length - 1].date)}`
              : "Nessuna misurazione"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowLog(true)}
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: T.teal, border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Plus size={20} color="#fff" />
          </button>
          <button
            onClick={() => setScreen("settings")}
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: T.pill, border: `1px solid ${T.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Settings size={18} color={T.sub} />
          </button>
        </div>
      </div>

      {/* Cards */}
      <div style={{ padding: "16px 16px 120px" }}>
        {/* Empty state */}
        {entries.length === 0 && (
          <div style={{
            textAlign: "center", padding: "40px 20px",
            background: T.card, borderRadius: 20, marginBottom: 12,
            boxShadow: T.shadow,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚖️</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 8 }}>
              Nessuna misurazione
            </div>
            <div style={{ fontSize: 14, color: T.sub, marginBottom: 20 }}>
              Registra il tuo primo peso per iniziare a tracciare il progresso
            </div>
            <button
              onClick={() => setShowLog(true)}
              style={{
                padding: "12px 28px", background: T.teal, color: "#fff",
                border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Registra ora
            </button>
          </div>
        )}

        {entries.length > 0 && (
          <>
            <SnapshotCard
              smoothed={smoothed}
              sorted={sorted}
              settings={settings}
              T={T}
              onShowHistory={() => setShowHistory(true)}
            />
            <GoalCard
              smoothed={smoothed}
              sorted={sorted}
              settings={settings}
              T={T}
            />
            <WeekCard
              smoothed={smoothed}
              sorted={sorted}
              settings={settings}
              T={T}
              onWeeklyTargetChange={handleWeeklyTargetChange}
            />
          </>
        )}
      </div>

      {/* FAB Report */}
      <button
        onClick={() => setShowReport(true)}
        style={{
          position: "fixed", bottom: 86, right: 20, zIndex: 20,
          display: "flex", alignItems: "center", gap: 8,
          padding: "12px 20px", borderRadius: 50,
          background: T.card, border: "none", cursor: "pointer",
          boxShadow: T.shadowMd,
          fontFamily: "inherit",
        }}
      >
        <BarChart3 size={16} color={T.teal} />
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Report</span>
      </button>

      {/* Modals */}
      {showLog && (
        <LogEntryModal T={T} onSave={handleAddEntry} onClose={() => setShowLog(false)} />
      )}
      {showHistory && (
        <HistoryBottomSheet
          sorted={sorted}
          smoothed={smoothed}
          settings={settings}
          T={T}
          onDelete={handleDelete}
          onClose={() => setShowHistory(false)}
        />
      )}
      {showReport && (
        <ReportSheet T={T} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}
