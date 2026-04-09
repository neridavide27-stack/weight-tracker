"use client";
import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart, ReferenceArea,
} from "recharts";
import {
  Scale, Target, TrendingDown, TrendingUp, Calendar, Plus,
  ChevronLeft, Settings, Trash2, Award, Flame, ArrowDown,
  ArrowUp, Minus, Edit3, Check, X, ChevronRight, Activity,
  AlertCircle, Info, Clock, BarChart3, Heart, Eye, EyeOff,
} from "lucide-react";

/* ═══════════════════════════════════════════
   UTILITIES (same as main app)
   ═══════════════════════════════════════════ */

const formatDate = (d) => new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
const formatDateFull = (d) => new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
const toISO = (d) => new Date(d).toISOString().split("T")[0];
const today = () => toISO(new Date());

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

const CustomTooltip = ({ active, payload, T }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{
      background: T.card, borderRadius: 12, padding: "10px 14px",
      boxShadow: T.shadowLg, border: `1px solid ${T.tealLight}`,
    }}>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>{d.dateLabel || formatDate(d.date)}</div>
      {d.weight != null && <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Peso: {d.weight} kg</div>}
      {d.trend != null && <div style={{ fontSize: 12, color: T.teal, fontWeight: 600 }}>Trend: {d.trend} kg</div>}
    </div>
  );
};

/* ═══════════════════════════════════════════
   CARD 1: TREND (with Canvas chart)
   ═══════════════════════════════════════════ */

const TrendCard = ({ T, smoothed, settings, onShowHistory, onShowInfo }) => {
  const canvasRef = useRef(null);
  const tooltipRef = useRef(null);
  const chartGeoRef = useRef(null);

  // Always show full Mon–Sun of current week (7 slots, future days = empty)
  const last7 = useMemo(() => {
    if (smoothed.length === 0) return [];
    const now = new Date();
    const todayStr = toISO(now);
    const day = now.getDay() || 7; // Mon=1…Sun=7
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = toISO(d);
      const isFuture = dateStr > todayStr;
      const entry = smoothed.find(e => e.date === dateStr);
      if (entry) return { ...entry, isFuture: false, empty: false };
      const trend = isFuture ? null : getTrendAtDate(smoothed, dateStr);
      return { date: dateStr, weight: trend, trend, interpolated: true, isFuture, empty: trend == null };
    });
  }, [smoothed]);

  const currentTrend = last7[last7.length - 1]?.trend ?? null;
  const prevTrendValue = last7.length >= 2 ? last7[last7.length - 2]?.trend : null;
  const vsYesterday = (currentTrend != null && prevTrendValue != null)
    ? Math.round((currentTrend - prevTrendValue) * 100) / 100 : null;

  const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  // Draw canvas — 140px, always Lun–Dom, no area fill, handles empty/future slots
  useEffect(() => {
    if (!canvasRef.current || last7.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement.offsetWidth;
    const h = 140;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    ctx.scale(dpr, dpr);

    const n = 7; // always 7 slots
    const trends = last7.map(e => e.trend); // nulls for future/empty
    const dataIndices = last7.map((e, i) => e.empty ? null : i).filter(i => i !== null);

    const padL = 6, padR = 6, padTop = 8, padBot = 16;
    const chartW = w - padL - padR;
    const colW = chartW / n;
    const barValH = 13, barMaxH = 26, dayLabelH = 14;
    const trendAreaH = h - padTop - padBot - barValH - barMaxH - dayLabelH - 6;

    const trendTop = padTop;
    const barValTop = trendTop + trendAreaH + 2;
    const barTop = barValTop + barValH;
    const dayLabelTop = barTop + barMaxH + 2;

    const validTrends = dataIndices.map(i => trends[i]);
    const tMin = validTrends.length > 0 ? Math.min(...validTrends) - 0.15 : 0;
    const tMax = validTrends.length > 0 ? Math.max(...validTrends) + 0.15 : 1;

    const barCx = (i) => padL + colW * i + colW / 2;
    const barW = Math.min(colW * 0.48, 22);
    const lineLeft = barCx(0) - barW / 2;
    const lineRight = barCx(n - 1) + barW / 2;
    const lineSpan = lineRight - lineLeft;
    const tx = (i) => lineLeft + lineSpan * i / (n - 1);
    const ty = (v) => trendTop + ((tMax - v) / (tMax - tMin)) * trendAreaH;

    chartGeoRef.current = { tx, ty, trends, n, barCx, dataIndices };

    // Bezier curve — only connecting non-empty points, skip gaps
    if (dataIndices.length >= 2) {
      ctx.beginPath();
      let penDown = false;
      dataIndices.forEach((i, di) => {
        const x = tx(i), y = ty(trends[i]);
        if (!penDown) { ctx.moveTo(x, y); penDown = true; }
        else {
          // check if consecutive (no gap)
          const prevI = dataIndices[di - 1];
          if (i - prevI <= 2) {
            const px = tx(prevI), py = ty(trends[prevI]);
            ctx.bezierCurveTo((px + x) / 2, py, (px + x) / 2, y, x, y);
          } else {
            ctx.moveTo(x, y); // gap — lift pen
          }
        }
      });
      ctx.strokeStyle = "#028090"; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.stroke();
    } else if (dataIndices.length === 1) {
      const i = dataIndices[0];
      ctx.beginPath(); ctx.arc(tx(i), ty(trends[i]), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#028090"; ctx.fill();
    }

    // Dots — only for data indices
    dataIndices.forEach((i) => {
      const x = tx(i), y = ty(trends[i]);
      const isLast = i === dataIndices[dataIndices.length - 1];
      ctx.beginPath(); ctx.arc(x, y, isLast ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = isLast ? "#028090" : "rgba(2,128,144,0.45)"; ctx.fill();
      if (isLast) {
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(2,128,144,0.18)"; ctx.lineWidth = 2; ctx.stroke();
      }
    });

    // Bars — only for non-empty, non-future days
    const changes = last7.map((e, i) => {
      if (e.empty) return 0;
      const prevDataIdx = dataIndices.filter(di => di < i);
      if (prevDataIdx.length === 0) return 0;
      const prev = last7[prevDataIdx[prevDataIdx.length - 1]];
      return Math.round(((e.weight ?? 0) - (prev.weight ?? 0)) * 100) / 100;
    });
    const maxAbs = Math.max(...dataIndices.map(i => Math.abs(changes[i])), 0.05);
    dataIndices.forEach((i) => {
      const ch = changes[i];
      const cx = barCx(i);
      const bx = cx - barW / 2;
      const bH = Math.max(3, (Math.abs(ch) / maxAbs) * barMaxH);
      const by = barTop + (barMaxH - bH);
      const color = ch <= 0 ? "#02C39A" : "#E85D4E";
      const r = Math.min(4, bH / 2);
      ctx.beginPath();
      ctx.moveTo(bx + r, by); ctx.lineTo(bx + barW - r, by);
      ctx.quadraticCurveTo(bx + barW, by, bx + barW, by + r);
      ctx.lineTo(bx + barW, by + bH); ctx.lineTo(bx, by + bH);
      ctx.lineTo(bx, by + r); ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.closePath();
      const bGrad = ctx.createLinearGradient(0, by, 0, by + bH);
      bGrad.addColorStop(0, color); bGrad.addColorStop(1, color + "70");
      ctx.fillStyle = bGrad; ctx.fill();
      if (i > 0 && Math.abs(ch) >= 0.01) {
        ctx.font = "700 9px Inter, sans-serif";
        ctx.fillStyle = color; ctx.textAlign = "center";
        ctx.fillText((ch > 0 ? "+" : "") + ch.toFixed(2), cx, by - 3);
      }
    });

    // Day labels — ALL 7 days, always
    const todayStr = today();
    ctx.font = "600 9px Inter, sans-serif";
    last7.forEach((entry, i) => {
      const cx = barCx(i);
      const dayOfWeek = (new Date(entry.date).getDay() + 6) % 7; // 0=Mon
      const isToday = entry.date === todayStr;
      const isFut = entry.isFuture;
      ctx.fillStyle = isToday ? "#028090" : isFut ? "#D1D5DB" : "#B0B8C8";
      ctx.textAlign = "center";
      ctx.fillText(isToday ? "Oggi" : DAYS[dayOfWeek], cx, dayLabelTop + 10);
    });
  }, [last7]);

  // Touch / click handler — only snaps to slots with data
  const handleInteraction = useCallback((e) => {
    if (!canvasRef.current || !chartGeoRef.current || !tooltipRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = clientX - rect.left;
    const { tx, ty, trends, n, dataIndices } = chartGeoRef.current;

    let closest = -1, minDist = Infinity;
    (dataIndices || Array.from({ length: n }, (_, i) => i)).forEach(i => {
      const dist = Math.abs(tx(i) - x);
      if (dist < minDist && trends[i] != null) { minDist = dist; closest = i; }
    });
    if (closest === -1 || minDist > 36) { tooltipRef.current.style.opacity = "0"; return; }

    const dayOfWeek = (new Date(last7[closest].date).getDay() + 6) % 7;
    tooltipRef.current.textContent = trends[closest].toFixed(2) + " kg — " + DAYS[dayOfWeek];
    tooltipRef.current.style.left = tx(closest) + "px";
    tooltipRef.current.style.top = ty(trends[closest]) + "px";
    tooltipRef.current.style.opacity = "1";
  }, [last7]);

  const hideTooltip = useCallback(() => {
    if (tooltipRef.current) tooltipRef.current.style.opacity = "0";
  }, []);

  return (
    <div style={{
      background: "white", borderRadius: 22,
      boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
      overflow: "hidden", marginBottom: 14,
    }}>
      <div style={{ padding: "20px 20px 0" }}>
        {/* Top row: TREND label + Storico + ? */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{
            fontSize: 14, fontWeight: 800, color: T.text, lineHeight: "30px",
          }}>Trend</span>
          <span style={{ flex: 1 }} />
          <button onClick={onShowHistory} style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "0 13px", height: 30, borderRadius: 10,
            background: "#F0F8F8", border: "none", cursor: "pointer",
            fontFamily: "inherit", fontSize: 11, fontWeight: 700, color: "#028090",
          }}>
            <Clock size={13} /> Storico
          </button>
          <button onClick={onShowInfo} style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30, borderRadius: 10,
            background: "#F0F2F5", border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 800, color: "#9CA3AF",
          }}>?</button>
        </div>

        {/* Hero: 40px number + kg + badge 13px */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{
            fontSize: 40, fontWeight: 900, color: "#1A2030",
            letterSpacing: -1.5, lineHeight: 1,
          }}>{currentTrend ?? "—"}</span>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#9CA3AF" }}>kg</span>
          {vsYesterday != null && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "4px 10px", borderRadius: 8, marginLeft: 4,
              fontSize: 13, fontWeight: 700,
              background: vsYesterday < 0 ? "rgba(2,195,154,0.1)" : vsYesterday > 0 ? "rgba(232,93,78,0.1)" : "#F0F0F0",
              color: vsYesterday < 0 ? "#02C39A" : vsYesterday > 0 ? "#E85D4E" : "#9CA3AF",
            }}>
              {vsYesterday < 0 ? <ArrowDown size={11} /> : vsYesterday > 0 ? <ArrowUp size={11} /> : <Minus size={11} />}
              {Math.abs(vsYesterday)} vs ieri
            </div>
          )}
        </div>

        {/* Separator */}
        <div style={{ height: 1, background: "#F0F2F5", marginTop: 14 }} />
      </div>

      {/* Canvas chart — full width, edge-to-edge, 140px */}
      <div style={{ position: "relative" }}
        onClick={handleInteraction}
        onTouchStart={handleInteraction}
        onTouchMove={handleInteraction}
        onTouchEnd={hideTooltip}
        onMouseLeave={hideTooltip}
      >
        <canvas ref={canvasRef} style={{ width: "100%", display: "block" }} />
        <div ref={tooltipRef} style={{
          position: "absolute", pointerEvents: "none",
          background: "#1A2030", color: "#fff", borderRadius: 8,
          padding: "5px 10px", fontSize: 11, fontWeight: 700,
          whiteSpace: "nowrap", transform: "translate(-50%, -100%)",
          marginTop: -8, opacity: 0, transition: "opacity 0.15s",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }} />
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   CARD 2: GOAL (Enhanced)
   ═══════════════════════════════════════════ */

const GoalCard = ({ T, smoothed, settings, sorted }) => {
  const currentWeight = sorted[sorted.length - 1]?.weight;
  const currentTrend = smoothed[smoothed.length - 1]?.trend;

  // All useMemo hooks must be unconditional
  const allMilestones = useMemo(() => {
    if (!settings.showCustomMilestones || !settings.milestoneStep || !settings.startWeight || !settings.goalWeight || !currentWeight) return [];
    const step = settings.milestoneStep;
    const start = settings.startWeight;
    const goal = settings.goalWeight;
    const direction = start > goal ? -1 : 1;
    const ms = [];
    for (let w = start + direction * step; direction > 0 ? w <= goal : w >= goal; w += direction * step) {
      const wRounded = Math.round(w * 10) / 10;
      const reached = direction > 0 ? currentWeight >= wRounded : currentWeight <= wRounded;
      ms.push({ weight: wRounded, reached });
    }
    const goalReached = direction > 0 ? currentWeight >= goal : currentWeight <= goal;
    ms.push({ weight: Math.round(goal * 10) / 10, reached: goalReached, isGoal: true });
    return ms;
  }, [settings, currentWeight]);

  const milestoneWindow = useMemo(() => {
    if (allMilestones.length === 0) return null;
    const WINDOW = 5;
    const firstUnreached = allMilestones.findIndex(m => !m.reached);
    const pivotIdx = firstUnreached === -1 ? allMilestones.length : firstUnreached;
    const start = Math.max(0, Math.min(pivotIdx - 2, allMilestones.length - WINDOW));
    const end = Math.min(allMilestones.length, start + WINDOW);
    return {
      visible: allMilestones.slice(start, end),
      hasMoreBefore: start > 0,
      hasMoreAfter: end < allMilestones.length,
      reachedCount: allMilestones.filter(m => m.reached).length,
      total: allMilestones.length,
    };
  }, [allMilestones]);

  if (!settings.goalWeight || !settings.startWeight || !currentWeight || !currentTrend) return null;

  const total = Math.abs(settings.startWeight - settings.goalWeight);
  const done = Math.abs(settings.startWeight - currentWeight);
  const progressPct = total > 0 ? Math.min(Math.max((done / total) * 100, 0), 100) : 0;
  const kgMancanti = Math.round(Math.abs(currentWeight - settings.goalWeight) * 10) / 10;
  const kgPersi = Math.round(Math.abs(sorted[0].weight - currentWeight) * 10) / 10;

  const recent = smoothed.slice(-14);
  const reg = linearRegression(recent);
  const weeklyRate = reg ? Math.round(reg.slope * 7 * 100) / 100 : null;

  let predictedDate = null;
  let weeksToGoal = null;
  if (reg && reg.slope < 0 && settings.goalWeight) {
    const currentTrendEnd = reg.intercept + reg.slope * (recent.length - 1);
    const daysToGoal = (settings.goalWeight - currentTrendEnd) / reg.slope;
    if (daysToGoal > 0 && daysToGoal < 730) {
      const pd = new Date();
      pd.setDate(pd.getDate() + Math.round(daysToGoal));
      predictedDate = pd;
      weeksToGoal = Math.round(daysToGoal / 7);
    }
  }

  const currentBmi = settings.height ? calcBMI(currentWeight, settings.height) : null;
  const currentBmiCat = bmiCategory(currentBmi);
  const BMI_CATS = [
    { name: "Sottopeso",   short: "Sotto",    color: "#60A5FA", min: 0,    max: 18.5 },
    { name: "Normopeso",   short: "Normo",    color: "#10B981", min: 18.5, max: 25   },
    { name: "Sovrappeso",  short: "Sovra",    color: "#F59E0B", min: 25,   max: 30   },
    { name: "Obeso I",     short: "Ob.I",     color: "#EF4444", min: 30,   max: 35   },
    { name: "Obeso II",    short: "Ob.II",    color: "#B91C1C", min: 35,   max: 999  },
  ];
  const BMI_MIN = 15, BMI_MAX = 40;
  const bmiNeedlePct = currentBmi
    ? Math.min(Math.max((currentBmi - BMI_MIN) / (BMI_MAX - BMI_MIN) * 100, 1), 99)
    : null;

  let nextBmiInfo = null;
  if (settings.showBmiMilestones && currentBmi && settings.height) {
    const h = settings.height / 100;
    const catIdx = BMI_CATS.findIndex(c => currentBmi >= c.min && (c.max === 999 ? true : currentBmi < c.max));
    const cat = BMI_CATS[catIdx];
    if (cat && cat.max !== 999) {
      const targetW = Math.round(cat.max * h * h * 10) / 10;
      const kgTo = Math.round((currentWeight - targetW) * 10) / 10;
      nextBmiInfo = { kgTo, nextName: BMI_CATS[catIdx + 1]?.name };
    }
  }

  const RING_R = 38;
  const RING_CIRC = 2 * Math.PI * RING_R;
  const ringOffset = RING_CIRC - (progressPct / 100) * RING_CIRC;

  const showMilestones = settings.showCustomMilestones && milestoneWindow;
  const showBmi = settings.showBmiMilestones && settings.height && currentBmi;

  return (
    <div style={{ borderRadius: 22, overflow: "hidden", boxShadow: "0 2px 20px rgba(0,0,0,0.07)", marginBottom: 14 }}>

      {/* ── GRADIENT BANNER ── */}
      <div style={{
        background: T.gradient,
        padding: "18px 20px 18px", position: "relative", overflow: "hidden",
      }}>
        {/* Subtle decorative circles — positioned away from badge */}
        <div style={{ position: "absolute", bottom: -50, left: -30, width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: -20, left: 60, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

        {/* Top row: label + goal badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, position: "relative", zIndex: 1 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "rgba(255,255,255,0.6)" }}>Obiettivo</span>
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.18)", borderRadius: 10, padding: "5px 11px", fontSize: 13, fontWeight: 800, color: "#fff" }}>
            🎯 {settings.goalWeight} kg
          </div>
        </div>

        {/* Ring + 3-col stats row */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, position: "relative", zIndex: 1 }}>
          <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="88" height="88" style={{ transform: "rotate(-90deg)", position: "absolute" }}>
              <circle cx="44" cy="44" r={RING_R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
              <circle cx="44" cy="44" r={RING_R} fill="none" stroke="white" strokeWidth="6"
                strokeDasharray={RING_CIRC} strokeDashoffset={ringOffset}
                strokeLinecap="round" style={{ transition: "stroke-dashoffset 1.2s ease" }} />
            </svg>
            <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{Math.round(progressPct)}%</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>fatto</span>
            </div>
          </div>

          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 8px" }}>
            {[
              { label: "Persi",    value: `−${kgPersi} kg`,   accent: true  },
              { label: "Mancanti", value: `${kgMancanti} kg`, accent: false },
              { label: "Ritmo",    value: weeklyRate != null ? `${Math.abs(weeklyRate).toFixed(2)} kg/w` : "—", small: true },
            ].map(({ label, value, accent, small }) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: small ? 12 : 14, fontWeight: 800, color: accent ? "#A7F3E4" : "#fff", lineHeight: 1.1 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ETA strip — single source of truth for arrival date */}
        {predictedDate && weeksToGoal && (
          <div style={{ marginTop: 14, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", gap: 8, position: "relative", zIndex: 1 }}>
            <span style={{ fontSize: 12 }}>📅</span>
            <span style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>
              {predictedDate.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginLeft: "auto" }}>
              tra ~{weeksToGoal} {weeksToGoal === 1 ? "settimana" : "settimane"}
            </span>
          </div>
        )}
      </div>

      {/* ── BODY (tappe + bmi) ── */}
      {(showMilestones || showBmi) && (
        <div style={{ background: "#fff", padding: "18px 18px 20px" }}>

          {/* TAPPE INTERMEDIE */}
          {showMilestones && (
            <div style={{ marginBottom: showBmi ? 0 : 2 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 7, background: "#F0F8F8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>🏁</div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.6 }}>Tappe</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF" }}>
                  {milestoneWindow.reachedCount} / {milestoneWindow.total}
                </span>
              </div>

              <div style={{ position: "relative", padding: "4px 0 4px" }}>
                {/* Background line */}
                <div style={{
                  position: "absolute", top: 15, left: "10%", right: "10%",
                  height: 3, background: "#E8EDF2", borderRadius: 4, zIndex: 0,
                }}>
                  {(() => {
                    const vis = milestoneWindow.visible;
                    const firstUnreachedVis = vis.findIndex(m => !m.reached);
                    const fillPct = firstUnreachedVis === -1 ? 100 : vis.length > 1 ? (firstUnreachedVis / (vis.length - 1)) * 100 : 0;
                    return <div style={{ height: "100%", width: `${fillPct}%`, background: "linear-gradient(90deg, #028090, #02C39A)", borderRadius: 4 }} />;
                  })()}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
                  {/* Fade left if more before */}
                  {milestoneWindow.hasMoreBefore && (
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 28, background: "linear-gradient(90deg, #fff 60%, transparent)", zIndex: 2, pointerEvents: "none" }} />
                  )}
                  {/* Fade right if more after */}
                  {milestoneWindow.hasMoreAfter && (
                    <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 28, background: "linear-gradient(270deg, #fff 60%, transparent)", zIndex: 2, pointerEvents: "none" }} />
                  )}

                  {milestoneWindow.visible.map((m, i) => {
                    const isNext = !m.reached && (i === 0 || milestoneWindow.visible[i - 1]?.reached);
                    return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, flex: 1 }}>
                        <div style={{
                          width: isNext ? 24 : 18, height: isNext ? 24 : 18, borderRadius: "50%", flexShrink: 0,
                          background: m.reached ? "linear-gradient(135deg, #028090, #02C39A)" : isNext ? "#fff" : "#E8EDF2",
                          border: isNext ? "3px solid #028090" : "none",
                          boxShadow: m.reached ? "0 2px 8px rgba(2,195,154,0.3)" : isNext ? "0 0 0 4px rgba(2,128,144,0.12)" : "none",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {m.reached
                            ? <span style={{ color: "#fff", fontSize: 9, fontWeight: 800 }}>✓</span>
                            : isNext ? <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#028090" }} />
                            : null}
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: m.reached ? 700 : isNext ? 800 : 500,
                          color: m.reached ? "#02C39A" : isNext ? "#028090" : "#B0B8C8",
                          textDecoration: m.reached ? "line-through" : "none",
                          whiteSpace: "nowrap",
                        }}>
                          {m.weight} kg
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Divider between sections */}
          {showMilestones && showBmi && (
            <div style={{ height: 1, background: "#F0F2F5", margin: "18px 0" }} />
          )}

          {/* BMI */}
          {showBmi && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: 7, background: "#F0F8F8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>⚖️</div>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.6 }}>Traguardi BMI</span>
              </div>

              {/* Colored bar + vertical line marker */}
              <div style={{ position: "relative", marginBottom: 10 }}>
                <div style={{ display: "flex", height: 20, borderRadius: 7, overflow: "hidden" }}>
                  {BMI_CATS.map((cat, i) => {
                    const isCurrent = currentBmi >= cat.min && (cat.max === 999 || currentBmi < cat.max);
                    const isPassed = cat.max !== 999 && currentBmi >= cat.max;
                    return (
                      <div key={i} style={{
                        flex: 1, background: cat.color,
                        opacity: isPassed ? 0.55 : isCurrent ? 1 : 0.18,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{ fontSize: 7, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{cat.short}</span>
                      </div>
                    );
                  })}
                </div>
                {/* Vertical line marker — overlaps bar top and extends below */}
                {bmiNeedlePct != null && (
                  <div style={{
                    position: "absolute", top: -3, bottom: -8,
                    left: `${bmiNeedlePct}%`,
                    transform: "translateX(-50%)",
                    width: 2.5, background: "#111827", borderRadius: 2,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                  }} />
                )}
              </div>

              {/* Info line */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#F8F9FA", borderRadius: 8, padding: "8px 12px", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#028090" }}>BMI {currentBmi}</span>
                <span style={{ color: "#E0E4E8" }}>·</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#1A2030" }}>{currentBmiCat}</span>
                {nextBmiInfo && (
                  <>
                    <span style={{ color: "#E0E4E8" }}>·</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "#9CA3AF" }}>
                      −{nextBmiInfo.kgTo} kg → {nextBmiInfo.nextName}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   BOTTOM SHEET: HISTORY
   ═══════════════════════════════════════════ */

const HistoryBottomSheet = ({ T, show, onClose, smoothed, sorted, entries, setEntries }) => {
  const [editingEntry, setEditingEntry] = useState(null);
  const [editWeight, setEditWeight] = useState("");

  // Group by month (most recent first) with monthly variation
  const groupedByMonth = useMemo(() => {
    const groups = {};
    [...smoothed].reverse().forEach(entry => {
      const dateObj = new Date(entry.date);
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth()).padStart(2, "0")}`;
      if (!groups[monthKey]) {
        groups[monthKey] = { month: dateObj, entries: [], monthKey };
      }
      groups[monthKey].entries.push(entry);
    });

    // Calculate monthly variation: trend at 1st of next month - trend at 1st of current month
    // Uses getTrendAtDate for interpolation when exact dates are missing
    const groupArr = Object.values(groups);
    groupArr.forEach((g) => {
      const y = g.month.getFullYear();
      const m = g.month.getMonth();
      const firstOfMonth = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      const nextM = m === 11 ? 0 : m + 1;
      const nextY = m === 11 ? y + 1 : y;
      const firstOfNextMonth = `${nextY}-${String(nextM + 1).padStart(2, "0")}-01`;
      const trendStart = getTrendAtDate(smoothed, firstOfMonth);
      const trendEnd = getTrendAtDate(smoothed, firstOfNextMonth);
      g.monthVar = (trendStart != null && trendEnd != null)
        ? Math.round((trendEnd - trendStart) * 100) / 100 : null;
    });

    return groupArr;
  }, [smoothed]);

  const handleRowClick = (entry) => {
    setEditingEntry(entry);
    setEditWeight(String(entry.weight));
  };

  const handleSaveEdit = () => {
    if (!editingEntry) return;
    const w = parseFloat(editWeight.replace(",", "."));
    if (isNaN(w) || w < 20 || w > 300) return;
    setEntries(entries.map(e => e.id === editingEntry.id ? { ...e, weight: w } : e));
    setEditingEntry(null);
  };

  const handleDeleteEdit = () => {
    if (!editingEntry) return;
    setEntries(entries.filter(e => e.id !== editingEntry.id));
    setEditingEntry(null);
  };

  if (!show) return null;

  return (
    <div onClick={onClose} style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.4)",
      zIndex: 40,
      display: "flex",
      alignItems: "flex-end",
    }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: "24px 24px 0 0",
          width: "100%",
          maxHeight: "82vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Handle + Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: "#D1D5DB", margin: "0 auto 12px",
          }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#1A2030" }}>Storico</span>
            <button onClick={onClose} style={{
              background: "#F0F2F5", border: "none", borderRadius: 8,
              width: 28, height: 28, display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer",
            }}>
              <X size={14} color="#6B7280" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ overflow: "auto", flex: 1, padding: "10px 14px 40px", WebkitOverflowScrolling: "touch" }}>
          {groupedByMonth.map((group, groupIdx) => (
            <div key={groupIdx} style={{ marginBottom: 12 }}>
              {/* Month header — prominent with colored badge for variation */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                margin: groupIdx > 0 ? "16px 4px 8px" : "0 4px 8px", padding: "0 6px",
              }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#1A2030", textTransform: "capitalize" }}>
                  {group.month.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {group.monthVar != null && (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 800,
                      background: group.monthVar < 0 ? "rgba(2,195,154,0.1)" : group.monthVar > 0 ? "rgba(232,93,78,0.1)" : "#F0F0F0",
                      color: group.monthVar < 0 ? "#02C39A" : group.monthVar > 0 ? "#E85D4E" : "#9CA3AF",
                    }}>
                      {group.monthVar < 0 ? "▼" : group.monthVar > 0 ? "▲" : "="}{" "}
                      {group.monthVar > 0 ? "+" : ""}{group.monthVar} kg
                    </div>
                  )}
                  <div style={{
                    padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    background: "#F0F2F5", color: "#6B7280",
                  }}>
                    {group.entries.length} pesate
                  </div>
                </div>
              </div>

              {/* Column sub-headers per month */}
              <div style={{
                display: "grid", gridTemplateColumns: "1.3fr 0.9fr 0.9fr 0.8fr",
                padding: "4px 10px", marginBottom: 2, margin: "0 4px",
              }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: "#B0B8C8", textTransform: "uppercase", letterSpacing: 0.5 }}>Data</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: "#B0B8C8", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" }}>Peso</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: "#B0B8C8", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" }}>Trend</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: "#B0B8C8", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" }}>Var</span>
              </div>

              {/* Entries: Data | Peso | Trend | Var */}
              {group.entries.map((entry, idx) => {
                const dateObj = new Date(entry.date);
                const isToday = entry.date === today();
                const isYesterday = (() => { const y = new Date(); y.setDate(y.getDate() - 1); return entry.date === toISO(y); })();
                const mainLabel = isToday ? "Oggi" : isYesterday ? "Ieri" : dateObj.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
                const subLabel = (isToday || isYesterday) ? dateObj.toLocaleDateString("it-IT", { day: "numeric", month: "short" }) : "";

                // Variation vs previous entry in smoothed
                const smIdx = smoothed.findIndex(e => e.date === entry.date);
                const prevTrend = smIdx > 0 ? smoothed[smIdx - 1].trend : null;
                const variation = (entry.trend != null && prevTrend != null)
                  ? Math.round((entry.trend - prevTrend) * 100) / 100 : null;

                return (
                  <div
                    key={entry.id || idx}
                    onClick={() => handleRowClick(entry)}
                    style={{
                      display: "grid", gridTemplateColumns: "1.3fr 0.9fr 0.9fr 0.8fr",
                      alignItems: "center",
                      padding: "10px 10px",
                      background: "#F8F9FA",
                      borderRadius: 11,
                      marginBottom: 3,
                      margin: "0 4px 3px",
                      cursor: "pointer",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1A2030" }}>{mainLabel}</div>
                      {subLabel && <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 500 }}>{subLabel}</div>}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#6B7794", textAlign: "center" }}>
                      {entry.weight}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#028090", textAlign: "center" }}>
                      {entry.trend != null ? entry.trend.toFixed(1) : "—"}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, textAlign: "center",
                      color: variation != null ? (variation < 0 ? "#02C39A" : variation > 0 ? "#E85D4E" : "#9CA3AF") : "#9CA3AF",
                    }}>
                      {variation != null ? ((variation > 0 ? "+" : "") + variation.toFixed(2)) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Edit sub-sheet */}
      {editingEntry && (
        <div
          onClick={(e) => { e.stopPropagation(); setEditingEntry(null); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
            zIndex: 50, display: "flex", alignItems: "flex-end",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white", borderRadius: "20px 20px 0 0",
              width: "100%", padding: "24px 20px 32px",
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "#D1D5DB", margin: "0 auto 16px" }} />
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1A2030", marginBottom: 4 }}>
              Modifica peso
            </div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 20 }}>
              {new Date(editingEntry.date).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
            </div>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={editWeight}
              onChange={(e) => setEditWeight(e.target.value)}
              autoFocus
              style={{
                width: "100%", padding: "14px", borderRadius: 12,
                border: `1.5px solid ${T.teal}`, fontSize: 22, fontWeight: 800,
                textAlign: "center", color: T.text, fontFamily: "inherit", background: T.bg,
                marginBottom: 20,
              }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleDeleteEdit}
                style={{
                  flex: 1, padding: "12px", borderRadius: 12, border: `1.5px solid #EF4444`,
                  background: "white", color: "#EF4444", fontSize: 14, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Elimina
              </button>
              <button
                onClick={() => setEditingEntry(null)}
                style={{
                  flex: 1, padding: "12px", borderRadius: 12, border: `1.5px solid ${T.border}`,
                  background: "white", color: "#6B7280", fontSize: 14, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Annulla
              </button>
              <button
                onClick={handleSaveEdit}
                style={{
                  flex: 1, padding: "12px", borderRadius: 12, border: "none",
                  background: T.gradient, color: "#fff", fontSize: 14, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   OVERLAY: INFO
   ═══════════════════════════════════════════ */

const InfoOverlay = ({ T, show, onClose, alpha }) => {
  if (!show) return null;

  const a = alpha || 0.25;
  const oneMinusA = (1 - a).toFixed(2);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 22, padding: "24px 22px",
        maxWidth: 370, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        maxHeight: "82vh", overflow: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#1A2030" }}>Come leggere questa card</span>
          <button onClick={onClose} style={{
            background: "#F0F2F5", border: "none", borderRadius: 8,
            width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}><X size={14} color="#6B7280" /></button>
        </div>

        {/* Cos'è il Trend? */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: "#F0F8F8",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}><TrendingDown size={15} color="#028090" /></div>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#1A2030" }}>Cos'è il Trend?</span>
          </div>
          <p style={{ fontSize: 13, color: "#4A5568", lineHeight: 1.7, margin: 0 }}>
            Il peso sulla bilancia cambia ogni giorno per idratazione, pasto, stress — anche <strong>0.5–1.5 kg in un giorno</strong>. Il <strong>trend</strong> filtra queste oscillazioni e ti mostra la <strong>direzione reale</strong> del tuo peso.
          </p>
        </div>

        {/* Come si calcola? */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: "#F0F8F8",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}><Activity size={15} color="#028090" /></div>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#1A2030" }}>Come si calcola?</span>
          </div>
          <p style={{ fontSize: 13, color: "#4A5568", lineHeight: 1.7, margin: "0 0 10px" }}>
            Si usa una <strong>Media Mobile Esponenziale</strong> (EMA) con fattore α = {a.toFixed(2)}. Ogni giorno il nuovo trend combina il peso di oggi con il trend di ieri:
          </p>
          <div style={{
            background: "#F0F8F8", borderRadius: 12, padding: "14px 16px",
            fontSize: 12, lineHeight: 1.8,
          }}>
            <div style={{ fontFamily: "monospace", fontWeight: 600, color: "#028090" }}>
              trend_oggi = α × peso_oggi + (1 − α) × trend_ieri
            </div>
            <div style={{ fontFamily: "monospace", fontWeight: 600, color: "#028090" }}>
              trend_oggi = {a.toFixed(2)} × peso_oggi + {oneMinusA} × trend_ieri
            </div>
            <div style={{ fontSize: 11, color: "#6B7794", marginTop: 8, borderTop: "1px solid #E0ECED", paddingTop: 8 }}>
              <strong>α = {a.toFixed(2)}</strong> → il peso di oggi conta il {Math.round(a * 100)}%, il trend precedente il {Math.round((1 - a) * 100)}%.
              Il primo giorno il trend parte uguale al peso registrato.
              Puoi cambiare α nelle impostazioni.
            </div>
          </div>
        </div>

        {/* I grafici */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: "#F0F8F8",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}><BarChart3 size={15} color="#028090" /></div>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#1A2030" }}>I grafici</span>
          </div>
          <p style={{ fontSize: 13, color: "#4A5568", lineHeight: 1.7, margin: 0 }}>
            La <strong>linea teal</strong> mostra il trend degli ultimi 7 giorni (lun → dom). Le <strong>barre colorate</strong> mostrano la variazione giornaliera: <strong style={{ color: "#02C39A" }}>verde</strong> = calo, <strong style={{ color: "#E85D4E" }}>rosso</strong> = aumento. Tocca un punto della curva per vedere il valore.
          </p>
        </div>

        {/* Perché il trend? */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: "#F0F8F8",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}><AlertCircle size={15} color="#028090" /></div>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#1A2030" }}>Perché il trend e non il peso?</span>
          </div>
          <p style={{ fontSize: 13, color: "#4A5568", lineHeight: 1.7, margin: 0 }}>
            Un singolo giorno di peso anomalo <strong>non cambia quasi nulla</strong> nel trend. Questo ti evita ansie inutili e ti fa concentrare sul progresso reale settimana dopo settimana.
          </p>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   WEIGHT SECTION COMPONENT (Main)
   ═══════════════════════════════════════════ */

export default function WeightSection({ T, entries, setEntries, settings, setSettings, goTo, onAddRef }) {
  const [screen, setScreen] = useState("main");

  // Expose a way for parent to trigger "add" screen
  useEffect(() => {
    if (onAddRef) {
      onAddRef.current = () => setScreen("add");
    }
  }, [onAddRef]);
  const [newWeight, setNewWeight] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newDate, setNewDate] = useState(today());
  const [showInfo, setShowInfo] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chartRange, setChartRange] = useState("1M");
  const [chartSettings, setChartSettings] = useState({ showObjective: true, showBMIZones: false, showScale: true, showTrend: true });
  const [showChartSettings, setShowChartSettings] = useState(false);
  const [compTab, setCompTab] = useState("week");
  const [settingsForm, setSettingsForm] = useState({
    name: settings.name || "",
    height: settings.height || "",
    startWeight: settings.startWeight || "",
    goalWeight: settings.goalWeight || "",
    showCustomMilestones: settings.showCustomMilestones ?? false,
    milestoneStep: settings.milestoneStep ?? 2,
    showBmiMilestones: settings.showBmiMilestones ?? false,
    emaAlpha: settings.emaAlpha ?? 0.25,
  });
  const [showEmaInfo, setShowEmaInfo] = useState(false);

  // Core computations
  const sorted = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)), [entries]);
  const emaAlpha = settings.emaAlpha || 0.25;
  const smoothed = useMemo(() => calcEMA(sorted, emaAlpha), [sorted, emaAlpha]);

  // Chart data filtered by range
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

  const weightDomain = useMemo(() => {
    if (chartData.length === 0) return [60, 90];
    const weights = chartData.flatMap(d => [d.weight, d.trend].filter(v => v != null));
    return [Math.floor(Math.min(...weights) - 1), Math.ceil(Math.max(...weights) + 1)];
  }, [chartData]);

  const bmiZones = useMemo(() => {
    if (!settings.height) return [];
    const h = settings.height / 100; const h2 = h * h;
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
      const trend = getTrendAtDate(smoothed, date);
      const prevTrend = i < mondays.length - 1 ? getTrendAtDate(smoothed, mondays[i + 1]) : null;
      const diff = (trend != null && prevTrend != null) ? Math.round((trend - prevTrend) * 100) / 100 : null;
      const label = i === 0 ? "Questa settimana" : i === 1 ? "Settimana scorsa" : `-${i} settimane`;
      const end = new Date(date); end.setDate(end.getDate() + 6);
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
        const curr = smoothed[smoothedIdx], prev = smoothed[smoothedIdx - 1];
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
    setNewWeight("");
    setNewNote("");
    setNewDate(today());
    setScreen("main");
  }, [entries, newWeight, newNote, newDate, setEntries]);

  const saveSettings = useCallback(() => {
    if (setSettings) {
      setSettings(prev => ({ ...prev, ...settingsForm }));
    }
    setScreen("main");
  }, [settingsForm, setSettings]);

  // Settings computed values (must be before early returns for hooks rules)
  const previewMilestones = useMemo(() => {
    if (!settingsForm.showCustomMilestones || !settingsForm.startWeight || !settingsForm.goalWeight) return [];
    const step = settingsForm.milestoneStep || 2;
    const start = parseFloat(settingsForm.startWeight);
    const goal = parseFloat(settingsForm.goalWeight);
    if (!start || !goal || step <= 0) return [];
    const direction = start > goal ? -1 : 1;
    const result = [];
    for (let w = start + direction * step;
         direction > 0 ? w <= goal : w >= goal;
         w += direction * step) {
      result.push({ weight: Math.round(w * 10) / 10 });
    }
    result.push({ weight: Math.round(goal * 10) / 10, isGoal: true });
    return result;
  }, [settingsForm]);

  const bmiCategoryWeights = useMemo(() => {
    if (!settingsForm.showBmiMilestones || !settingsForm.height) return [];
    const h = settingsForm.height / 100;
    return [
      { name: "Sottopeso",  color: "#60A5FA", maxBMI: 18.5, maxWeight: Math.round(18.5 * h * h * 10) / 10 },
      { name: "Normopeso",  color: "#10B981", maxBMI: 25,   maxWeight: Math.round(25   * h * h * 10) / 10 },
      { name: "Sovrappeso", color: "#F59E0B", maxBMI: 30,   maxWeight: Math.round(30   * h * h * 10) / 10 },
      { name: "Obeso I",    color: "#EF4444", maxBMI: 35,   maxWeight: Math.round(35   * h * h * 10) / 10 },
      { name: "Obeso II",   color: "#B91C1C", maxBMI: 999,  maxWeight: 999 },
    ];
  }, [settingsForm]);

  /* ═══════════════════════════════════════
     SCREEN: ADD WEIGHT
     ═══════════════════════════════════════ */
  if (screen === "add") {
    const currentWeight = sorted.length > 0 ? sorted[sorted.length - 1].weight : null;
    const parsedNew = parseFloat(newWeight.replace(",", "."));
    const validNew = !isNaN(parsedNew) && parsedNew >= 20 && parsedNew <= 300;
    const diff = (validNew && currentWeight) ? Math.round((parsedNew - currentWeight) * 100) / 100 : null;

    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <div style={{ padding: "16px 20px 8px", background: T.bg, position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => setScreen("main")}
                style={{
                  background: T.card,
                  border: "none",
                  cursor: "pointer",
                  padding: 8,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  boxShadow: T.shadow,
                }}
              >
                <ChevronLeft size={20} color={T.teal} />
              </button>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0, letterSpacing: -0.5 }}>
                Nuovo Peso
              </h1>
            </div>
          </div>
        </div>
        <div style={{ padding: "30px 20px" }}>
          {currentWeight != null && (
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: T.textMuted }}>Peso attuale</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: T.text }}>
                {currentWeight} <span style={{ fontSize: 14, color: T.textMuted }}>kg</span>
              </div>
            </div>
          )}
          <div style={{ background: T.card, borderRadius: 20, padding: "24px 20px", boxShadow: T.shadow }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSec, display: "block", marginBottom: 8 }}>
                Data
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1.5px solid ${T.border}`,
                  fontSize: 14,
                  color: T.text,
                  fontFamily: "inherit",
                  background: T.bg,
                }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSec, display: "block", marginBottom: 8 }}>
                Peso (kg)
              </label>
              <input
                type="number"
                step="0.1"
                min="20"
                max="300"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                placeholder="es. 83.5"
                autoFocus
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: 12,
                  border: `1.5px solid ${validNew && newWeight ? T.teal : T.border}`,
                  fontSize: 22,
                  fontWeight: 800,
                  textAlign: "center",
                  color: T.text,
                  fontFamily: "inherit",
                  background: T.bg,
                }}
              />
              {diff != null && (
                <div style={{ textAlign: "center", marginTop: 10 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 14px",
                      borderRadius: 10,
                      background: diff < 0 ? "#02C39A12" : diff > 0 ? "#E85D4E12" : "#F0F0F0",
                      color: diff < 0 ? T.mint : diff > 0 ? T.coral : T.textMuted,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {diff < 0 ? <ArrowDown size={14} /> : diff > 0 ? <ArrowUp size={14} /> : <Minus size={14} />}
                    {diff > 0 ? "+" : ""}{diff} kg rispetto ad adesso
                  </span>
                </div>
              )}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSec, display: "block", marginBottom: 8 }}>
                Note (opzionale)
              </label>
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Come ti senti oggi?"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1.5px solid ${T.border}`,
                  fontSize: 14,
                  color: T.text,
                  fontFamily: "inherit",
                  background: T.bg,
                }}
              />
            </div>
            <button
              onClick={addEntry}
              disabled={!validNew}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 14,
                border: "none",
                background: validNew ? T.gradient : "#D1D5DB",
                color: "#fff",
                fontSize: 16,
                fontWeight: 800,
                cursor: validNew ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                boxShadow: validNew ? "0 4px 16px rgba(2,128,144,0.3)" : "none",
              }}
            >
              Registra peso
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     SCREEN: SETTINGS
     ═══════════════════════════════════════ */
  if (screen === "settings") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <div style={{ padding: "16px 20px 8px", background: T.bg, position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setScreen("main")}
              style={{
                background: T.card,
                border: "none",
                cursor: "pointer",
                padding: 8,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                boxShadow: T.shadow,
              }}
            >
              <ChevronLeft size={20} color={T.teal} />
            </button>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0 }}>Impostazioni</h1>
          </div>
        </div>
        <div style={{ padding: "20px" }}>
          {/* Profilo Card */}
          <div style={{ background: T.card, borderRadius: 20, padding: "20px", marginBottom: 16, boxShadow: T.shadow }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.textSec, marginBottom: 16 }}>Profilo</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSec, display: "block", marginBottom: 8 }}>
                Nome
              </label>
              <input
                type="text"
                value={settingsForm.name}
                onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1.5px solid ${T.border}`,
                  fontSize: 14,
                  color: T.text,
                  fontFamily: "inherit",
                  background: T.bg,
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSec, display: "block", marginBottom: 8 }}>
                Altezza (cm)
              </label>
              <input
                type="number"
                value={settingsForm.height}
                onChange={(e) => setSettingsForm({ ...settingsForm, height: parseInt(e.target.value) || 0 })}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1.5px solid ${T.border}`,
                  fontSize: 14,
                  color: T.text,
                  fontFamily: "inherit",
                  background: T.bg,
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSec, display: "block", marginBottom: 8 }}>
                Peso iniziale (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={settingsForm.startWeight}
                onChange={(e) => setSettingsForm({ ...settingsForm, startWeight: parseFloat(e.target.value) || 0 })}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1.5px solid ${T.border}`,
                  fontSize: 14,
                  color: T.text,
                  fontFamily: "inherit",
                  background: T.bg,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSec, display: "block", marginBottom: 8 }}>
                Peso obiettivo (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={settingsForm.goalWeight}
                onChange={(e) => setSettingsForm({ ...settingsForm, goalWeight: parseFloat(e.target.value) || 0 })}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1.5px solid ${T.border}`,
                  fontSize: 14,
                  color: T.text,
                  fontFamily: "inherit",
                  background: T.bg,
                }}
              />
            </div>
          </div>

          {/* Calcolo Trend Card */}
          <div style={{ background: T.card, borderRadius: 20, padding: "20px", marginBottom: 16, boxShadow: T.shadow }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: T.textSec, margin: 0 }}>Calcolo trend</h3>
              <button
                onClick={() => setShowEmaInfo(prev => !prev)}
                style={{
                  width: 26, height: 26, borderRadius: 8,
                  background: showEmaInfo ? "#E8F4F6" : "#F0F2F5",
                  border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 800,
                  color: showEmaInfo ? "#028090" : "#9CA3AF",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >?</button>
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSec, display: "block", marginBottom: 10 }}>
                EMA — sensibilità (α)
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {[0.20, 0.25, 0.30].map((a) => (
                  <button
                    key={a}
                    onClick={() => setSettingsForm({ ...settingsForm, emaAlpha: a })}
                    style={{
                      flex: 1, padding: "10px 0", borderRadius: 10,
                      border: settingsForm.emaAlpha === a ? "none" : `1.5px solid ${T.border}`,
                      background: settingsForm.emaAlpha === a ? T.gradient : T.bg,
                      color: settingsForm.emaAlpha === a ? "#fff" : T.text,
                      fontSize: 14, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {a.toFixed(2)}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 8 }}>
                {settingsForm.emaAlpha === 0.20 ? "Liscia — meno reattiva, filtra di più le oscillazioni"
                  : settingsForm.emaAlpha === 0.25 ? "Bilanciata — buon compromesso tra stabilità e reattività"
                  : "Reattiva — segue più da vicino le variazioni recenti"}
              </div>
            </div>

            {/* EMA Info expandable */}
            {showEmaInfo && (
              <div style={{
                background: T.bg, borderRadius: 14, padding: "16px",
                marginTop: 12, fontSize: 13, color: "#4A5568", lineHeight: 1.7,
              }}>
                <div style={{ fontWeight: 800, color: "#1A2030", marginBottom: 8, fontSize: 14 }}>
                  Cos'è l'EMA?
                </div>
                <p style={{ margin: "0 0 10px" }}>
                  La <strong>Media Mobile Esponenziale</strong> (EMA) filtra le oscillazioni quotidiane del peso (acqua, pasto, stress) e mostra la direzione reale.
                </p>
                <div style={{
                  background: "#F0F8F8", borderRadius: 10, padding: "12px 14px",
                  marginBottom: 12, fontFamily: "'SF Mono', monospace",
                  fontSize: 12, color: "#028090", fontWeight: 600,
                }}>
                  trend<sub>oggi</sub> = α × peso<sub>oggi</sub> + (1 − α) × trend<sub>ieri</sub>
                </div>
                <p style={{ margin: "0 0 10px" }}>
                  <strong>α</strong> controlla quanto il peso di oggi influenza il trend. Più α è alto, più il trend reagisce al peso odierno.
                </p>

                {/* Comparison table */}
                <div style={{ overflowX: "auto", marginTop: 12 }}>
                  <table style={{
                    width: "100%", borderCollapse: "collapse", fontSize: 11,
                    textAlign: "center",
                  }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                        <th style={{ padding: "6px 4px", textAlign: "left", fontWeight: 700, color: "#6B7280" }}></th>
                        <th style={{ padding: "6px 4px", fontWeight: 700, color: settingsForm.emaAlpha === 0.20 ? "#028090" : "#6B7280" }}>α 0.20</th>
                        <th style={{ padding: "6px 4px", fontWeight: 700, color: settingsForm.emaAlpha === 0.25 ? "#028090" : "#6B7280" }}>α 0.25</th>
                        <th style={{ padding: "6px 4px", fontWeight: 700, color: settingsForm.emaAlpha === 0.30 ? "#028090" : "#6B7280" }}>α 0.30</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Oggi",     "20.0%", "25.0%", "30.0%"],
                        ["Ieri",     "16.0%", "18.8%", "21.0%"],
                        ["2gg fa",   "12.8%", "14.1%", "14.7%"],
                        ["3gg fa",   "10.2%", "10.5%", "10.3%"],
                        ["4gg fa",   "8.2%",  "7.9%",  "7.2%"],
                      ].map(([label, ...vals], i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ padding: "5px 4px", textAlign: "left", fontWeight: 600, color: "#1A2030" }}>{label}</td>
                          {vals.map((v, j) => (
                            <td key={j} style={{ padding: "5px 4px", color: "#4A5568" }}>{v}</td>
                          ))}
                        </tr>
                      ))}
                      <tr style={{ borderBottom: `2px solid ${T.border}`, fontWeight: 700 }}>
                        <td style={{ padding: "5px 4px", textAlign: "left", color: "#1A2030" }}>Top 5</td>
                        <td style={{ padding: "5px 4px", color: "#028090" }}>67.2%</td>
                        <td style={{ padding: "5px 4px", color: "#028090" }}>76.3%</td>
                        <td style={{ padding: "5px 4px", color: "#028090" }}>83.2%</td>
                      </tr>
                      {[
                        ["7gg",      "79%",   "87%",   "92%"],
                        ["14gg",     "96%",   "98%",   "99.5%"],
                        ["Mezza vita", "3.1gg", "2.4gg", "1.9gg"],
                      ].map(([label, ...vals], i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ padding: "5px 4px", textAlign: "left", fontWeight: 600, color: "#1A2030" }}>{label}</td>
                          {vals.map((v, j) => (
                            <td key={j} style={{ padding: "5px 4px", color: "#4A5568" }}>{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ margin: "10px 0 0", fontSize: 11, color: "#9CA3AF" }}>
                  "Mezza vita" = dopo quanti giorni il 50% del trend è determinato dalle pesate più recenti.
                </p>
              </div>
            )}
          </div>

          {/* Obiettivo Card */}
          <div style={{ background: T.card, borderRadius: 20, padding: "20px", marginBottom: 16, boxShadow: T.shadow }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.textSec, marginBottom: 20 }}>Obiettivo</h3>

            {/* ── TAPPE INTERMEDIE ── */}
            <div>
              {/* Toggle row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: settingsForm.showCustomMilestones ? 16 : 0 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Tappe intermedie</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Suddividi il percorso in sotto-obiettivi</div>
                </div>
                <button
                  onClick={() => setSettingsForm(f => ({ ...f, showCustomMilestones: !f.showCustomMilestones }))}
                  style={{
                    width: 46, height: 26, borderRadius: 13, border: "none",
                    background: settingsForm.showCustomMilestones ? T.teal : "#D1D5DB",
                    position: "relative", cursor: "pointer", flexShrink: 0,
                    transition: "background 0.2s",
                  }}
                >
                  <div style={{
                    position: "absolute", top: 3,
                    left: settingsForm.showCustomMilestones ? 23 : 3,
                    width: 20, height: 20, borderRadius: 10, background: "#fff",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.18)", transition: "left 0.2s",
                  }} />
                </button>
              </div>

              {settingsForm.showCustomMilestones && (
                <div style={{ background: T.bg, borderRadius: 14, padding: "16px" }}>
                  {/* Stepper */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.textSec }}>Ogni quanti kg</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        onClick={() => setSettingsForm(f => ({ ...f, milestoneStep: Math.max(0.5, Math.round((f.milestoneStep - 0.5) * 10) / 10) }))}
                        style={{
                          width: 32, height: 32, borderRadius: 9, border: `1.5px solid ${T.border}`,
                          background: "#fff", fontSize: 18, fontWeight: 700, color: T.teal,
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          fontFamily: "inherit", lineHeight: 1,
                        }}
                      >−</button>
                      <span style={{ fontSize: 16, fontWeight: 800, color: T.text, minWidth: 52, textAlign: "center" }}>
                        {settingsForm.milestoneStep} kg
                      </span>
                      <button
                        onClick={() => setSettingsForm(f => ({ ...f, milestoneStep: Math.round((f.milestoneStep + 0.5) * 10) / 10 }))}
                        style={{
                          width: 32, height: 32, borderRadius: 9, border: `1.5px solid ${T.border}`,
                          background: "#fff", fontSize: 18, fontWeight: 700, color: T.teal,
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          fontFamily: "inherit", lineHeight: 1,
                        }}
                      >+</button>
                      {previewMilestones.length > 0 && (
                        <span style={{
                          fontSize: 12, fontWeight: 700, color: T.teal,
                          background: T.tealLight, padding: "4px 10px", borderRadius: 8, whiteSpace: "nowrap",
                        }}>
                          {previewMilestones.length} tappe
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Preview visuale */}
                  {previewMilestones.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 10 }}>Anteprima</div>
                      {previewMilestones.length <= 8 ? (
                        /* Poche tappe: mostra dot + peso */
                        <div style={{ display: "flex", alignItems: "flex-start", position: "relative" }}>
                          <div style={{
                            position: "absolute", top: 7, left: "5%", right: "5%",
                            height: 2, background: T.border, zIndex: 0,
                          }} />
                          {previewMilestones.map((m, i) => (
                            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative", zIndex: 1 }}>
                              <div style={{
                                width: m.isGoal ? 14 : 10, height: m.isGoal ? 14 : 10, borderRadius: "50%",
                                background: m.isGoal ? "#10B981" : T.teal,
                                boxShadow: m.isGoal ? "0 0 0 3px rgba(16,185,129,0.2)" : "none",
                              }} />
                              <span style={{ fontSize: 10, fontWeight: 600, color: m.isGoal ? "#10B981" : T.textSec, whiteSpace: "nowrap" }}>
                                {m.weight}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        /* Tante tappe: barra con tick marks */
                        <div>
                          <div style={{ position: "relative", height: 18, marginBottom: 8 }}>
                            <div style={{
                              position: "absolute", top: "50%", left: 0, right: 0,
                              height: 4, borderRadius: 4, transform: "translateY(-50%)",
                              background: `linear-gradient(90deg, ${T.teal}, #02C39A)`,
                            }}>
                              {previewMilestones.slice(0, -1).map((_, i) => {
                                const pct = ((i + 1) / previewMilestones.length) * 100;
                                return (
                                  <div key={i} style={{
                                    position: "absolute", top: "50%", left: `${pct}%`,
                                    transform: "translate(-50%, -50%)",
                                    width: 2, height: 10, background: "rgba(255,255,255,0.6)", borderRadius: 1,
                                  }} />
                                );
                              })}
                            </div>
                            <div style={{ position: "absolute", left: 0, top: "50%", transform: "translate(-50%,-50%)", width: 10, height: 10, borderRadius: "50%", background: T.teal }} />
                            <div style={{ position: "absolute", right: 0, top: "50%", transform: "translate(50%,-50%)", width: 12, height: 12, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 0 3px rgba(16,185,129,0.2)" }} />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.textMuted, fontWeight: 600 }}>
                            <span>{settingsForm.startWeight} kg</span>
                            <span>{settingsForm.goalWeight} kg</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ height: 1, background: T.border, margin: "20px 0" }} />

            {/* ── TRAGUARDI BMI ── */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: settingsForm.showBmiMilestones ? 16 : 0 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Traguardi BMI</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                    {settingsForm.height ? "Visualizza le fasce BMI nella card obiettivo" : "Imposta l'altezza nel profilo per abilitarla"}
                  </div>
                </div>
                <button
                  onClick={() => settingsForm.height && setSettingsForm(f => ({ ...f, showBmiMilestones: !f.showBmiMilestones }))}
                  style={{
                    width: 46, height: 26, borderRadius: 13, border: "none",
                    background: (settingsForm.showBmiMilestones && settingsForm.height) ? T.teal : "#D1D5DB",
                    position: "relative", cursor: settingsForm.height ? "pointer" : "not-allowed",
                    flexShrink: 0, transition: "background 0.2s",
                    opacity: settingsForm.height ? 1 : 0.45,
                  }}
                >
                  <div style={{
                    position: "absolute", top: 3,
                    left: (settingsForm.showBmiMilestones && settingsForm.height) ? 23 : 3,
                    width: 20, height: 20, borderRadius: 10, background: "#fff",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.18)", transition: "left 0.2s",
                  }} />
                </button>
              </div>

              {settingsForm.showBmiMilestones && bmiCategoryWeights.length > 0 && (
                <div style={{ background: T.bg, borderRadius: 14, padding: "16px" }}>
                  {/* BMI bar + vertical line marker */}
                  {(() => {
                    const currW = sorted.length > 0 ? sorted[sorted.length - 1]?.weight : null;
                    const bmi = currW && settingsForm.height ? calcBMI(currW, settingsForm.height) : null;
                    const pct = bmi ? Math.min(Math.max((bmi - 15) / (40 - 15) * 100, 1), 99) : null;
                    const catName = bmi ? bmiCategory(bmi) : null;
                    return (
                      <>
                        <div style={{ position: "relative", marginBottom: 10 }}>
                          <div style={{ display: "flex", height: 20, borderRadius: 7, overflow: "hidden" }}>
                            {bmiCategoryWeights.map((cat, i) => (
                              <div key={i} style={{ flex: 1, background: cat.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontSize: 7, fontWeight: 700, color: "#fff" }}>{cat.name.split(" ")[0]}</span>
                              </div>
                            ))}
                          </div>
                          {pct != null && (
                            <div style={{
                              position: "absolute", top: -3, bottom: -8,
                              left: `${pct}%`, transform: "translateX(-50%)",
                              width: 2.5, background: "#111827", borderRadius: 2,
                              boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                            }} />
                          )}
                        </div>
                        {bmi && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#028090", marginBottom: 12 }}>
                            BMI {bmi} · <span style={{ fontWeight: 600, color: "#1A2030" }}>{catName}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Categorie in griglia 2 colonne */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {bmiCategoryWeights.filter(c => c.maxBMI !== 999).map((cat, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: T.textSec, fontWeight: 600 }}>
                          {cat.name} <span style={{ color: T.textMuted, fontWeight: 500 }}>≤ {cat.maxWeight} kg</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reminders Card */}
          <div style={{ background: T.card, borderRadius: 20, padding: "20px", marginBottom: 24, boxShadow: T.shadow }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.textSec, marginBottom: 8 }}>Promemoria</h3>
            <p style={{ fontSize: 13, color: T.textMuted, margin: "0" }}>
              Prossimamente
            </p>
          </div>

          {/* Save Button */}
          <button
            onClick={saveSettings}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 14,
              border: "none",
              background: T.gradient,
              color: "#fff",
              fontSize: 16,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 4px 16px rgba(2,128,144,0.3)",
            }}
          >
            Salva
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     SCREEN: MAIN (Dashboard)
     ═══════════════════════════════════════ */
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* HEADER */}
      <div style={{ padding: "16px 16px 0", background: T.bg, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: T.gradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Scale size={18} color="#fff" />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0 }}>Peso</h1>
          </div>
          <button
            onClick={() => setScreen("settings")}
            style={{
              background: T.card,
              border: "none",
              cursor: "pointer",
              padding: 8,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              boxShadow: T.shadow,
            }}
          >
            <Settings size={20} color={T.teal} />
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ padding: "16px" }}>
        {/* Card 1: Trend */}
        {smoothed.length > 0 && (
          <TrendCard
            T={T}
            smoothed={smoothed}
            settings={settings}
            onShowHistory={() => setShowHistory(true)}
            onShowInfo={() => setShowInfo(true)}
          />
        )}

        {/* Card 2: Goal */}
        {sorted.length > 0 && (
          <GoalCard T={T} smoothed={smoothed} settings={settings} sorted={sorted} />
        )}

        {/* GRAFICO ANDAMENTO */}
        {chartData.length > 0 && (
          <div style={{ background: T.card, borderRadius: 18, padding: "16px 14px 8px", boxShadow: T.shadow, marginTop: 12 }}>
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
        )}

        {/* CONFRONTI */}
        {smoothed.length > 1 && (
          <div style={{ background: T.card, borderRadius: 18, padding: "16px", boxShadow: T.shadow, marginTop: 12 }}>
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
            {(compTab === "week" ? comparisons.weeklyData : comparisons.monthlyData).slice(0, 3).map((w) => (
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
                  {w.diff != null && (
                    <div style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8,
                      display: "inline-flex", alignItems: "center", gap: 3,
                      background: w.diff <= 0 ? "#02C39A12" : "#E85D4E12", color: w.diff <= 0 ? T.mint : T.coral,
                    }}>{w.diff <= 0 ? "↓" : "↑"} {w.diff > 0 ? "+" : ""}{w.diff} kg</div>
                  )}
                </div>
              </div>
            ))}
            <button onClick={() => setShowHistory(true)} style={{
              width: "100%", padding: "10px", border: `1px dashed ${T.border}`, borderRadius: 12,
              background: "transparent", fontSize: 12, fontWeight: 700, color: T.teal,
              cursor: "pointer", fontFamily: "'Inter', sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 2,
            }}>
              Vedi cronologia <ChevronRight size={13} />
            </button>
          </div>
        )}

        {/* ULTIME REGISTRAZIONI */}
        {recentWithRitmo.length > 0 && (
          <div style={{ background: T.card, borderRadius: 18, padding: "14px 16px", boxShadow: T.shadow, marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Ultime registrazioni</span>
              <button onClick={() => setShowHistory(true)} style={{
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
                  padding: isToday ? "8px 4px" : "8px 0", borderTop: `1px solid ${T.border}`,
                  background: isToday ? `${T.teal}06` : "transparent", borderRadius: isToday ? 8 : 0,
                  margin: isToday ? "0 -4px" : 0,
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
        )}

        {/* Empty state */}
        {sorted.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: "40px 20px",
            color: T.textMuted,
          }}>
            <Scale size={48} style={{ margin: "0 auto 16px", opacity: 0.5 }} />
            <p style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px 0" }}>Nessun dato</p>
            <p style={{ fontSize: 13, margin: 0 }}>Registra il tuo peso per iniziare</p>
          </div>
        )}
      </div>

      {/* Overlays */}
      <HistoryBottomSheet
        T={T}
        show={showHistory}
        onClose={() => setShowHistory(false)}
        smoothed={smoothed}
        sorted={sorted}
        entries={entries}
        setEntries={setEntries}
      />
      <InfoOverlay T={T} show={showInfo} onClose={() => setShowInfo(false)} alpha={emaAlpha} />
    </div>
  );
}
