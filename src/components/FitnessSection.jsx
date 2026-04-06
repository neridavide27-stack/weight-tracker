"use client";
// FitnessSection.jsx — Walking tracker module
// v3 — Barra gradient (no ring), slider form, report con Metriche Totali

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  ChevronLeft, Plus, Check, X, Settings,
  Timer, Gauge, Footprints, Home, Utensils, Dumbbell, User,
  Flame, Trophy, TrendingUp, TrendingDown, BarChart3, Zap,
  Heart, Mountain, Clock,
} from "lucide-react";
import {
  addFitnessActivity,
  updateFitnessActivity,
  getFitnessActivitiesByDateRange,
  deleteFitnessActivity,
  getWeeklyGoalKm,
  saveWeeklyGoalKm,
  getLastFitnessActivity,
  getNutritionGoals,
} from "../lib/food-db";

/* ═══════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════ */
const T = {
  bg: "#F5F7FA", card: "#FFFFFF",
  teal: "#028090", tealLight: "#E0F2F1", mint: "#02C39A",
  coral: "#E85D4E", gold: "#F0B429", purple: "#7C5CFC",
  text: "#1A2030", textSec: "#6B7280", textMuted: "#9CA3AF",
  border: "#F0F0F0",
  gradient: "linear-gradient(135deg,#028090,#02C39A)",
  shadow: "0 2px 16px rgba(0,0,0,0.06)",
  shadowLg: "0 8px 32px rgba(0,0,0,0.08)",
};
const GREEN       = "#16A34A";
const GREEN_LIGHT = "#DCFCE7";
const GG          = "linear-gradient(135deg,#16A34A,#02C39A)";
const ORANGE      = "#F97316";
const MONTH_LABELS = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

/* ═══════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════ */
const toISO    = d  => new Date(d).toISOString().split("T")[0];
const todayISO = () => toISO(new Date());

const getMondayISO = (from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return toISO(d);
};

const getWeekDays = (mondayISO) => {
  const m = new Date(mondayISO);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(m); d.setDate(m.getDate() + i); return toISO(d);
  });
};

const formatDateLabel = (iso) => {
  const t = todayISO();
  const y = toISO(new Date(Date.now() - 86400000));
  if (iso === t) return "Oggi";
  if (iso === y) return "Ieri";
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
};

const formatPace = (p) => {
  if (!p || p <= 0) return "—";
  const m = Math.floor(p);
  const s = Math.round((p - m) * 60);
  return `${m}'${String(s).padStart(2, "0")}"`;
};

const formatDuration = (min) => {
  if (!min) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

const DAY_LABELS = ["L", "M", "M", "G", "V", "S", "D"];

/* ═══════════════════════════════════════════
   CALCOLO KCAL IBRIDO
   MET base (velocità) + pendenza + aggiustamento HR (Karvonen)
   ═══════════════════════════════════════════ */
export const calcKcal = ({ durationMin, paceMinKm, weight, heartRate, slope }) => {
  if (!durationMin || !weight) return 0;

  let met = 3.5;
  if (paceMinKm && paceMinKm > 0) {
    const kmh = 60 / paceMinKm;
    if      (kmh < 3)  met = 2.0;
    else if (kmh < 4)  met = 2.8;
    else if (kmh < 5)  met = 3.5;
    else if (kmh < 6)  met = 4.3;
    else if (kmh < 7)  met = 5.0;
    else               met = 6.0;
  }

  if (slope && slope > 0) met += slope * 0.35;

  if (heartRate && heartRate > 0) {
    const restHR = 60, maxHR = 190;
    const hrr = Math.max(0, Math.min(1, (heartRate - restHR) / (maxHR - restHR)));
    const expectedHRR = Math.max(0.1, (met - 1) / 12);
    const adj = Math.max(0.7, Math.min(1.3, 1 + 0.3 * ((hrr - expectedHRR) / Math.max(0.1, expectedHRR))));
    met *= adj;
  }

  return Math.max(0, Math.round(met * weight * (durationMin / 60)));
};

/* ═══════════════════════════════════════════
   STREAK + RECORDS
   ═══════════════════════════════════════════ */
const calcStreak = (activities) => {
  const dates = new Set(activities.map(a => a.date));
  let streak = 0;
  const d = new Date();
  while (true) {
    const iso = toISO(d);
    if (dates.has(iso)) { streak++; d.setDate(d.getDate() - 1); }
    else if (iso === todayISO()) { d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
};

const calcMaxStreak = (activities) => {
  if (!activities.length) return 0;
  const sorted = [...new Set(activities.map(a => a.date))].sort();
  let max = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (curr - prev) / 86400000;
    if (diff === 1) { cur++; max = Math.max(max, cur); }
    else cur = 1;
  }
  return Math.max(max, cur);
};

const calcPR = (activities) => ({
  maxDist:  activities.length ? Math.max(...activities.map(a => a.distanceKm)) : 0,
  bestPace: activities.length ? Math.min(...activities.map(a => a.paceMinKm).filter(Boolean)) : Infinity,
  totalKm:  activities.reduce((s, a) => s + a.distanceKm, 0),
  maxKcal:  activities.length ? Math.max(...activities.map(a => a.kcal || 0)) : 0,
  totalMin: activities.reduce((s, a) => s + (a.durationMin || 0), 0),
});

/* ═══════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════ */
const CircularRing = ({ pct, size = 56, stroke = 5, color = "#fff" }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - Math.min(pct / 100, 1) * c;
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`${color}28`} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}/>
    </svg>
  );
};

const FitnessBottomNav = ({ onAdd, onNavigate }) => {
  const tabs = [
    { id: "dashboard", Icon: Home,     label: "Home"    },
    { id: "food",      Icon: Utensils, label: "Cibo"    },
    { id: "add",       Icon: null,     label: ""        },
    { id: "fitness",   Icon: Dumbbell, label: "Fitness" },
    { id: "profile",   Icon: User,     label: "Profilo" },
  ];
  return (
    <div style={{
      position:"fixed",bottom:0,left:0,right:0,background:T.card,
      borderTop:`1px solid ${T.border}`,display:"flex",
      justifyContent:"space-around",alignItems:"flex-end",
      padding:"6px 8px 22px",zIndex:20,
      boxShadow:"0 -4px 20px rgba(0,0,0,0.06)",
    }}>
      {tabs.map(tab => {
        if (tab.id === "add") return (
          <button key="add" onClick={onAdd} style={{
            width:54,height:54,borderRadius:"50%",border:"none",
            background:T.gradient,color:"#fff",cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 4px 24px rgba(2,128,144,0.35)",transform:"translateY(-14px)",
          }}><Plus size={26} strokeWidth={2.5}/></button>
        );
        const isActive = tab.id === "fitness";
        return (
          <button key={tab.id} onClick={() => onNavigate(tab.id)} style={{
            background:"none",border:"none",cursor:"pointer",
            display:"flex",flexDirection:"column",alignItems:"center",gap:3,
            padding:"6px 14px",opacity:isActive?1:0.5,transition:"opacity 0.2s",
          }}>
            <tab.Icon size={21} color={isActive?T.teal:T.textSec} strokeWidth={isActive?2.3:1.8}/>
            <span style={{fontSize:10,fontWeight:700,color:isActive?T.teal:T.textSec}}>{tab.label}</span>
            {isActive && <div style={{width:4,height:4,borderRadius:2,background:T.teal,marginTop:-1}}/>}
          </button>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════
   SWIPE-TO-DELETE CARD (← swipe sinistra)
   ═══════════════════════════════════════════ */
const SwipeCard = ({ activity: a, onDelete, onClick }) => {
  const [swipeX, setSwipeX]   = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef  = useRef(null);
  const threshold = 80;

  const startDrag = (e) => {
    e.stopPropagation();
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    startRef.current = x; setDragging(true);
  };
  const moveDrag = (e) => {
    e.stopPropagation();
    if (!dragging || startRef.current === null) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const dx = startRef.current - x;
    if (dx > 0) setSwipeX(Math.min(dx, threshold + 20));
    else setSwipeX(0);
  };
  const endDrag = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setDragging(false);
    if (swipeX >= threshold) onDelete(a.id);
    else setSwipeX(0);
    startRef.current = null;
  };

  return (
    <div style={{ position:"relative", marginBottom:10, overflow:"hidden", borderRadius:16 }}>
      <div style={{
        position:"absolute",top:0,bottom:0,right:0,width:"100%",
        background:"#FEE2E2",display:"flex",alignItems:"center",
        justifyContent:"flex-end",paddingRight:22,borderRadius:16,
        opacity: Math.min(swipeX / (threshold * 0.6), 1),
      }}>
        <span style={{ fontSize:22 }}>🗑️</span>
        <span style={{ marginLeft:8,fontSize:12,fontWeight:700,color:T.coral }}>
          {swipeX >= threshold ? "Rilascia!" : "← Elimina"}
        </span>
      </div>
      <div
        onClick={() => { if (swipeX < 5) onClick(a); }}
        onTouchStart={startDrag}
        onTouchMove={moveDrag}
        onTouchEnd={endDrag}
        onMouseDown={startDrag}
        onMouseMove={(e) => { if (dragging) moveDrag(e); }}
        onMouseUp={endDrag}
        onMouseLeave={() => { if (dragging) endDrag(); }}
        style={{
          background:T.card, borderRadius:16, padding:"14px 16px",
          boxShadow:T.shadow, display:"flex", alignItems:"center", gap:12,
          transform:`translateX(${-swipeX}px)`,
          transition: dragging ? "none" : "transform 0.25s ease",
          cursor:"pointer", userSelect:"none", position:"relative",
        }}
      >
        <div style={{ width:46,height:46,borderRadius:14,background:GREEN_LIGHT,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <Footprints size={21} color={GREEN}/>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          {/* Riga 1: km + data */}
          <div style={{ display:"flex",alignItems:"baseline",gap:6,marginBottom:5 }}>
            <span style={{ fontSize:22,fontWeight:900,color:T.text,letterSpacing:-.5 }}>{a.distanceKm.toFixed(1)}</span>
            <span style={{ fontSize:12,fontWeight:700,color:T.textMuted }}>km</span>
            <span style={{ fontSize:11,color:T.textMuted,marginLeft:"auto",whiteSpace:"nowrap" }}>{formatDateLabel(a.date)}</span>
          </div>
          {/* Riga 2: durata · passo · kcal · bpm · slope — tutto allineato */}
          <div style={{ display:"flex",alignItems:"center",gap:10,flexWrap:"nowrap",overflow:"hidden" }}>
            <span style={{ fontSize:11,color:T.textSec,display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap" }}>
              <Timer size={11} color={T.textMuted}/>{formatDuration(a.durationMin)}
            </span>
            <span style={{ fontSize:11,color:T.textSec,display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap" }}>
              <Gauge size={11} color={T.textMuted}/>{formatPace(a.paceMinKm)}/km
            </span>
            {a.kcal > 0 && (
              <span style={{ fontSize:11,color:T.textSec,display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap" }}>
                <Flame size={11} color={ORANGE}/>{a.kcal}
              </span>
            )}
            {a.heartRate > 0 && (
              <span style={{ fontSize:11,color:T.coral,display:"flex",alignItems:"center",gap:2,whiteSpace:"nowrap",fontWeight:600 }}>
                <Heart size={10} color={T.coral} fill={T.coral}/>{a.heartRate}
              </span>
            )}
            {a.slope > 0 && (
              <span style={{ fontSize:11,color:T.purple,display:"flex",alignItems:"center",gap:2,whiteSpace:"nowrap",fontWeight:600 }}>
                <Mountain size={10} color={T.purple}/>{a.slope}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   MODAL: MODIFICA OBIETTIVO
   ═══════════════════════════════════════════ */
const GoalModal = ({ current, onSave, onClose }) => {
  const [val, setVal] = useState(current);
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20 }}>
      <div style={{ background:T.card,borderRadius:24,padding:28,width:"100%",maxWidth:320,boxShadow:T.shadowLg }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24 }}>
          <div style={{ fontSize:18,fontWeight:800,color:T.text }}>Obiettivo settimanale</div>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",padding:4 }}><X size={20} color={T.textMuted}/></button>
        </div>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:16 }}>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            <button onClick={() => setVal(v => Math.max(1, v-5))} style={{ width:40,height:40,borderRadius:12,border:"1.5px solid #E5E7EB",background:T.bg,cursor:"pointer",fontSize:16,fontWeight:700,color:T.text }}>−5</button>
            <button onClick={() => setVal(v => Math.max(1, v-1))} style={{ width:40,height:40,borderRadius:12,border:"1.5px solid #E5E7EB",background:T.bg,cursor:"pointer",fontSize:16,fontWeight:700,color:T.text }}>−1</button>
          </div>
          <div style={{ textAlign:"center",minWidth:90 }}>
            <span style={{ fontSize:48,fontWeight:900,color:T.text,letterSpacing:-2 }}>{val}</span>
            <span style={{ fontSize:16,color:T.textMuted,fontWeight:700 }}> km</span>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            <button onClick={() => setVal(v => Math.min(200, v+5))} style={{ width:40,height:40,borderRadius:12,border:"1.5px solid #E5E7EB",background:T.bg,cursor:"pointer",fontSize:16,fontWeight:700,color:T.text }}>+5</button>
            <button onClick={() => setVal(v => Math.min(200, v+1))} style={{ width:40,height:40,borderRadius:12,border:"1.5px solid #E5E7EB",background:T.bg,cursor:"pointer",fontSize:16,fontWeight:700,color:T.text }}>+1</button>
          </div>
        </div>
        <button onClick={() => { onSave(val); onClose(); }} style={{ width:"100%",padding:15,borderRadius:14,border:"none",background:GG,color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
          <Check size={17}/> Salva obiettivo
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   FORM CAMMINATA — Hero gradient + slider
   ═══════════════════════════════════════════ */
const DURATION_CHIPS = [
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1h",     value: 60 },
  { label: "1h 15",  value: 75 },
  { label: "1h 30",  value: 90 },
];

const WalkForm = ({ initial, userProfile, onSave, onBack, title }) => {
  const [date,      setDate]      = useState(initial?.date      ?? todayISO());
  const [km,        setKm]        = useState(initial?.distanceKm ?? 5.0);
  const [duration,  setDuration]  = useState(initial?.durationMin ?? 50);
  const [heartRate, setHeartRate] = useState(initial?.heartRate  ?? 0);
  const [slope,     setSlope]     = useState(initial?.slope      ?? 0);
  const [kcalOver,  setKcalOver]  = useState(null);
  const [saving,    setSaving]    = useState(false);

  const kmNum = parseFloat(parseFloat(km).toFixed(1)) || 0;
  const valid = kmNum > 0 && duration > 0;
  const pace  = valid ? duration / kmNum : null;

  const kcalAuto = useMemo(() => calcKcal({
    durationMin: duration, paceMinKm: pace,
    weight: userProfile?.weight || 75,
    heartRate: heartRate > 0 ? heartRate : null,
    slope: slope > 0 ? slope : null,
  }), [duration, pace, userProfile, heartRate, slope]);

  const kcalDisplay = kcalOver !== null ? kcalOver : kcalAuto;
  const formulaHint = heartRate > 0 && slope > 0 ? "MET + HR + pendenza"
    : heartRate > 0 ? "MET corretto con HR"
    : slope > 0 ? "MET + correzione pendenza"
    : "Formula MET standard";

  const adjustKm = (delta) => setKm(prev => Math.max(0.1, parseFloat((parseFloat(prev) + delta).toFixed(1))));

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    await onSave({
      date, distanceKm: kmNum, durationMin: duration,
      paceMinKm: parseFloat((pace || 0).toFixed(2)),
      kcal: kcalDisplay,
      heartRate: heartRate > 0 ? parseInt(heartRate) : null,
      slope: slope > 0 ? parseFloat(slope) : null,
    });
    setSaving(false);
  };

  const sliderStyle = (color, pct) => ({
    flex:1,WebkitAppearance:"none",appearance:"none",height:6,borderRadius:10,outline:"none",
    background:`linear-gradient(to right,${color} 0%,${color} ${pct}%,#E2E8F0 ${pct}%,#E2E8F0 100%)`,
  });

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 14px 10px" }}>
        <button onClick={onBack} style={{ background:"none",border:"none",cursor:"pointer",color:T.textSec,fontSize:14,fontWeight:700,display:"flex",alignItems:"center",gap:4,padding:"6px 8px" }}>
          <ChevronLeft size={18} color={T.teal}/>Indietro
        </button>
        <div style={{ fontSize:17,fontWeight:800,color:T.text }}>{title}</div>
        <div style={{ width:60 }}/>
      </div>

      {/* HERO KM */}
      <div style={{ background:"linear-gradient(135deg,#028090,#7C5CFC)",borderRadius:26,padding:"18px 20px 22px",margin:"0 14px 14px",boxShadow:"0 10px 28px rgba(2,128,144,0.28)",color:"#fff" }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6 }}>
          <div style={{ display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.18)",padding:"6px 10px",borderRadius:10 }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ border:"none",background:"transparent",color:"#fff",fontSize:12,fontWeight:700,outline:"none",colorScheme:"dark",width:110,fontFamily:"inherit" }}/>
          </div>
          <div style={{ fontSize:10,fontWeight:800,letterSpacing:1,opacity:0.85 }}>DISTANZA</div>
        </div>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8 }}>
          <button onClick={() => adjustKm(-0.1)} style={{ width:44,height:44,borderRadius:14,border:"none",background:"rgba(255,255,255,0.22)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800 }}>−</button>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:56,fontWeight:900,lineHeight:1 }}>{parseFloat(km).toFixed(1)}</div>
            <div style={{ fontSize:12,fontWeight:800,opacity:0.9,marginTop:4 }}>KM</div>
          </div>
          <button onClick={() => adjustKm(+0.1)} style={{ width:44,height:44,borderRadius:14,border:"none",background:"rgba(255,255,255,0.22)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800 }}>+</button>
        </div>
      </div>

      {/* DURATA */}
      <div style={{ background:T.card,borderRadius:20,padding:16,boxShadow:T.shadow,margin:"0 14px 12px" }}>
        <div style={{ fontSize:10,fontWeight:800,color:T.textMuted,letterSpacing:0.8,marginBottom:10 }}>⏱ DURATA</div>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:6 }}>
          <div style={{ fontSize:30,fontWeight:900,minWidth:90,color:T.text }}>
            {duration >= 60 ? `${Math.floor(duration/60)}h` : ""}{duration >= 60 && duration % 60 > 0 ? " " : ""}{duration % 60 > 0 || duration < 60 ? `${duration % 60}` : ""}
            <span style={{ fontSize:13,color:T.textMuted,fontWeight:700,marginLeft:3 }}>{duration < 60 ? "min" : duration % 60 > 0 ? "min" : ""}</span>
          </div>
          <input type="range" min={5} max={180} step={5} value={duration}
            onChange={e => setDuration(parseInt(e.target.value))}
            style={sliderStyle(T.teal, ((duration-5)/175)*100)}/>
        </div>
        <div style={{ display:"flex",gap:6,marginTop:8 }}>
          {DURATION_CHIPS.map(chip => (
            <button key={chip.value} onClick={() => setDuration(chip.value)} style={{
              flex:1,textAlign:"center",border:`1.5px solid ${duration === chip.value ? T.teal : "#E2E8F0"}`,
              background: duration === chip.value ? T.teal : "#F8FAFC",
              padding:"7px 0",borderRadius:999,fontSize:11,fontWeight:700,
              color: duration === chip.value ? "#fff" : T.textSec,
              cursor:"pointer",whiteSpace:"nowrap",transition:"all 0.15s",
            }}>{chip.label}</button>
          ))}
        </div>
      </div>

      {/* RITMO */}
      {valid && (
        <div style={{ background:`${T.teal}08`,border:`1px solid ${T.tealLight}`,borderRadius:14,padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"center",gap:8,margin:"0 14px 12px" }}>
          <Gauge size={15} color={T.teal}/>
          <span style={{ fontSize:13,fontWeight:600,color:T.teal }}>Ritmo medio: <strong>{formatPace(pace)}/km</strong></span>
        </div>
      )}

      {/* OPZIONALE */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 18px 8px",marginTop:4 }}>
        <div style={{ fontSize:10,fontWeight:800,color:T.textMuted,letterSpacing:0.8 }}>OPZIONALE</div>
        {(heartRate > 0 || slope > 0) && (
          <div style={{ fontSize:10,fontWeight:700,color:GREEN }}>✓ {heartRate > 0 && slope > 0 ? "massima precisione" : "migliorata"}</div>
        )}
      </div>

      {/* BATTITI */}
      <div style={{ background:T.card,borderRadius:20,padding:16,boxShadow:T.shadow,margin:"0 14px 12px" }}>
        <div style={{ fontSize:10,fontWeight:800,color:"#EF4444",letterSpacing:0.8,marginBottom:10 }}>❤ BATTITI MEDI</div>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <div style={{ fontSize:24,fontWeight:900,color:heartRate>55?"#EF4444":T.textMuted,minWidth:78 }}>
            {heartRate > 55 ? heartRate : "—"} <span style={{ fontSize:13,color:T.textMuted,fontWeight:700 }}>bpm</span>
          </div>
          <input type="range" min={50} max={200} step={1} value={heartRate || 50}
            onChange={e => { const v = parseInt(e.target.value); setHeartRate(v <= 55 ? 0 : v); }}
            style={sliderStyle("#EF4444", (((heartRate||50)-50)/150)*100)}/>
        </div>
      </div>

      {/* PENDENZA */}
      <div style={{ background:T.card,borderRadius:20,padding:16,boxShadow:T.shadow,margin:"0 14px 12px" }}>
        <div style={{ fontSize:10,fontWeight:800,color:T.purple,letterSpacing:0.8,marginBottom:10 }}>⛰ PENDENZA MEDIA</div>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <div style={{ fontSize:24,fontWeight:900,color:T.purple,minWidth:78 }}>
            {slope > 0 ? (Number.isInteger(slope) ? slope : slope.toFixed(1)) : "0"}<span style={{ fontSize:13,color:T.textMuted,fontWeight:700 }}>%</span>
          </div>
          <input type="range" min={0} max={20} step={0.5} value={slope}
            onChange={e => setSlope(parseFloat(e.target.value))}
            style={sliderStyle(T.purple, (slope/20)*100)}/>
        </div>
      </div>

      {/* KCAL */}
      <div style={{ background:"linear-gradient(135deg,#FFF7ED,#FEF2F2)",borderRadius:18,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",margin:"0 14px 14px" }}>
        <div style={{ display:"flex",alignItems:"center",gap:11 }}>
          <div style={{ width:40,height:40,borderRadius:12,background:"rgba(249,115,22,0.15)",display:"flex",alignItems:"center",justifyContent:"center" }}>
            <Flame size={20} color={ORANGE}/>
          </div>
          <div>
            <div style={{ fontSize:11,fontWeight:800,color:T.textMuted }}>CALORIE STIMATE</div>
            <div style={{ fontSize:10,color:"#94A3B8",fontWeight:600 }}>{formulaHint}</div>
          </div>
        </div>
        {kcalOver !== null ? (
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <input type="number" value={kcalOver} onChange={e => setKcalOver(parseInt(e.target.value)||0)}
              style={{ fontSize:28,fontWeight:900,color:ORANGE,border:"none",background:"transparent",outline:"none",fontFamily:"inherit",width:70,textAlign:"right" }}/>
            <button onClick={() => setKcalOver(null)} style={{ fontSize:9,fontWeight:700,color:T.teal,background:"none",border:"none",cursor:"pointer" }}>Auto</button>
          </div>
        ) : (
          <div onClick={() => setKcalOver(kcalAuto)} style={{ cursor:"pointer" }}>
            <span style={{ fontSize:30,fontWeight:900,color:ORANGE,lineHeight:1 }}>{kcalDisplay}</span>
            <span style={{ fontSize:11,opacity:0.7,marginLeft:3 }}>kcal</span>
          </div>
        )}
      </div>

      <button onClick={handleSave} disabled={!valid || saving} style={{
        width:"calc(100% - 28px)",margin:"8px 14px 24px",padding:16,borderRadius:18,border:"none",
        background: valid ? "linear-gradient(135deg,#028090,#7C5CFC)" : "#E5E7EB",
        color: valid ? "#fff" : T.textMuted,fontSize:15,fontWeight:800,
        cursor: valid && !saving ? "pointer" : "not-allowed",
        boxShadow: valid ? "0 8px 24px rgba(2,128,144,0.35)" : "none",
        display:"flex",alignItems:"center",justifyContent:"center",gap:8,
      }}>
        <Check size={18}/>{saving ? "Salvataggio…" : "Salva camminata"}
      </button>
      <div style={{ height:80 }}/>
      <FitnessBottomNav onAdd={() => {}} onNavigate={() => {}}/>
    </div>
  );
};

/* ═══════════════════════════════════════════
   SCREEN: MAIN — Opzione B (barra gradient, no ring)
   ═══════════════════════════════════════════ */
const MainScreen = ({ activities, weeklyGoal, onAdd, onDelete, onEdit, onEditGoal, onNavigate, onReport }) => {
  const [showAll, setShowAll] = useState(false);

  const weekDays = useMemo(() => getWeekDays(getMondayISO()), []);
  const chart = useMemo(() => weekDays.map((iso, i) => ({
    day: DAY_LABELS[i],
    km:  parseFloat(activities.filter(a => a.date === iso).reduce((s, a) => s + a.distanceKm, 0).toFixed(2)),
    iso,
  })), [activities, weekDays]);

  const weekTotal = useMemo(() => chart.reduce((s, d) => s + d.km, 0), [chart]);
  const pct = Math.min((weekTotal / weeklyGoal) * 100, 100);
  const oggi = todayISO();

  const weekKcal = useMemo(() =>
    weekDays.reduce((s, iso) => s + activities.filter(a => a.date === iso).reduce((ss, a) => ss + (a.kcal || 0), 0), 0),
    [activities, weekDays]
  );

  const prevMonISO = (() => { const d = new Date(getMondayISO()); d.setDate(d.getDate()-7); return toISO(d); })();
  const prevWkDays = useMemo(() => getWeekDays(prevMonISO), [prevMonISO]);
  const prevTotal  = useMemo(() => prevWkDays.reduce((s, iso) => s + activities.filter(a => a.date === iso).reduce((ss, a) => ss + a.distanceKm, 0), 0), [activities, prevWkDays]);
  const trendDiff  = weekTotal - prevTotal;

  const displayed = showAll ? activities : activities.slice(0, 4);

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:110 }}>
      {/* HEADER — "Camminata" allineato con ingranaggio */}
      <div style={{ padding:"20px 20px 10px",background:T.bg,position:"sticky",top:0,zIndex:10 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:12,color:T.textMuted,fontWeight:500 }}>Attività</div>
            <h1 style={{ fontSize:24,fontWeight:800,color:T.text,margin:0,letterSpacing:-.5 }}>Camminata</h1>
          </div>
          <button onClick={onEditGoal} style={{ width:40,height:40,borderRadius:12,background:T.card,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:T.shadow }}>
            <Settings size={18} color={T.teal}/>
          </button>
        </div>
      </div>

      <div style={{ padding:"0 20px" }}>
        {/* ── CARD SETTIMANALE — Opzione B: barra gradient ── */}
        <div style={{ background:T.card,borderRadius:24,padding:"20px 18px 16px",marginBottom:14,boxShadow:T.shadowLg }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4 }}>
            <div style={{ fontSize:10,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:".05em" }}>Questa settimana</div>
            <div style={{ display:"flex",alignItems:"center",gap:5 }}>
              {trendDiff >= 0
                ? <TrendingUp size={12} color={GREEN}/>
                : <TrendingDown size={12} color={T.coral}/>}
              <span style={{ fontSize:11,fontWeight:700,color:trendDiff>=0?GREEN:T.coral }}>
                {trendDiff >= 0 ? "+" : ""}{trendDiff.toFixed(1)} km
              </span>
            </div>
          </div>

          {/* Big numbers + kcal badge */}
          <div style={{ display:"flex",alignItems:"baseline",gap:6,marginBottom:10 }}>
            <span style={{ fontSize:42,fontWeight:900,color:T.text,letterSpacing:-2,lineHeight:1 }}>{weekTotal.toFixed(1)}</span>
            <span style={{ fontSize:15,fontWeight:600,color:T.textSec }}>/ {weeklyGoal} km</span>
            <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:5,background:`${ORANGE}12`,padding:"5px 12px",borderRadius:12 }}>
              <Flame size={12} color={ORANGE}/>
              <span style={{ fontSize:12,fontWeight:800,color:ORANGE }}>{weekKcal.toLocaleString("it-IT")} kcal</span>
            </div>
          </div>

          {/* Gradient progress bar */}
          <div style={{ position:"relative",height:10,background:T.tealLight,borderRadius:10,marginBottom:4,overflow:"hidden" }}>
            <div style={{ width:`${Math.min(pct,100)}%`,height:"100%",borderRadius:10,background:"linear-gradient(90deg,#028090,#02C39A)",transition:"width .5s" }}/>
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:14 }}>
            <span style={{ fontSize:10,color:T.textMuted }}>0 km</span>
            <span style={{ fontSize:10,fontWeight:700,color:T.textSec }}>
              {pct >= 100 ? "🎉 Obiettivo raggiunto!" : `Mancano ${(weeklyGoal - weekTotal).toFixed(1)} km · ${Math.round(pct)}%`}
            </span>
            <span style={{ fontSize:10,color:T.textMuted }}>{weeklyGoal} km</span>
          </div>

          {/* Grafico a barre */}
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={chart} barSize={22} margin={{ top:0,right:0,left:-28,bottom:0 }}>
              <XAxis dataKey="day" tick={{ fontSize:10,fill:T.textMuted,fontWeight:600 }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{ background:"rgba(0,0,0,.75)",border:"none",borderRadius:8,fontSize:11,color:"#fff" }} cursor={{ fill:`${T.teal}10` }} formatter={v=>[`${v} km`]}/>
              <Bar dataKey="km" radius={[5,5,0,0]}>
                {chart.map((d,i) => (
                  <Cell key={i} fill={d.iso===oggi?T.mint:d.km>0?T.teal:"#F0F0F0"}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── SESSIONI RECENTI (4 + Vedi tutte) ── */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
          <div style={{ fontSize:13,fontWeight:700,color:T.text }}>🚶 Sessioni recenti</div>
          {activities.length > 4 && (
            <button onClick={() => setShowAll(v => !v)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:12,color:T.teal,fontWeight:700 }}>
              {showAll ? "Mostra meno" : `Vedi tutte (${activities.length})`}
            </button>
          )}
        </div>

        {activities.length === 0 ? (
          <div style={{ background:T.card,borderRadius:16,padding:"36px 20px",textAlign:"center",boxShadow:T.shadow }}>
            <Footprints size={34} color={T.textMuted} style={{ marginBottom:10 }}/>
            <div style={{ fontSize:14,color:T.textMuted,fontWeight:600,lineHeight:1.5 }}>
              Nessuna camminata ancora.<br/>Premi + per iniziare!
            </div>
          </div>
        ) : (
          <>
            {displayed.map(a => (
              <SwipeCard key={a.id} activity={a} onDelete={onDelete} onClick={onEdit}/>
            ))}
            <div style={{ fontSize:10,color:T.textMuted,textAlign:"center",margin:"4px 0 16px",fontWeight:500 }}>
              ← Scorri per eliminare · Tocca per modificare
            </div>
          </>
        )}
      </div>

      <button onClick={onReport} style={{
        position:"fixed",bottom:86,right:20,
        background:T.gradient,border:"none",borderRadius:50,padding:"11px 20px",
        display:"flex",alignItems:"center",gap:8,
        boxShadow:"0 6px 24px rgba(2,128,144,0.35)",cursor:"pointer",zIndex:15,
      }}>
        <BarChart3 size={16} color="#fff"/>
        <span style={{ fontSize:13,fontWeight:700,color:"#fff" }}>Report</span>
      </button>

      <FitnessBottomNav onAdd={onAdd} onNavigate={onNavigate}/>
    </div>
  );
};

/* ═══════════════════════════════════════════
   SCREEN: REPORT
   Dettaglio · Confronto · Metriche Totali · Storico
   ═══════════════════════════════════════════ */
const ReportScreen = ({ activities, onBack, onNavigate }) => {
  const [period,      setPeriod]      = useState("week");
  const [chartMetric, setChartMetric] = useState("km");
  const [showAllW,    setShowAllW]    = useState(false);
  const [showAllM,    setShowAllM]    = useState(false);

  const weekData = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(getMondayISO()); d.setDate(d.getDate() - i * 7);
      const days = getWeekDays(toISO(d));
      const acts = days.flatMap(iso => activities.filter(a => a.date === iso));
      const km   = parseFloat(acts.reduce((s, a) => s + a.distanceKm, 0).toFixed(1));
      const kcal = Math.round(acts.reduce((s, a) => s + (a.kcal || 0), 0));
      const sess = acts.length;
      const avgPace = acts.length ? parseFloat((acts.reduce((s, a) => s + (a.paceMinKm || 0), 0) / acts.length).toFixed(1)) : 0;
      return { label: i === 0 ? "Questa" : `-${i}w`, km, kcal, sess, avgPace, periodLabel: toISO(d).slice(5) };
    }).reverse();
  }, [activities]);

  const monthData = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const y = d.getFullYear(), m = d.getMonth();
      const acts = activities.filter(a => { const dd = new Date(a.date); return dd.getFullYear()===y && dd.getMonth()===m; });
      const km   = parseFloat(acts.reduce((s, a) => s + a.distanceKm, 0).toFixed(1));
      const kcal = Math.round(acts.reduce((s, a) => s + (a.kcal || 0), 0));
      const sess = acts.length;
      const avgPace = acts.length ? parseFloat((acts.reduce((s, a) => s + (a.paceMinKm || 0), 0) / acts.length).toFixed(1)) : 0;
      return { label: MONTH_LABELS[m], km, kcal, sess, avgPace, periodLabel: `${MONTH_LABELS[m]} ${y}` };
    }).reverse();
  }, [activities]);

  const data   = period === "week" ? weekData : monthData;
  const curr   = data[data.length - 1];
  const prev   = data[data.length - 2];
  const sliced = data.slice(-6);
  const maxVal = Math.max(...sliced.map(d => d[chartMetric]), 1);
  const nonZero = sliced.filter(d => d[chartMetric] > 0);
  const avg    = nonZero.length ? Math.round(nonZero.reduce((s, d) => s + d[chartMetric], 0) / nonZero.length) : 0;

  const pr = useMemo(() => calcPR(activities), [activities]);
  const totalKcal = activities.reduce((s, a) => s + (a.kcal || 0), 0);
  const maxStreakVal = useMemo(() => calcMaxStreak(activities), [activities]);

  const metricColor = chartMetric === "km" ? T.teal : ORANGE;
  const metricUnit  = chartMetric === "km" ? "km" : "kcal";

  const confrontoMetrics = [
    { label:"Km",       key:"km",       color:T.teal },
    { label:"Kcal",     key:"kcal",     color:ORANGE },
    { label:"Sessioni", key:"sess",     color:T.purple },
    { label:"Passo",    key:"avgPace",  color:GREEN, inv:true },
  ];

  const visW = weekData.slice().reverse();
  const visM = monthData.slice().reverse();
  const showW = showAllW ? visW : visW.slice(0, 4);
  const showM = showAllM ? visM : visM.slice(0, 4);

  const formatTotalTime = (min) => {
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    return `${h}h`;
  };

  const TableRow = ({ item, i, isCurrent }) => (
    <tr style={{ background: isCurrent ? `${T.teal}08` : "transparent" }}>
      <td style={{ padding:"8px 4px",borderBottom:`1px solid ${T.border}`,fontWeight:isCurrent?700:500,color:isCurrent?T.teal:T.text,fontSize:11 }}>
        {item.periodLabel}{isCurrent && <span style={{ fontSize:8,color:T.mint,marginLeft:4 }}>attuale</span>}
      </td>
      <td style={{ textAlign:"right",padding:"8px 4px",borderBottom:`1px solid ${T.border}`,fontWeight:700,color:T.text,fontSize:11 }}>{item.km}</td>
      <td style={{ textAlign:"right",padding:"8px 4px",borderBottom:`1px solid ${T.border}`,fontWeight:700,color:T.text,fontSize:11 }}>{item.kcal}</td>
      <td style={{ textAlign:"right",padding:"8px 4px",borderBottom:`1px solid ${T.border}`,fontWeight:700,color:T.text,fontSize:11 }}>{item.sess}</td>
      <td style={{ textAlign:"right",padding:"8px 4px",borderBottom:`1px solid ${T.border}`,fontWeight:700,color:T.text,fontSize:11 }}>{item.avgPace > 0 ? item.avgPace.toFixed(1) : "—"}</td>
    </tr>
  );

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:100 }}>
      <div style={{ position:"sticky",top:0,zIndex:10,background:T.bg,display:"flex",alignItems:"center",gap:12,padding:"16px 16px 12px" }}>
        <button onClick={onBack} style={{ width:36,height:36,borderRadius:12,background:T.tealLight,border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
          <ChevronLeft size={18} color={T.teal}/>
        </button>
        <div style={{ fontSize:20,fontWeight:800,color:T.text }}>Report Camminata</div>
      </div>

      <div style={{ padding:"0 16px" }}>
        {/* Toggle */}
        <div style={{ display:"flex",background:"#F3F4F6",borderRadius:12,padding:4,marginBottom:14 }}>
          {[["week","Settimanale"],["month","Mensile"]].map(([v,l]) => (
            <button key={v} onClick={() => setPeriod(v)} style={{
              flex:1,padding:"9px 0",borderRadius:9,border:"none",cursor:"pointer",
              background:period===v?T.card:"transparent",fontWeight:700,fontSize:13,
              color:period===v?T.text:T.textMuted,boxShadow:period===v?T.shadow:"none",transition:".2s",
            }}>{l}</button>
          ))}
        </div>

        {/* ── DETTAGLIO ── */}
        <div style={{ background:T.card,borderRadius:18,padding:16,boxShadow:T.shadow,marginBottom:12 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <div style={{ fontSize:14,fontWeight:800,color:T.text }}>Dettaglio</div>
            <div style={{ display:"flex",background:"#F3F4F6",borderRadius:20,padding:3,gap:2 }}>
              {[["km","Km"],["kcal","Kcal"]].map(([v,l]) => (
                <button key={v} onClick={() => setChartMetric(v)} style={{
                  padding:"4px 12px",borderRadius:16,border:"none",cursor:"pointer",
                  background:chartMetric===v?T.teal:"transparent",
                  color:chartMetric===v?"#fff":T.textMuted,fontWeight:700,fontSize:11,transition:".15s",
                }}>{l}</button>
              ))}
            </div>
          </div>
          {/* Bar chart */}
          <div style={{ display:"flex",gap:8,alignItems:"flex-end",height:118,marginBottom:10,padding:"0 2px" }}>
            {sliced.map((d, i) => {
              const h = maxVal > 0 ? (d[chartMetric] / maxVal) * 100 : 0;
              return (
                <div key={i} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2 }}>
                  <div style={{ fontSize:8,fontWeight:700,color:metricColor }}>{d[chartMetric] || ""}</div>
                  <div style={{ width:"100%",height:80,position:"relative" }}>
                    <div style={{
                      position:"absolute",bottom:0,left:"10%",width:"80%",
                      height:`${Math.max(h, d[chartMetric] > 0 ? 2 : 0)}%`,
                      background:metricColor,borderRadius:4,opacity:0.85,transition:"height 0.3s",
                    }}/>
                  </div>
                  <div style={{ fontSize:8,color:T.textMuted,fontWeight:600 }}>{d.label}</div>
                </div>
              );
            })}
          </div>
          {/* Media — allineata correttamente */}
          <div style={{ display:"flex",alignItems:"baseline",justifyContent:"center",gap:4,padding:"8px 0 0",borderTop:`1px solid ${T.border}` }}>
            <span style={{ fontSize:16,fontWeight:800,color:metricColor }}>{avg}</span>
            <span style={{ fontSize:10,color:T.textMuted }}>{metricUnit}/{period==="week"?"settimana":"mese"} media</span>
          </div>
        </div>

        {/* ── CONFRONTO ── */}
        {curr && prev && (
          <div style={{ background:T.card,borderRadius:18,padding:16,boxShadow:T.shadow,marginBottom:12 }}>
            <div style={{ fontSize:14,fontWeight:700,color:T.text,marginBottom:4 }}>📊 Confronto</div>
            <div style={{ fontSize:10,color:T.textMuted,marginBottom:12 }}>{curr.periodLabel} vs {prev.periodLabel}</div>
            <div style={{ display:"flex",gap:6 }}>
              {confrontoMetrics.map(m => {
                const cV = curr[m.key] || 0, pV = prev[m.key] || 0;
                const diff = cV - pV;
                const pctC = pV > 0 ? Math.round((diff / pV) * 100) : 0;
                const isUp = diff > 0;
                const arrow = isUp ? "↑" : diff < 0 ? "↓" : "=";
                const aC = m.inv ? (isUp ? T.coral : GREEN) : (isUp ? GREEN : T.coral);
                return (
                  <div key={m.key} style={{ flex:1,background:`${m.color}0A`,borderRadius:12,padding:"10px 6px",textAlign:"center" }}>
                    <div style={{ fontSize:9,fontWeight:600,color:T.textMuted,marginBottom:4 }}>{m.label}</div>
                    <div style={{ fontSize:16,fontWeight:800,color:m.color }}>{m.key==="avgPace"&&cV>0?cV.toFixed(1):cV}</div>
                    <div style={{ fontSize:9,color:T.textMuted,marginTop:2 }}>vs {m.key==="avgPace"&&pV>0?pV.toFixed(1):pV}</div>
                    <div style={{ fontSize:11,fontWeight:700,color:diff===0?T.textMuted:aC,marginTop:4 }}>{arrow}{Math.abs(pctC)}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── METRICHE TOTALI ── */}
        <div style={{ background:T.card,borderRadius:18,padding:16,boxShadow:T.shadow,marginBottom:12 }}>
          <div style={{ fontSize:14,fontWeight:700,color:T.text,marginBottom:14 }}>🏆 Metriche Totali</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10 }}>
            {[
              { val: pr.totalKm.toFixed(1), unit:"km",   label:"km totali",      color:T.teal,   Icon:Footprints },
              { val: totalKcal.toLocaleString("it-IT"), unit:"kcal", label:"kcal bruciate", color:ORANGE, Icon:Flame },
              { val: `${activities.length}`, unit:"",    label:"sessioni",       color:T.purple, Icon:Zap },
              { val: formatTotalTime(pr.totalMin), unit:"", label:"tempo totale",  color:GREEN,    Icon:Clock },
            ].map(({ val, unit, label, color, Icon }) => (
              <div key={label} style={{ background:`${color}08`,borderRadius:14,padding:14,textAlign:"center" }}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:4,marginBottom:6 }}>
                  <Icon size={14} color={color}/>
                </div>
                <div style={{ fontSize:28,fontWeight:900,color,lineHeight:1 }}>{val}{unit && <span style={{ fontSize:11,fontWeight:600,marginLeft:2 }}>{unit}</span>}</div>
                <div style={{ fontSize:10,color:T.textMuted,fontWeight:600,marginTop:4 }}>{label}</div>
              </div>
            ))}
          </div>
          {/* Record */}
          <div style={{ display:"flex",gap:8 }}>
            {[
              { emoji:"🏅", val: `${pr.maxDist.toFixed(1)} km`, label:"distanza max" },
              { emoji:"⚡", val: pr.bestPace < Infinity ? `${formatPace(pr.bestPace)}/km` : "—", label:"ritmo migliore" },
              { emoji:"🔥", val: `${pr.maxKcal} kcal`, label:"kcal max" },
            ].map(({ emoji, val, label }) => (
              <div key={label} style={{ flex:1,background:`${T.gold}08`,borderRadius:12,padding:10,display:"flex",alignItems:"center",gap:8 }}>
                <span style={{ fontSize:16 }}>{emoji}</span>
                <div>
                  <div style={{ fontSize:13,fontWeight:800,color:T.gold }}>{val}</div>
                  <div style={{ fontSize:9,color:T.textMuted }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── STORICO (4 + Vedi tutte) ── */}
        <div style={{ background:T.card,borderRadius:18,padding:16,boxShadow:T.shadow,marginBottom:20 }}>
          <div style={{ fontSize:14,fontWeight:700,color:T.text,marginBottom:14 }}>🕐 Storico</div>

          {/* Settimanale */}
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
            <div style={{ fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.5 }}>Settimanale</div>
            {visW.length > 4 && (
              <button onClick={() => setShowAllW(v => !v)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:11,color:T.teal,fontWeight:700 }}>
                {showAllW ? "Mostra meno" : "Vedi tutte"}
              </button>
            )}
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign:"left",padding:"6px 4px",fontWeight:700,fontSize:10,color:T.textMuted,borderBottom:`2px solid ${T.border}` }}>Settimana</th>
                  <th style={{ textAlign:"right",padding:"6px 4px",fontWeight:700,fontSize:10,color:T.teal,borderBottom:`2px solid ${T.border}` }}>Km</th>
                  <th style={{ textAlign:"right",padding:"6px 4px",fontWeight:700,fontSize:10,color:ORANGE,borderBottom:`2px solid ${T.border}` }}>Kcal</th>
                  <th style={{ textAlign:"right",padding:"6px 4px",fontWeight:700,fontSize:10,color:T.purple,borderBottom:`2px solid ${T.border}` }}>Sess.</th>
                  <th style={{ textAlign:"right",padding:"6px 4px",fontWeight:700,fontSize:10,color:GREEN,borderBottom:`2px solid ${T.border}` }}>Passo</th>
                </tr>
              </thead>
              <tbody>
                {showW.map((w, i) => <TableRow key={i} item={w} i={i} isCurrent={i===0}/>)}
              </tbody>
            </table>
          </div>

          {/* Mensile */}
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16,marginBottom:8 }}>
            <div style={{ fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.5 }}>Mensile</div>
            {visM.length > 4 && (
              <button onClick={() => setShowAllM(v => !v)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:11,color:T.teal,fontWeight:700 }}>
                {showAllM ? "Mostra meno" : "Vedi tutte"}
              </button>
            )}
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign:"left",padding:"6px 4px",fontWeight:700,fontSize:10,color:T.textMuted,borderBottom:`2px solid ${T.border}` }}>Mese</th>
                  <th style={{ textAlign:"right",padding:"6px 4px",fontWeight:700,fontSize:10,color:T.teal,borderBottom:`2px solid ${T.border}` }}>Km</th>
                  <th style={{ textAlign:"right",padding:"6px 4px",fontWeight:700,fontSize:10,color:ORANGE,borderBottom:`2px solid ${T.border}` }}>Kcal</th>
                  <th style={{ textAlign:"right",padding:"6px 4px",fontWeight:700,fontSize:10,color:T.purple,borderBottom:`2px solid ${T.border}` }}>Sess.</th>
                  <th style={{ textAlign:"right",padding:"6px 4px",fontWeight:700,fontSize:10,color:GREEN,borderBottom:`2px solid ${T.border}` }}>Passo</th>
                </tr>
              </thead>
              <tbody>
                {showM.map((m, i) => <TableRow key={i} item={m} i={i} isCurrent={i===0}/>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <FitnessBottomNav onAdd={() => {}} onNavigate={onNavigate}/>
    </div>
  );
};

/* ═══════════════════════════════════════════
   ROOT EXPORT
   ═══════════════════════════════════════════ */
export default function FitnessSection({ onNavigate }) {
  const [subScreen,     setSubScreen]     = useState("main");
  const [activities,    setActivities]    = useState([]);
  const [weeklyGoal,    setWeeklyGoal]    = useState(20);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editTarget,    setEditTarget]    = useState(null);
  const [lastSession,   setLastSession]   = useState(null);
  const [userProfile,   setUserProfile]   = useState(null);

  const loadData = useCallback(async () => {
    const [goal, profile, last] = await Promise.all([
      getWeeklyGoalKm(), getNutritionGoals(), getLastFitnessActivity(),
    ]);
    if (goal)    setWeeklyGoal(goal);
    if (profile) setUserProfile(profile);
    if (last)    setLastSession(last);

    const end   = todayISO();
    const start = toISO(new Date(Date.now() - 120 * 86400000));
    const acts  = await getFitnessActivitiesByDateRange(start, end);
    setActivities(acts.sort((a, b) => b.date.localeCompare(a.date)));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const checkNewPR = useCallback((newAct, prevActs) => {
    if (!prevActs.length) return null;
    const pr = calcPR(prevActs);
    if (newAct.distanceKm > pr.maxDist) return `🏆 Nuovo record di distanza: ${newAct.distanceKm.toFixed(1)} km!`;
    if (newAct.paceMinKm && newAct.paceMinKm < pr.bestPace) return `⚡️ Nuovo record di ritmo: ${formatPace(newAct.paceMinKm)}/km!`;
    return null;
  }, []);

  const handleSaveNew = useCallback(async (act) => {
    const pr = checkNewPR(act, activities);
    await addFitnessActivity(act);
    await loadData();
    setSubScreen("main");
    if (pr) setTimeout(() => alert(pr), 400);
  }, [activities, checkNewPR, loadData]);

  const handleSaveEdit = useCallback(async (act) => {
    if (!editTarget?.id) return;
    await updateFitnessActivity(editTarget.id, act);
    await loadData();
    setEditTarget(null);
    setSubScreen("main");
  }, [editTarget, loadData]);

  const handleDelete = useCallback(async (id) => {
    await deleteFitnessActivity(id);
    await loadData();
  }, [loadData]);

  const handleSaveGoal = useCallback(async (km) => {
    await saveWeeklyGoalKm(km);
    setWeeklyGoal(km);
  }, []);

  const openEdit = useCallback((act) => {
    setEditTarget(act);
    setSubScreen("editWalk");
  }, []);

  // Scroll to top su ogni cambio schermata
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [subScreen]);

  // Scroll to top anche quando si clicca su Fitness dalla bottom nav
  const handleNavigate = useCallback((section) => {
    if (section === "fitness") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      onNavigate(section);
    }
  }, [onNavigate]);

  const defaultInitial = useMemo(() => ({
    distanceKm:  lastSession?.distanceKm  ?? 5.0,
    durationMin: lastSession?.durationMin  ?? 50,
    heartRate:   lastSession?.heartRate    ?? 0,
    slope:       lastSession?.slope        ?? 0,
  }), [lastSession]);

  if (subScreen === "addWalk") return (
    <>
      <WalkForm title="Nuova camminata" initial={defaultInitial} userProfile={userProfile}
        onSave={handleSaveNew} onBack={() => setSubScreen("main")}/>
      {showGoalModal && <GoalModal current={weeklyGoal} onSave={handleSaveGoal} onClose={() => setShowGoalModal(false)}/>}
    </>
  );

  if (subScreen === "editWalk") return (
    <>
      <WalkForm title="Modifica camminata" initial={editTarget} userProfile={userProfile}
        onSave={handleSaveEdit} onBack={() => { setEditTarget(null); setSubScreen("main"); }}/>
      {showGoalModal && <GoalModal current={weeklyGoal} onSave={handleSaveGoal} onClose={() => setShowGoalModal(false)}/>}
    </>
  );

  if (subScreen === "report") return (
    <ReportScreen activities={activities} onBack={() => setSubScreen("main")} onNavigate={handleNavigate}/>
  );

  return (
    <>
      <MainScreen activities={activities} weeklyGoal={weeklyGoal}
        onAdd={() => setSubScreen("addWalk")} onDelete={handleDelete} onEdit={openEdit}
        onEditGoal={() => setShowGoalModal(true)} onNavigate={handleNavigate} onReport={() => setSubScreen("report")}/>
      {showGoalModal && <GoalModal current={weeklyGoal} onSave={handleSaveGoal} onClose={() => setShowGoalModal(false)}/>}
    </>
  );
}
