"use client";
import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart,
} from "recharts";
import {
  Scale, Target, TrendingDown, TrendingUp, Calendar, Plus,
  ChevronLeft, Settings, Trash2, Award, Flame, ArrowDown,
  ArrowUp, Minus, Edit3, Check, X, ChevronRight, Activity,
  AlertCircle, Info, Clock, BarChart3, Heart,
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

/* ═══════════════════════════════════════════
   CARD 1: TREND (with Canvas chart)
   ═══════════════════════════════════════════ */

const TrendCard = ({ T, smoothed, settings, onShowHistory, onShowInfo }) => {
  const canvasRef = useRef(null);
  const [tooltipData, setTooltipData] = useState(null);

  const last7 = useMemo(() => {
    if (smoothed.length === 0) return [];
    return smoothed.slice(-7);
  }, [smoothed]);

  const currentTrend = last7[last7.length - 1]?.trend ?? null;
  const prevTrendValue = last7[last7.length - 2]?.trend ?? null;
  const vsYesterday = (currentTrend != null && prevTrendValue != null)
    ? Math.round((currentTrend - prevTrendValue) * 100) / 100 : null;

  // Draw canvas chart
  useEffect(() => {
    if (!canvasRef.current || last7.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    const padding = { top: 20, bottom: 30, left: 10, right: 10 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate min/max for scaling
    const weights = last7.map(d => d.trend);
    const changes = [];
    for (let i = 1; i < last7.length; i++) {
      changes.push(last7[i].weight - last7[i - 1].weight);
    }

    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);
    const weightRange = maxWeight - minWeight || 1;
    const maxChange = Math.max(...changes.map(Math.abs));

    // Clear canvas
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);

    // Bar geometry
    const colW = chartWidth / last7.length;
    const barDrawW = Math.min(colW * 0.5, 24);
    const barMaxH = chartHeight * 0.35;
    const baseY = padding.top + chartHeight * 0.65;

    // Helper: center X of column i
    const colCx = (i) => padding.left + colW * i + colW / 2;
    // Trend line: from left edge of first bar to right edge of last bar
    const firstBarLeft = colCx(0) - barDrawW / 2;
    const lastBarRight = colCx(last7.length - 1) + barDrawW / 2;
    const trendX = (i) => firstBarLeft + (lastBarRight - firstBarLeft) * i / (last7.length - 1);
    const trendY = (v) => {
      const norm = (v - minWeight) / weightRange;
      return padding.top + chartHeight * 0.1 + (1 - norm) * (chartHeight * 0.4);
    };

    // Draw variation bars
    for (let i = 1; i < last7.length; i++) {
      const change = last7[i].weight - last7[i - 1].weight;
      const barH = Math.max(3, (Math.abs(change) / (maxChange || 0.1)) * barMaxH);
      const bx = colCx(i) - barDrawW / 2;
      const by = baseY - barH;
      const isGreen = change <= 0;
      const color = isGreen ? "#02C39A" : "#E85D4E";

      // Rounded-top bar
      const r = Math.min(4, barDrawW / 2);
      ctx.beginPath();
      ctx.moveTo(bx + r, by); ctx.lineTo(bx + barDrawW - r, by);
      ctx.quadraticCurveTo(bx + barDrawW, by, bx + barDrawW, by + r);
      ctx.lineTo(bx + barDrawW, baseY); ctx.lineTo(bx, baseY);
      ctx.lineTo(bx, by + r); ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.closePath();

      const bGrad = ctx.createLinearGradient(0, by, 0, baseY);
      bGrad.addColorStop(0, color); bGrad.addColorStop(1, color + "70");
      ctx.fillStyle = bGrad; ctx.fill();

      // Value label above bar
      ctx.fillStyle = color;
      ctx.font = "bold 9px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${change > 0 ? "+" : ""}${change.toFixed(1)}`, colCx(i), by - 4);
    }

    // Draw area fill under trend
    ctx.beginPath();
    ctx.moveTo(trendX(0), trendY(minWeight));
    for (let i = 0; i < last7.length; i++) {
      const x = trendX(i), y = trendY(last7[i].trend);
      if (i === 0) ctx.moveTo(x, y);
      else {
        const px = trendX(i - 1), py = trendY(last7[i - 1].trend);
        ctx.bezierCurveTo((px + x) / 2, py, (px + x) / 2, y, x, y);
      }
    }
    ctx.lineTo(trendX(last7.length - 1), baseY);
    ctx.lineTo(trendX(0), baseY);
    ctx.closePath();
    const aGrad = ctx.createLinearGradient(0, padding.top, 0, baseY);
    aGrad.addColorStop(0, "rgba(2,128,144,0.12)");
    aGrad.addColorStop(1, "rgba(2,128,144,0)");
    ctx.fillStyle = aGrad; ctx.fill();

    // Draw trend curve
    ctx.strokeStyle = "#028090";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < last7.length; i++) {
      const x = trendX(i), y = trendY(last7[i].trend);
      if (i === 0) ctx.moveTo(x, y);
      else {
        const px = trendX(i - 1), py = trendY(last7[i - 1].trend);
        ctx.bezierCurveTo((px + x) / 2, py, (px + x) / 2, y, x, y);
      }
    }
    ctx.stroke();

    // Draw dots on trend
    for (let i = 0; i < last7.length; i++) {
      const x = trendX(i), y = trendY(last7[i].trend);
      const isLast = i === last7.length - 1;
      ctx.beginPath(); ctx.arc(x, y, isLast ? 4 : 2, 0, Math.PI * 2);
      ctx.fillStyle = isLast ? "#028090" : "rgba(2,128,144,0.45)"; ctx.fill();
      if (isLast) {
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(2,128,144,0.18)"; ctx.lineWidth = 2; ctx.stroke();
      }
    }

    // Draw day labels
    const dayNames = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
    ctx.font = "600 9px Inter, sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i < last7.length; i++) {
      const isToday = i === last7.length - 1;
      ctx.fillStyle = isToday ? "#028090" : "#B0B8C8";
      const label = isToday ? "Oggi" : dayNames[new Date(last7[i].date).getDay()];
      ctx.fillText(label, colCx(i), height - 8);
    }
  }, [last7]);

  // Canvas click/touch handler — find nearest day point
  const handleCanvasClick = (e) => {
    if (!canvasRef.current || last7.length === 0) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = clientX - rect.left;
    const w = rect.width;
    const pad = { left: 10, right: 10 };
    const cW = w - pad.left - pad.right;
    const colW = cW / last7.length;
    const barDrawW = Math.min(colW * 0.5, 24);
    const colCx = (i) => pad.left + colW * i + colW / 2;
    const fbl = colCx(0) - barDrawW / 2;
    const lbr = colCx(last7.length - 1) + barDrawW / 2;
    const trendXForIdx = (i) => fbl + (lbr - fbl) * i / (last7.length - 1);

    let closestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < last7.length; i++) {
      const dist = Math.abs(x - trendXForIdx(i));
      if (dist < minDist) { minDist = dist; closestIdx = i; }
    }

    setTooltipData(closestIdx);
    // Auto-dismiss after 2s
    setTimeout(() => setTooltipData(null), 2000);
  };

  return (
    <div style={{
      background: "white",
      borderRadius: 22,
      padding: "20px 20px 16px",
      boxShadow: T.shadow,
      marginBottom: 16,
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, height: 30 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase" }}>TREND</span>
        <div style={{ flex: 1 }} />
        <button onClick={onShowHistory} style={{
          background: "#F0F8F8",
          color: "#028090",
          border: "none",
          borderRadius: 15,
          padding: "6px 12px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: 30,
        }}>
          <Clock size={14} />
          Storico
        </button>
        <button onClick={onShowInfo} style={{
          background: "#F0F2F5",
          border: "none",
          borderRadius: 8,
          width: 30,
          height: 30,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 8,
        }}>
          <Info size={16} color="#6B7280" />
        </button>
      </div>

      {/* Hero row */}
      {currentTrend != null ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
            <span style={{ fontSize: 48, fontWeight: 900, color: "#1A2030" }}>
              {currentTrend.toFixed(1)}
            </span>
            <span style={{ fontSize: 17, color: "#6B7280" }}>kg</span>
          </div>
          {vsYesterday != null && (
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 8,
              background: vsYesterday < 0 ? "#02C39A12" : "#E85D4E12",
              color: vsYesterday < 0 ? "#02C39A" : "#E85D4E",
              fontSize: 13,
              fontWeight: 700,
            }}>
              {vsYesterday < 0 ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
              {Math.abs(vsYesterday).toFixed(1)} vs ieri
            </div>
          )}
        </div>
      ) : (
        <div style={{ color: T.textMuted, marginBottom: 16 }}>Nessun dato disponibile</div>
      )}

      {/* Canvas chart */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onTouchStart={handleCanvasClick}
          style={{
            width: "100%",
            height: 130,
            cursor: "pointer",
            display: "block",
          }}
        />
        {tooltipData != null && last7[tooltipData] && (
          <div style={{
            position: "absolute",
            top: 15,
            left: `${(tooltipData / (last7.length - 1)) * 100}%`,
            transform: "translateX(-50%)",
            background: "white",
            borderRadius: 8,
            padding: "6px 10px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            fontSize: 12,
            fontWeight: 600,
            color: "#028090",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}>
            <span style={{ color: "#9CA3AF", fontSize: 10 }}>{formatDate(last7[tooltipData].date)}</span>{" "}
            <strong>{last7[tooltipData].trend.toFixed(1)}</strong> kg
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   CARD 2: OBIETTIVO (Goal tracking)
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

  // Trajectory chart data
  const chartDataRaw = [...smoothed];
  if (reg && chartDataRaw.length > 0) {
    const lastEntry = chartDataRaw[chartDataRaw.length - 1];
    const lastDate = new Date(lastEntry.date);
    const startDate = new Date(chartDataRaw[0].date);
    const daysElapsed = (lastDate - startDate) / 86400000;

    for (let i = 0; i < 60; i++) {
      const futureDate = new Date(lastDate);
      futureDate.setDate(futureDate.getDate() + i);
      const daysSinceStart = daysElapsed + i;
      const projectedValue = reg.intercept + reg.slope * daysSinceStart;
      chartDataRaw.push({
        date: toISO(futureDate),
        trend: projectedValue,
        projected: true,
        dateLabel: formatDate(futureDate),
      });
    }
  }

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
        <span style={{ fontSize: 15, fontWeight: 700, color: "#6B7280" }}>Obiettivo</span>
        <span style={{ fontSize: 18, fontWeight: 800, color: "#028090" }}>{settings.goalWeight} kg</span>
      </div>

      {/* Progress ring + stats */}
      <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
        <div style={{ flex: "0 0 auto" }}>
          <CircularProgress percentage={progressPct} size={80} strokeWidth={5} color="#028090" />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600 }}>Mancanti</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1A2030" }}>{kgMancanti} kg</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600 }}>Persi</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#028090" }}>{kgPersi} kg</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600 }}>Ritmo settimanale</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1A2030" }}>
              {weeklyRate != null ? `${weeklyRate.toFixed(2)} kg` : "—"}
            </div>
          </div>
          {predictedDate && (
            <div>
              <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600 }}>Data prevista</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#028090" }}>{predictedDate}</div>
            </div>
          )}
        </div>
      </div>

      {/* Trajectory chart */}
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartDataRaw}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} interval={Math.floor(chartDataRaw.length / 6)} />
          <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: T.card,
              borderRadius: 12,
              boxShadow: T.shadowLg,
              border: `1px solid ${T.tealLight}`,
            }}
            cursor={false}
          />
          <ReferenceLine y={settings.goalWeight} stroke="#028090" strokeDasharray="4 4" name="Obiettivo" />
          <Line type="monotone" dataKey="trend" stroke="#028090" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line
            type="monotone"
            dataKey="trend"
            stroke="#028090"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            isAnimationActive={false}
            data={chartDataRaw.filter(d => d.projected)}
          />
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

  // Group by month
  const groupedByMonth = useMemo(() => {
    const groups = {};
    [...smoothed].reverse().forEach(entry => {
      const dateObj = new Date(entry.date);
      const monthKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}`;
      if (!groups[monthKey]) {
        groups[monthKey] = { month: dateObj, entries: [] };
      }
      groups[monthKey].entries.push(entry);
    });
    return Object.values(groups);
  }, [smoothed]);

  const handleDelete = (id) => {
    setEntries(entries.filter(e => e.id !== id));
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
            width: 36,
            height: 4,
            borderRadius: 2,
            background: "#D1D5DB",
            margin: "0 auto 12px",
          }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#1A2030" }}>Storico</span>
            <button onClick={onClose} style={{
              background: "#F0F2F5",
              border: "none",
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <X size={16} color="#6B7280" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
          {groupedByMonth.map((group, gIdx) => (
            <div key={gIdx} style={{ marginBottom: 24 }}>
              {/* Month header with variation summary */}
              {(() => {
                const monthEntries = group.entries;
                const firstTrend = monthEntries.length > 0 ? monthEntries[monthEntries.length - 1].trend : null;
                const lastTrend = monthEntries.length > 0 ? monthEntries[0].trend : null;
                const monthVar = (firstTrend != null && lastTrend != null)
                  ? Math.round((lastTrend - firstTrend) * 100) / 100 : null;
                return (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, padding: "0 4px" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#1A2030", textTransform: "capitalize" }}>
                      {group.month.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted }}>
                      {monthVar != null && (
                        <span style={{ color: monthVar <= 0 ? "#02C39A" : "#E85D4E", fontWeight: 700 }}>
                          {monthVar > 0 ? "+" : ""}{monthVar} kg
                        </span>
                      )}
                      {" · "}{monthEntries.length} pesate
                    </span>
                  </div>
                );
              })()}

              {/* Column headers */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
                gap: 8,
                fontSize: 11,
                fontWeight: 700,
                color: "#9CA3AF",
                paddingBottom: 8,
                marginBottom: 8,
                borderBottom: `1px solid ${T.border}`,
              }}>
                <div>Data</div>
                <div>Peso</div>
                <div>Trend</div>
                <div>Var</div>
              </div>

              {/* Entries — click row to edit */}
              {group.entries.map((entry, eIdx) => {
                const rawEntry = entries.find(e => e.date === entry.date);
                const prevEntry = eIdx < group.entries.length - 1 ? group.entries[eIdx + 1] : null;
                const variation = prevEntry
                  ? Math.round((entry.trend - prevEntry.trend) * 100) / 100
                  : null;

                return (
                  <div key={entry.date} onClick={() => {
                    if (rawEntry) {
                      setEditingEntry(entry.date);
                      setEditWeight(String(rawEntry.weight));
                    }
                  }} style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
                    gap: 8,
                    alignItems: "center",
                    padding: "10px 8px",
                    marginBottom: 3,
                    background: "#F8F9FA",
                    borderRadius: 11,
                    fontSize: 13,
                    cursor: rawEntry ? "pointer" : "default",
                    transition: "background 0.15s",
                  }}>
                    <div style={{ color: "#1A2030", fontWeight: 600 }}>
                      {new Date(entry.date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}
                    </div>
                    <div style={{ color: "#1A2030", fontWeight: 700 }}>{rawEntry?.weight ?? entry.trend.toFixed(1)}</div>
                    <div style={{ color: T.teal, fontWeight: 700 }}>{entry.trend.toFixed(1)}</div>
                    <div style={{
                      color: variation == null ? T.textMuted : variation < 0 ? "#02C39A" : "#E85D4E",
                      fontWeight: 700,
                    }}>
                      {variation == null ? "—" : `${variation > 0 ? "+" : ""}${variation.toFixed(2)}`}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Edit sub-sheet */}
      {editingEntry && (() => {
        const rawEntry = entries.find(e => e.date === editingEntry);
        if (!rawEntry) return null;
        const dateLabel = new Date(editingEntry).toLocaleDateString("it-IT", { day: "numeric", month: "long" });
        return (
          <div onClick={() => setEditingEntry(null)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)",
            zIndex: 45, display: "flex", alignItems: "flex-end",
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: "#fff", borderRadius: "20px 20px 0 0", width: "100%",
              padding: "16px 20px 28px",
              boxShadow: "0 -4px 20px rgba(0,0,0,0.1)",
            }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#D1D5DB", margin: "0 auto 16px" }} />
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1A2030", marginBottom: 16 }}>Modifica — {dateLabel}</div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>Peso (kg)</div>
                <input type="number" step="0.1" value={editWeight} onChange={e => setEditWeight(e.target.value)}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #E8ECEF", fontFamily: "inherit", fontSize: 18, fontWeight: 800, color: "#1A2030", textAlign: "center" }}
                />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <button onClick={() => { handleDelete(rawEntry.id); setEditingEntry(null); }} style={{
                  flex: 1, padding: 13, borderRadius: 12, border: "none", fontFamily: "inherit",
                  fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#FEF2F2", color: "#E85D4E",
                }}>Elimina</button>
                <button onClick={() => setEditingEntry(null)} style={{
                  flex: 1, padding: 13, borderRadius: 12, border: "none", fontFamily: "inherit",
                  fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#F0F2F5", color: "#6B7794",
                }}>Annulla</button>
                <button onClick={() => {
                  const w = parseFloat(editWeight);
                  if (!isNaN(w) && w >= 20 && w <= 300) {
                    setEntries(entries.map(e => e.id === rawEntry.id ? { ...e, weight: w } : e));
                  }
                  setEditingEntry(null);
                }} style={{
                  flex: 1, padding: 13, borderRadius: 12, border: "none", fontFamily: "inherit",
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                  background: "linear-gradient(135deg, #028090, #02A4B5)", color: "#fff",
                  boxShadow: "0 3px 12px rgba(2,128,144,0.25)",
                }}>Salva</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

/* ═══════════════════════════════════════════
   INFO OVERLAY
   ═══════════════════════════════════════════ */

const InfoOverlay = ({ T, show, onClose }) => {
  if (!show) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 20,
      }}
    >
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
            Il trend è una media mobile esponenziale (EMA) che filtro le fluttuazioni quotidiane e rivela il vero andamento del tuo peso.
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
                  fontSize: 15,
                  fontWeight: 600,
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
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Tappe intermedie</span>
                <input
                  type="checkbox"
                  checked={settingsForm.showCustomMilestones}
                  onChange={(e) => setSettingsForm({ ...settingsForm, showCustomMilestones: e.target.checked })}
                  style={{ width: 18, height: 18, cursor: "pointer" }}
                />
              </div>
              {settingsForm.showCustomMilestones && (
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  {[1, 2, 3, 5].map((step) => (
                    <button
                      key={step}
                      onClick={() => setSettingsForm({ ...settingsForm, milestoneStep: step })}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
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
              )}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Traguardi BMI</span>
                <input
                  type="checkbox"
                  checked={settingsForm.showBmiMilestones}
                  onChange={(e) => setSettingsForm({ ...settingsForm, showBmiMilestones: e.target.checked })}
                  style={{ width: 18, height: 18, cursor: "pointer" }}
                />
              </div>
            </div>
          </div>

          {/* Reminders Card */}
          <div style={{ background: T.card, borderRadius: 20, padding: "20px", marginBottom: 24, boxShadow: T.shadow }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.textSec }}>Promemoria</h3>
            <p style={{ fontSize: 12, color: T.textMuted, margin: "8px 0 0 0" }}>
              Impostazioni per i promemoria saranno disponibili presto.
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

        {/* Add Weight Button */}
        <button
          onClick={() => setScreen("add")}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: 16,
            border: "none",
            background: T.gradient,
            color: "#fff",
            fontSize: 16,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 4px 16px rgba(2,128,144,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 20,
          }}
        >
          <Plus size={20} />
          Registra Peso
        </button>

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
