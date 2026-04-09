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

  const last7 = useMemo(() => {
    if (smoothed.length === 0) return [];
    return smoothed.slice(-7);
  }, [smoothed]);

  const currentTrend = last7[last7.length - 1]?.trend ?? null;
  const prevTrendValue = last7.length >= 2 ? last7[last7.length - 2]?.trend : null;
  const vsYesterday = (currentTrend != null && prevTrendValue != null)
    ? Math.round((currentTrend - prevTrendValue) * 100) / 100 : null;

  // Draw canvas chart — matching preview layout exactly
  useEffect(() => {
    if (!canvasRef.current || last7.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement.offsetWidth;
    const h = 130;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    ctx.scale(dpr, dpr);

    const days = last7.map((e, i) => {
      if (i === last7.length - 1) return "Oggi";
      const d = new Date(e.date);
      return d.toLocaleDateString("it-IT", { weekday: "short" }).replace(".", "");
    });
    const trends = last7.map(e => e.trend);
    const changes = last7.map((e, i) => i === 0 ? 0 : Math.round((e.weight - last7[i - 1].weight) * 100) / 100);

    const padL = 10, padR = 10, padTop = 6, padBot = 16;
    const chartW = w - padL - padR;
    const colW = chartW / last7.length;

    const barValH = 13, barMaxH = 26, dayLabelH = 14;
    const trendAreaH = h - padTop - padBot - barValH - barMaxH - dayLabelH - 6;

    const trendTop = padTop;
    const barValTop = trendTop + trendAreaH + 2;
    const barTop = barValTop + barValH;
    const dayLabelTop = barTop + barMaxH + 2;

    const tMin = Math.min(...trends) - 0.15;
    const tMax = Math.max(...trends) + 0.15;

    const barCx = (i) => padL + colW * i + colW / 2;
    const lineLeft = barCx(0);
    const lineRight = barCx(last7.length - 1);
    const tx = (i) => lineLeft + (lineRight - lineLeft) * i / (last7.length - 1);
    const ty = (v) => trendTop + ((tMax - v) / (tMax - tMin)) * trendAreaH;

    // Area fill under trend
    ctx.beginPath();
    ctx.moveTo(tx(0), trendTop + trendAreaH);
    trends.forEach((v, i) => ctx.lineTo(tx(i), ty(v)));
    ctx.lineTo(tx(trends.length - 1), trendTop + trendAreaH);
    ctx.closePath();
    const aGrad = ctx.createLinearGradient(0, trendTop, 0, trendTop + trendAreaH);
    aGrad.addColorStop(0, "rgba(2,128,144,0.1)");
    aGrad.addColorStop(1, "rgba(2,128,144,0)");
    ctx.fillStyle = aGrad; ctx.fill();

    // Trend bezier curve
    ctx.beginPath();
    trends.forEach((v, i) => {
      const x = tx(i), y = ty(v);
      if (i === 0) ctx.moveTo(x, y);
      else {
        const px = tx(i - 1), py = ty(trends[i - 1]);
        ctx.bezierCurveTo((px + x) / 2, py, (px + x) / 2, y, x, y);
      }
    });
    ctx.strokeStyle = "#028090"; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.stroke();

    // Dots on trend
    trends.forEach((v, i) => {
      const x = tx(i), y = ty(v), isLast = i === trends.length - 1;
      ctx.beginPath(); ctx.arc(x, y, isLast ? 4 : 2, 0, Math.PI * 2);
      ctx.fillStyle = isLast ? "#028090" : "rgba(2,128,144,0.45)"; ctx.fill();
      if (isLast) {
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(2,128,144,0.18)"; ctx.lineWidth = 2; ctx.stroke();
      }
    });

    // Variation bars
    const maxAbs = Math.max(...changes.map(Math.abs), 0.05);
    const barW = Math.min(colW * 0.5, 24);

    changes.forEach((ch, i) => {
      if (i === 0) return; // no bar for first day
      const cx = barCx(i);
      const bx = cx - barW / 2;
      const bH = Math.max(3, (Math.abs(ch) / maxAbs) * barMaxH);
      const by = barTop + (barMaxH - bH);
      const color = ch <= 0 ? "#02C39A" : "#E85D4E";

      const r = 4;
      ctx.beginPath();
      ctx.moveTo(bx + r, by); ctx.lineTo(bx + barW - r, by);
      ctx.quadraticCurveTo(bx + barW, by, bx + barW, by + r);
      ctx.lineTo(bx + barW, by + bH); ctx.lineTo(bx, by + bH);
      ctx.lineTo(bx, by + r); ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.closePath();
      const bGrad = ctx.createLinearGradient(0, by, 0, by + bH);
      bGrad.addColorStop(0, color); bGrad.addColorStop(1, color + "70");
      ctx.fillStyle = bGrad; ctx.fill();

      ctx.font = "700 9px Inter, sans-serif";
      ctx.fillStyle = color; ctx.textAlign = "center";
      ctx.fillText((ch > 0 ? "+" : "") + ch.toFixed(1), cx, by - 3);
    });

    // Day labels
    ctx.font = "600 9px Inter, sans-serif";
    days.forEach((d, i) => {
      const cx = barCx(i);
      const isToday = i === days.length - 1;
      ctx.fillStyle = isToday ? "#028090" : "#B0B8C8";
      ctx.textAlign = "center";
      ctx.fillText(d, cx, dayLabelTop + 10);
    });
  }, [last7]);

  return (
    <div style={{
      background: "white",
      borderRadius: 22,
      boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
      overflow: "hidden",
      marginBottom: 14,
    }}>
      <div style={{ padding: "20px 20px 0" }}>
        {/* Top row: TREND label + Storico + ? */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: 0.8, color: "#9CA3AF",
          }}>Trend</span>
          <span style={{ flex: 1 }} />
          <button onClick={onShowHistory} style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "6px 12px", borderRadius: 10, height: 30,
            background: "#F0F8F8", border: "none", cursor: "pointer",
            fontFamily: "inherit", fontSize: 11, fontWeight: 700, color: "#028090",
          }}>
            <Clock size={14} /> Storico
          </button>
          <button onClick={onShowInfo} style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30, borderRadius: 10,
            background: "#F0F2F5", border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 800, color: "#9CA3AF",
          }}>?</button>
        </div>

        {/* Hero row: big number + kg + diff badge */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{
            fontSize: 48, fontWeight: 900, color: "#1A2030",
            letterSpacing: -2, lineHeight: 1,
          }}>
            {currentTrend ?? "—"}
          </span>
          <span style={{ fontSize: 17, fontWeight: 600, color: "#9CA3AF" }}>kg</span>
          {vsYesterday != null && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              padding: "4px 10px", borderRadius: 8, marginLeft: 4,
              fontSize: 12, fontWeight: 700,
              background: vsYesterday < 0 ? "rgba(2,195,154,0.1)" : vsYesterday > 0 ? "rgba(232,93,78,0.1)" : "#F0F0F0",
              color: vsYesterday < 0 ? "#02C39A" : vsYesterday > 0 ? "#E85D4E" : "#9CA3AF",
            }}>
              {vsYesterday < 0 ? <ArrowDown size={10} /> : vsYesterday > 0 ? <ArrowUp size={10} /> : <Minus size={10} />}
              {Math.abs(vsYesterday)} vs ieri
            </div>
          )}
        </div>
      </div>

      {/* Canvas chart — full width, edge-to-edge */}
      <div style={{ marginTop: 10 }}>
        <canvas ref={canvasRef} style={{ width: "100%", display: "block" }} />
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   CARD 2: GOAL (Enhanced)
   ═══════════════════════════════════════════ */

const GoalCard = ({ T, smoothed, settings, sorted }) => {
  if (!settings.goalWeight || !settings.startWeight) {
    return null;
  }

  const currentWeight = sorted[sorted.length - 1]?.weight;
  const currentTrend = smoothed[smoothed.length - 1]?.trend;

  if (!currentWeight || !currentTrend) return null;

  // Calculate progress
  const total = Math.abs(settings.startWeight - settings.goalWeight);
  const done = Math.abs(settings.startWeight - currentWeight);
  const progressPct = total > 0 ? Math.min(Math.max((done / total) * 100, 0), 100) : 0;

  // kg remaining
  const kgMancanti = Math.abs(Math.round((currentWeight - settings.goalWeight) * 10) / 10);

  // kg lost
  const kgPersi = Math.abs(Math.round((sorted[0].weight - currentWeight) * 100) / 100);

  // Weekly rate
  const recent = smoothed.slice(-14);
  const reg = linearRegression(recent);
  const weeklyRate = reg ? Math.round(reg.slope * 7 * 100) / 100 : null;

  // Predicted date
  let predictedDate = null;
  if (reg && reg.slope < 0 && settings.goalWeight) {
    const currentTrendEnd = reg.intercept + reg.slope * (recent.length - 1);
    const daysToGoal = (settings.goalWeight - currentTrendEnd) / reg.slope;
    if (daysToGoal > 0 && daysToGoal < 730) {
      const pd = new Date();
      pd.setDate(pd.getDate() + Math.round(daysToGoal));
      predictedDate = formatDateFull(pd);
    }
  }

  // Generate milestones for custom step
  const generateMilestones = () => {
    if (!settings.showCustomMilestones || !settings.milestoneStep) return [];
    const step = settings.milestoneStep;
    const start = settings.startWeight;
    const goal = settings.goalWeight;
    const direction = start > goal ? -1 : 1;
    const milestones = [];

    for (let w = start + direction * step;
         direction > 0 ? w <= goal : w >= goal;
         w += direction * step) {
      const reached = direction > 0 ? currentWeight >= w : currentWeight <= w;
      milestones.push({ weight: Math.round(w * 10) / 10, reached });
    }

    // Add goal itself
    milestones.push({ weight: goal, reached: currentWeight === goal });
    return milestones;
  };

  const milestones = generateMilestones();

  // Get last reached, current, and up to 2 future
  const displayMilestones = useMemo(() => {
    const lastReached = milestones.filter(m => m.reached).pop();
    const current = milestones.find(m => !m.reached);
    const future = milestones.filter(m => !m.reached && m.weight !== current?.weight).slice(0, 2);
    const result = [];
    if (lastReached) result.push({ ...lastReached, reached: true });
    if (current) result.push({ ...current, reached: false });
    result.push(...future);
    return result;
  }, [milestones]);

  // Trajectory chart data — actual trend + projected as separate keys
  const chartDataRaw = smoothed.map(e => ({
    ...e,
    dateLabel: formatDate(e.date),
    actual: e.trend,
    projected: null,
  }));
  if (reg && chartDataRaw.length > 0) {
    const lastEntry = smoothed[smoothed.length - 1];
    const lastDate = new Date(lastEntry.date);
    const startDate = new Date(smoothed[0].date);
    const daysElapsed = (lastDate - startDate) / 86400000;
    // Bridge: last actual point also gets a projected value
    chartDataRaw[chartDataRaw.length - 1].projected = lastEntry.trend;

    for (let i = 1; i <= 60; i++) {
      const futureDate = new Date(lastDate);
      futureDate.setDate(futureDate.getDate() + i);
      const daysSinceStart = daysElapsed + i;
      const projectedValue = Math.round((reg.intercept + reg.slope * daysSinceStart) * 100) / 100;
      chartDataRaw.push({
        date: toISO(futureDate),
        dateLabel: formatDate(futureDate),
        actual: null,
        projected: projectedValue,
        trend: projectedValue,
      });
    }
  }

  // BMI milestones if enabled
  const bmiMilestones = useMemo(() => {
    if (!settings.showBmiMilestones || !settings.height) return [];
    const h = settings.height / 100;
    const categories = [
      { name: "Sottopeso", color: "#60A5FA", min: 0, max: 18.5 },
      { name: "Normopeso", color: "#10B981", min: 18.5, max: 25 },
      { name: "Sovrappeso", color: "#F59E0B", min: 25, max: 30 },
      { name: "Obesità", color: "#EF4444", min: 30, max: 999 },
    ];

    return categories.map(cat => {
      const weightAtMin = cat.min * h * h;
      const weightAtMax = cat.max * h * h;
      const currentBmi = calcBMI(currentWeight, settings.height);
      const reached = settings.startWeight > weightAtMax || (settings.startWeight > weightAtMin && currentWeight <= weightAtMax);
      return { ...cat, weightAtMin: Math.round(weightAtMin * 10) / 10, reached };
    });
  }, [settings, currentWeight]);

  return (
    <div style={{
      background: "white",
      borderRadius: 22,
      padding: "20px",
      boxShadow: T.shadow,
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#6B7280" }}>OBIETTIVO</span>
        <span style={{ fontSize: 18, fontWeight: 800, color: T.teal }}>{settings.goalWeight} kg</span>
      </div>

      {/* Progress ring + stats */}
      <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress percentage={progressPct} size={90} strokeWidth={5} color={T.teal} />
          <div style={{ fontSize: 24, fontWeight: 800, color: T.text, marginTop: 12 }}>
            {Math.round(progressPct)}%
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>Persi</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.teal }}>{kgPersi} kg</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>Mancanti</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1A2030" }}>{kgMancanti} kg</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>Ritmo</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1A2030" }}>
              {weeklyRate != null ? `${Math.abs(weeklyRate).toFixed(2)} kg/sett` : "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>Previsione</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.teal }}>
              {predictedDate ? formatDateFull(new Date(predictedDate)) : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Custom Milestones */}
      {settings.showCustomMilestones && displayMilestones.length > 0 && (
        <>
          <div style={{ height: 1, background: T.border, marginBottom: 20 }} />
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 12 }}>Tappe</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
              {/* Timeline line */}
              <div style={{
                position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: T.border, zIndex: 0,
                transform: "translateY(-50%)"
              }} />
              {/* Dots */}
              {displayMilestones.map((m, i) => {
                const isCurrent = !m.reached && displayMilestones[i + 1]?.reached === false;
                const color = m.reached ? "#10B981" : isCurrent ? "#028090" : "#D1D5DB";
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, zIndex: 1 }}>
                    <div style={{
                      width: isCurrent ? 16 : 12, height: isCurrent ? 16 : 12,
                      borderRadius: "50%", background: color, border: isCurrent ? `3px solid ${T.bg}` : "none",
                      boxShadow: isCurrent ? `0 0 0 2px ${T.teal}` : "none"
                    }} />
                    <div style={{
                      fontSize: 11, fontWeight: m.reached ? 600 : isCurrent ? 700 : 500,
                      color: m.reached ? "#10B981" : isCurrent ? T.text : "#9CA3AF",
                      marginTop: 8, textDecoration: m.reached ? "line-through" : "none"
                    }}>
                      {m.weight}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* BMI Milestones */}
      {settings.showBmiMilestones && bmiMilestones.length > 0 && (
        <>
          <div style={{ height: 1, background: T.border, marginBottom: 20 }} />
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 12 }}>Traguardi BMI</div>
            <div style={{ display: "flex", height: 20, borderRadius: 10, overflow: "hidden", gap: 0 }}>
              {bmiMilestones.map((cat, i) => (
                <div key={i} style={{
                  flex: 1, background: cat.color, opacity: cat.reached ? 1 : 0.4,
                  borderRight: i < bmiMilestones.length - 1 ? `2px solid white` : "none"
                }} />
              ))}
            </div>
            <div style={{ display: "flex", fontSize: 10, color: "#6B7280", marginTop: 8, gap: 2 }}>
              {bmiMilestones.map((cat, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center" }}>
                  {cat.weightAtMin} kg
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Trajectory chart */}
      <div style={{ height: 1, background: T.border, marginBottom: 20 }} />
      <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 8 }}>Traiettoria</div>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={chartDataRaw} margin={{ top: 5, right: 8, left: -15, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 9, fill: "#9CA3AF" }} tickLine={false} axisLine={false} interval={Math.floor(chartDataRaw.length / 5)} />
          <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 9, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip T={T} />} cursor={false} />
          <ReferenceLine y={settings.goalWeight} stroke="#10B981" strokeDasharray="4 4" strokeWidth={1.5} />
          <Line type="monotone" dataKey="actual" stroke={T.teal} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
          <Line type="monotone" dataKey="projected" stroke={T.teal} strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
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

    // Calculate monthly variation: trend last day - trend first day of month
    const groupArr = Object.values(groups);
    groupArr.forEach((g, gIdx) => {
      // entries are in reverse order (most recent first), so first = last day, last = first day
      const lastTrend = g.entries[0]?.trend;
      // For "first of month" trend: use the first entry of previous month group as boundary,
      // or the earliest entry in this month
      const firstTrend = g.entries[g.entries.length - 1]?.trend;
      g.monthVar = (lastTrend != null && firstTrend != null) ? Math.round((lastTrend - firstTrend) * 100) / 100 : null;
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
              {/* Month header with variation + count */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                margin: "0 4px", padding: "0 10px", marginBottom: 4, marginTop: groupIdx > 0 ? 12 : 0,
              }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#1A2030", textTransform: "capitalize" }}>
                  {group.month.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF" }}>
                  {group.monthVar != null && (
                    <span style={{ color: group.monthVar < 0 ? "#02C39A" : group.monthVar > 0 ? "#E85D4E" : "#9CA3AF" }}>
                      {group.monthVar > 0 ? "+" : ""}{group.monthVar} kg
                    </span>
                  )}
                  {" · "}{group.entries.length} pesate
                </span>
              </div>

              {/* Column sub-headers per month */}
              <div style={{
                display: "grid", gridTemplateColumns: "1.4fr 1fr 0.7fr 1fr",
                padding: "4px 10px", marginBottom: 2, margin: "0 4px",
              }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: "#B0B8C8", textTransform: "uppercase", letterSpacing: 0.5 }}>Data</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: "#B0B8C8", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right" }}>Trend</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: "#B0B8C8", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" }}>Var</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: "#B0B8C8", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right" }}>Peso</span>
              </div>

              {/* Entries: Data | Trend | Var | Peso */}
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
                      display: "grid", gridTemplateColumns: "1.4fr 1fr 0.7fr 1fr",
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
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#028090", textAlign: "right" }}>
                      {entry.trend != null ? entry.trend.toFixed(1) : "—"}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, textAlign: "center",
                      color: variation != null ? (variation < 0 ? "#02C39A" : variation > 0 ? "#E85D4E" : "#9CA3AF") : "#9CA3AF",
                    }}>
                      {variation != null ? ((variation > 0 ? "+" : "") + variation.toFixed(2)) : "—"}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#6B7794", textAlign: "right" }}>
                      {entry.weight}
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

const InfoOverlay = ({ T, show, onClose }) => {
  if (!show) return null;

  return (
    <div onClick={onClose} style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.4)",
      zIndex: 40,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: "24px 20px",
          maxWidth: 360,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          maxHeight: "80vh",
          overflow: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#1A2030" }}>Come funziona</span>
          <button
            onClick={onClose}
            style={{
              background: "#F0F0F0",
              border: "none",
              borderRadius: 8,
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={14} color="#6B7280" />
          </button>
        </div>

        {/* Section 1: Cos'è il Trend? */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <TrendingDown size={18} color="#028090" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1A2030" }}>Cos'è il Trend?</span>
          </div>
          <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5, margin: 0 }}>
            Il trend è una media mobile esponenziale (EMA) che filtra le fluttuazioni quotidiane e rivela il vero andamento del tuo peso.
          </p>
          <div style={{
            background: "#F0F8F8",
            borderRadius: 12,
            padding: 12,
            marginTop: 10,
            fontSize: 12,
            color: "#028090",
            fontFamily: "monospace",
          }}>
            trend = peso × 0.15 + trend_ieri × 0.85
          </div>
        </div>

        {/* Section 2: Perché il trend? */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Activity size={18} color="#028090" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1A2030" }}>Perché il trend?</span>
          </div>
          <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5, margin: 0 }}>
            Il peso varia ogni giorno per tanti motivi: idratazione, cibo, stress. Il trend elimina questo rumore e mostra il progresso reale.
          </p>
        </div>

        {/* Section 3: I grafici */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <BarChart3 size={18} color="#028090" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1A2030" }}>I grafici</span>
          </div>
          <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5, margin: 0 }}>
            <strong>Linea teal:</strong> il tuo trend settimanale. <strong>Barre:</strong> variazioni giornaliere (verde = calo, rosso = aumento).
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
  });

  // Core computations
  const sorted = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)), [entries]);
  const smoothed = useMemo(() => calcEMA(sorted), [sorted]);

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
    const start = settingsForm.startWeight;
    const goal = settingsForm.goalWeight;
    const direction = start > goal ? -1 : 1;
    const result = [];
    for (let w = start + direction * step;
         direction > 0 ? w <= goal : w >= goal;
         w += direction * step) {
      result.push({ weight: Math.round(w * 10) / 10 });
    }
    result.push({ weight: goal });
    return result.slice(0, 5);
  }, [settingsForm]);

  const bmiCategoryWeights = useMemo(() => {
    if (!settingsForm.showBmiMilestones || !settingsForm.height) return [];
    const h = settingsForm.height / 100;
    return [
      { name: "Sottopeso", color: "#60A5FA", maxBMI: 18.5, maxWeight: 18.5 * h * h },
      { name: "Normopeso", color: "#10B981", maxBMI: 25, maxWeight: 25 * h * h },
      { name: "Sovrappeso", color: "#F59E0B", maxBMI: 30, maxWeight: 30 * h * h },
      { name: "Obesità", color: "#EF4444", maxBMI: 999, maxWeight: 999 },
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

          {/* Obiettivo Card */}
          <div style={{ background: T.card, borderRadius: 20, padding: "20px", marginBottom: 16, boxShadow: T.shadow }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.textSec, marginBottom: 16 }}>Obiettivo</h3>

            {/* Tappe intermedie */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Tappe intermedie</span>
                <input
                  type="checkbox"
                  checked={settingsForm.showCustomMilestones}
                  onChange={(e) => setSettingsForm({ ...settingsForm, showCustomMilestones: e.target.checked })}
                  style={{ width: 18, height: 18, cursor: "pointer" }}
                />
              </div>
              {settingsForm.showCustomMilestones && (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    {[1, 2, 3, 5].map((step) => (
                      <button
                        key={step}
                        onClick={() => setSettingsForm({ ...settingsForm, milestoneStep: step })}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 10,
                          border: settingsForm.milestoneStep === step ? "none" : `1.5px solid ${T.border}`,
                          background: settingsForm.milestoneStep === step ? T.gradient : T.bg,
                          color: settingsForm.milestoneStep === step ? "#fff" : T.text,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {step} kg
                      </button>
                    ))}
                  </div>
                  {previewMilestones.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.textMuted }}>
                      <span>Preview:</span>
                      {previewMilestones.map((m, i) => (
                        <div key={i} style={{
                          width: 8, height: 8, borderRadius: "50%", background: T.teal, opacity: 0.6
                        }} />
                      ))}
                      {previewMilestones.length < 10 && <span>...</span>}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Traguardi BMI */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Traguardi BMI</span>
                <input
                  type="checkbox"
                  checked={settingsForm.showBmiMilestones}
                  onChange={(e) => setSettingsForm({ ...settingsForm, showBmiMilestones: e.target.checked })}
                  style={{ width: 18, height: 18, cursor: "pointer" }}
                />
              </div>
              {settingsForm.showBmiMilestones && bmiCategoryWeights.length > 0 && (
                <div>
                  <div style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden", gap: 0, marginBottom: 10 }}>
                    {bmiCategoryWeights.map((cat, i) => (
                      <div key={i} style={{
                        flex: 1, background: cat.color
                      }} />
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, fontSize: 11 }}>
                    {bmiCategoryWeights.map((cat, i) => (
                      <div key={i} style={{ textAlign: "center" }}>
                        <div style={{ fontWeight: 700, color: cat.color, marginBottom: 4 }}>{cat.name}</div>
                        <div style={{ color: T.textMuted }}>{Math.round(cat.maxWeight)} kg</div>
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
      <InfoOverlay T={T} show={showInfo} onClose={() => setShowInfo(false)} />
    </div>
  );
}
