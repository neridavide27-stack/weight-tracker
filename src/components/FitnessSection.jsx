"use client";
// FitnessSection.jsx — Walking tracker module
// Features:
//   - Card unificata obiettivo + grafico settimanale + kcal bruciate
//   - Sessioni recenti: swipe ← elimina, click → modifica
//   - Form con hero gradient km, slider durata + chips, slider bpm/slope
//   - Calcolo kcal ibrido: MET + pendenza + aggiustamento HR (Karvonen)
//   - Report: Dettaglio, Confronto, Streak & Costanza, Storico

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  ChevronLeft, Plus, Check, X, Settings,
  Timer, Gauge, Footprints, Home, Utensils, Dumbbell, User,
  Flame, Trophy, TrendingUp, TrendingDown, BarChart3, Zap,
  Heart, Mountain,
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

const DAY_LABELS    = ["L", "M", "M", "G", "V", "S", "D"];

/* ═══════════════════════════════════════════
   CALCOLO KCAL IBRIDO
   MET base (velocità) + pendenza + aggiustamento HR (Karvonen)
   ═══════════════════════════════════════════ */
/**
 * @param {Object} p
 * @param {number} p.durationMin  - durata in minuti
 * @param {number} p.paceMinKm   - ritmo (min/km)
 * @param {number} p.weight      - peso kg
 * @param {number} [p.heartRate] - battiti medi (opzionale)
 * @param {number} [p.slope]     - pendenza % (opzionale)
 */
export const calcKcal = ({ durationMin, paceMinKm, weight, heartRate, slope }) => {
  if (!durationMin || !weight) return 0;

  // ── 1. MET base dalla velocità (tabella ACSM) ──
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

  // ── 2. Correzione pendenza: +0.35 MET per ogni 1% ──
  if (slope && slope > 0) {
    met += slope * 0.35;
  }

  // ── 3. Aggiustamento HR via Karvonen %HRR (±30% max) ──
  if (heartRate && heartRate > 0) {
    const restHR = 60;
    const maxHR  = 190;
    const hrr    = Math.max(0, Math.min(1, (heartRate - restHR) / (maxHR - restHR)));
    const expectedHRR = Math.max(0.1, (met - 1) / 12);
    const adj    = Math.max(0.7, Math.min(1.3, 1 + 0.3 * ((hrr - expectedHRR) / Math.max(0.1, expectedHRR))));
    met *= adj;
  }

  return Math.max(0, Math.round(met * weight * (durationMin / 60)));
};

/* ═══════════════════════════════════════════
   STREAK
   ═══════════════════════════════════════════ */
const calcStreak = (activities) => {
  const dates = new Set(activities.map(a => a.date));
  let streak = 0;
  const d = new Date();
  while (true) {
    const iso = toISO(d);
    if (dates.has(iso)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (iso === todayISO()) {
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
};

/* ═══════════════════════════════════════════
   RECORD PERSONALI
   ═══════════════════════════════════════════ */
const calcPR = (activities) => ({
  maxDist:  activities.length ? Math.max(...activities.map(a => a.distanceKm)) : 0,
  bestPace: activities.length ? Math.min(...activities.map(a => a.paceMinKm).filter(Boolean)) : Infinity,
  totalKm:  activities.reduce((s, a) => s + a.distanceKm, 0),
  maxKcal:  activities.length ? Math.max(...activities.map(a => a.kcal || 0)) : 0,
});

/* ═══════════════════════════════════════════
   SMALL SHARED COMPONENTS
   ═══════════════════════════════════════════ */

const CircularRing = ({ pct, size = 110, stroke = 11, color = "#fff" }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - Math.min(pct / 100, 1) * c;
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`${color}28`} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
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
          }}>
            <Plus size={26} strokeWidth={2.5}/>
          </button>
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
    startRef.current = x;
    setDragging(true);
  };
  const moveDrag = (e) => {
    e.stopPropagation();
    if (!dragging || startRef.current === null) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const dx = startRef.current - x; // positivo = swipe a sinistra
    if (dx > 0) setSwipeX(Math.min(dx, threshold + 20));
    else setSwipeX(0);
  };
  const endDrag = (e) => {
    e.stopPropagation();
    setDragging(false);
    if (swipeX >= threshold) onDelete(a.id);
    else setSwipeX(0);
    startRef.current = null;
  };

  const pace = a.paceMinKm;

  return (
    <div style={{ position:"relative", marginBottom:10, overflow:"hidden", borderRadius:16 }}>
      {/* Delete layer (destra) */}
      <div style={{
        position:"absolute",top:0,bottom:0,right:0,width:"100%",
        background:"#FEE2E2",
        display:"flex",alignItems:"center",justifyContent:"flex-end",
        paddingRight:22,borderRadius:16,
        opacity: Math.min(swipeX / (threshold * 0.6), 1),
      }}>
        <span style={{ fontSize:22 }}>🗑️</span>
        <span style={{ marginLeft:8,fontSize:12,fontWeight:700,color:T.coral }}>
          {swipeX >= threshold ? "Rilascia!" : "← Elimina"}
        </span>
      </div>

      {/* Card */}
      <div
        onClick={() => { if (swipeX < 5) onClick(a); }}
        onTouchStart={startDrag}
        onTouchMove={moveDrag}
        onTouchEnd={endDrag}
        onMouseDown={startDrag}
        onMouseMove={(e) => { if (dragging) moveDrag(e); }}
        onMouseUp={endDrag}
        onMouseLeave={() => { if (dragging) endDrag(new Event("mouseleave")); }}
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
          {/* Riga 1: km + bpm + slope + data */}
          <div style={{ display:"flex",alignItems:"baseline",gap:6,marginBottom:5 }}>
            <span style={{ fontSize:22,fontWeight:900,color:T.text,letterSpacing:-.5 }}>{a.distanceKm.toFixed(1)}</span>
            <span style={{ fontSize:12,fontWeight:700,color:T.textMuted }}>km</span>
            {a.heartRate > 0 && (
              <span style={{ fontSize:11,color:T.coral,fontWeight:600,display:"flex",alignItems:"center",gap:2 }}>
                <Heart size={10} color={T.coral} fill={T.coral}/>{a.heartRate}
              </span>
            )}
            {a.slope > 0 && (
              <span style={{ fontSize:11,color:T.purple,fontWeight:600,display:"flex",alignItems:"center",gap:2 }}>
                <Mountain size={10} color={T.purple}/>{a.slope}%
              </span>
            )}
            <span style={{ fontSize:11,color:T.textMuted,marginLeft:"auto",whiteSpace:"nowrap" }}>{formatDateLabel(a.date)}</span>
          </div>
          {/* Riga 2: durata · passo · kcal — allineati orizzontalmente */}
          <div style={{ display:"flex",alignItems:"center",gap:14 }}>
            <span style={{ fontSize:11,color:T.textSec,display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap" }}>
              <Timer size={11} color={T.textMuted}/>{formatDuration(a.durationMin)}
            </span>
            <span style={{ fontSize:11,color:T.textSec,display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap" }}>
              <Gauge size={11} color={T.textMuted}/>{formatPace(pace)}/km
            </span>
            {a.kcal > 0 && (
              <span style={{ fontSize:11,color:T.textSec,display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap" }}>
                <Flame size={11} color={ORANGE}/>{a.kcal} kcal
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
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20 }}>
          <div style={{ fontSize:18,fontWeight:800,color:T.text }}>Obiettivo settimanale</div>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",padding:4 }}><X size={20} color={T.textMuted}/></button>
        </div>
        <div style={{ fontSize:12,color:T.textMuted,fontWeight:600,textAlign:"center",marginBottom:16 }}>Km da percorrere ogni settimana (Lun → Dom)</div>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:20,marginBottom:28 }}>
          <button onClick={() => setVal(v => Math.max(1, v-5))} style={{ width:44,height:44,borderRadius:14,border:"1.5px solid #E5E7EB",background:T.bg,cursor:"pointer",fontSize:22,fontWeight:700,color:T.text }}>−</button>
          <div style={{ textAlign:"center",minWidth:90 }}>
            <span style={{ fontSize:48,fontWeight:900,color:T.text,letterSpacing:-2 }}>{val}</span>
            <span style={{ fontSize:16,color:T.textMuted,fontWeight:700 }}> km</span>
          </div>
          <button onClick={() => setVal(v => Math.min(200, v+5))} style={{ width:44,height:44,borderRadius:14,border:"1.5px solid #E5E7EB",background:T.bg,cursor:"pointer",fontSize:22,fontWeight:700,color:T.text }}>+</button>
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

  const kmNum    = parseFloat(parseFloat(km).toFixed(1)) || 0;
  const valid    = kmNum > 0 && duration > 0;
  const pace     = valid ? duration / kmNum : null;

  const kcalAuto = useMemo(() => calcKcal({
    durationMin: duration,
    paceMinKm:   pace,
    weight:      userProfile?.weight   || 75,
    heartRate:   heartRate > 0 ? heartRate : null,
    slope:       slope > 0 ? slope : null,
  }), [duration, pace, userProfile, heartRate, slope]);

  const kcalDisplay = kcalOver !== null ? kcalOver : kcalAuto;

  const formulaHint = heartRate > 0 && slope > 0
    ? "MET + HR + pendenza"
    : heartRate > 0
      ? "MET corretto con HR"
      : slope > 0
        ? "MET + correzione pendenza"
        : "Formula MET standard";

  const adjustKm = (delta) => {
    setKm(prev => Math.max(0.1, parseFloat((parseFloat(prev) + delta).toFixed(1))));
  };

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const activity = {
      date,
      distanceKm:  kmNum,
      durationMin: duration,
      paceMinKm:   parseFloat((pace || 0).toFixed(2)),
      kcal:        kcalDisplay,
      heartRate:   heartRate > 0 ? parseInt(heartRate) : null,
      slope:       slope > 0 ? parseFloat(slope) : null,
    };
    await onSave(activity);
    setSaving(false);
  };

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif" }}>
      {/* HEADER */}
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

      {/* DURATA — slider + chips */}
      <div style={{ background:T.card,borderRadius:20,padding:16,boxShadow:T.shadow,margin:"0 14px 12px" }}>
        <div style={{ fontSize:10,fontWeight:800,color:T.textMuted,letterSpacing:0.8,marginBottom:10 }}>⏱ DURATA</div>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:6 }}>
          <div style={{ fontSize:30,fontWeight:900,minWidth:90,color:T.text }}>
            {duration >= 60 ? `${Math.floor(duration/60)}h` : ""}{duration >= 60 && duration % 60 > 0 ? " " : ""}{duration % 60 > 0 || duration < 60 ? `${duration % 60}` : ""}
            <span style={{ fontSize:13,color:T.textMuted,fontWeight:700,marginLeft:3 }}>{duration < 60 ? "min" : duration % 60 > 0 ? "min" : ""}</span>
          </div>
          <input type="range" min={5} max={180} step={5} value={duration}
            onChange={e => setDuration(parseInt(e.target.value))}
            style={{
              flex:1,WebkitAppearance:"none",appearance:"none",height:6,borderRadius:10,outline:"none",
              background:`linear-gradient(to right,${T.teal} 0%,${T.teal} ${((duration-5)/175)*100}%,#E2E8F0 ${((duration-5)/175)*100}%,#E2E8F0 100%)`,
            }}/>
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

      {/* RITMO CALCOLATO */}
      {valid && (
        <div style={{ background:`${T.teal}08`,border:`1px solid ${T.tealLight}`,borderRadius:14,padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"center",gap:8,margin:"0 14px 12px" }}>
          <Gauge size={15} color={T.teal}/>
          <span style={{ fontSize:13,fontWeight:600,color:T.teal }}>
            Ritmo medio: <strong>{formatPace(pace)}/km</strong>
          </span>
        </div>
      )}

      {/* SEZIONE OPZIONALE */}
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
          <div style={{ fontSize:24,fontWeight:900,color: heartRate > 55 ? "#EF4444" : T.textMuted,minWidth:78 }}>
            {heartRate > 55 ? heartRate : "—"} <span style={{ fontSize:13,color:T.textMuted,fontWeight:700 }}>bpm</span>
          </div>
          <input type="range" min={50} max={200} step={1} value={heartRate || 50}
            onChange={e => { const v = parseInt(e.target.value); setHeartRate(v <= 55 ? 0 : v); }}
            style={{
              flex:1,WebkitAppearance:"none",appearance:"none",height:6,borderRadius:10,outline:"none",
              background:`linear-gradient(to right,#EF4444 0%,#EF4444 ${(((heartRate||50)-50)/150)*100}%,#E2E8F0 ${(((heartRate||50)-50)/150)*100}%,#E2E8F0 100%)`,
            }}/>
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
            style={{
              flex:1,WebkitAppearance:"none",appearance:"none",height:6,borderRadius:10,outline:"none",
              background:`linear-gradient(to right,${T.purple} 0%,${T.purple} ${(slope/20)*100}%,#E2E8F0 ${(slope/20)*100}%,#E2E8F0 100%)`,
            }}/>
        </div>
      </div>

      {/* KCAL CARD */}
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
        <div>
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
      </div>

      {/* BOTTONE SALVA */}
      <button onClick={handleSave} disabled={!valid || saving} style={{
        width:"calc(100% - 28px)",margin:"8px 14px 24px",padding:16,borderRadius:18,border:"none",
        background: valid ? "linear-gradient(135deg,#028090,#7C5CFC)" : "#E5E7EB",
        color: valid ? "#fff" : T.textMuted,
        fontSize:15,fontWeight:800,
        cursor: valid && !saving ? "pointer" : "not-allowed",
        boxShadow: valid ? "0 8px 24px rgba(2,128,144,0.35)" : "none",
        display:"flex",alignItems:"center",justifyContent:"center",gap:8,
      }}>
        <Check size={18}/>
        {saving ? "Salvataggio…" : "Salva camminata"}
      </button>

      <div style={{ height: 80 }}/>
      <FitnessBottomNav onAdd={() => {}} onNavigate={() => {}}/>
    </div>
  );
};

/* ═══════════════════════════════════════════
   SCREEN: MAIN
   ═══════════════════════════════════════════ */
const MainScreen = ({ activities, weeklyGoal, onAdd, onDelete, onEdit, onEditGoal, onNavigate, onReport }) => {
  const [showAll, setShowAll] = useState(false);

  const weekDays = useMemo(() => getWeekDays(getMondayISO()), []);
  const chart    = useMemo(() => weekDays.map((iso, i) => ({
    day: DAY_LABELS[i],
    km:  parseFloat(activities.filter(a => a.date === iso).reduce((s, a) => s + a.distanceKm, 0).toFixed(2)),
    iso,
  })), [activities, weekDays]);

  const weekTotal = useMemo(() => chart.reduce((s, d) => s + d.km, 0), [chart]);
  const pct       = Math.min((weekTotal / weeklyGoal) * 100, 100);
  const oggi      = todayISO();

  // Kcal settimanali
  const weekKcal = useMemo(() =>
    weekDays.reduce((s, iso) => s + activities.filter(a => a.date === iso).reduce((ss, a) => ss + (a.kcal || 0), 0), 0),
    [activities, weekDays]
  );

  // Trend settimana scorsa
  const prevMonISO  = (() => { const d = new Date(getMondayISO()); d.setDate(d.getDate()-7); return toISO(d); })();
  const prevWkDays  = useMemo(() => getWeekDays(prevMonISO), [prevMonISO]);
  const prevTotal   = useMemo(() => prevWkDays.reduce((s, iso) => s + activities.filter(a => a.date === iso).reduce((ss, a) => ss + a.distanceKm, 0), 0), [activities, prevWkDays]);
  const trendDiff   = weekTotal - prevTotal;

  const displayed = showAll ? activities : activities.slice(0, 5);

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:110 }}>

      {/* HEADER */}
      <div style={{ padding:"20px 20px 10px",background:T.bg,position:"sticky",top:0,zIndex:10 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:12,color:T.textMuted,fontWeight:500 }}>Attività</div>
            <h1 style={{ fontSize:24,fontWeight:800,color:T.text,margin:0,letterSpacing:-.5 }}>Camminata</h1>
          </div>
          <button onClick={onEditGoal} style={{ background:T.card,border:"none",cursor:"pointer",padding:"8px 14px",borderRadius:12,display:"flex",alignItems:"center",gap:6,boxShadow:T.shadow }}>
            <Settings size={15} color={T.teal}/>
            <span style={{ fontSize:12,fontWeight:700,color:T.teal }}>Obiettivo: {weeklyGoal} km</span>
          </button>
        </div>
      </div>

      <div style={{ padding:"0 20px" }}>

        {/* ── CARD UNIFICATA: OBIETTIVO + GRAFICO + KCAL ── */}
        <div style={{ background:T.card,borderRadius:24,padding:"20px 18px 14px",marginBottom:14,boxShadow:T.shadowLg }}>
          <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12 }}>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontSize:11,fontWeight:600,color:T.textSec,textTransform:"uppercase",letterSpacing:".05em",marginBottom:4 }}>Questa settimana</div>
              <div style={{ fontSize:34,fontWeight:900,lineHeight:1,letterSpacing:-1,color:T.text }}>
                {weekTotal.toFixed(1)}
                <span style={{ fontSize:14,fontWeight:600,color:T.textSec,marginLeft:5 }}>/ {weeklyGoal} km</span>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:5,marginTop:7 }}>
                {trendDiff >= 0
                  ? <TrendingUp  size={12} color={GREEN}/>
                  : <TrendingDown size={12} color={T.coral}/>}
                <span style={{ fontSize:11,fontWeight:700,color:trendDiff>=0?GREEN:T.coral }}>
                  {trendDiff >= 0 ? "+" : ""}{trendDiff.toFixed(1)} km vs scorsa
                </span>
              </div>
              <div style={{ fontSize:12,color:T.textSec,marginTop:5 }}>
                {pct >= 100 ? "🎉 Obiettivo raggiunto!" : `Mancano ${(weeklyGoal - weekTotal).toFixed(1)} km`}
              </div>
            </div>
            {/* Ring + kcal sotto */}
            <div style={{ flexShrink:0,marginLeft:12,display:"flex",flexDirection:"column",alignItems:"center" }}>
              <div style={{ position:"relative" }}>
                <CircularRing pct={pct} size={90} stroke={9} color={T.teal}/>
                <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <span style={{ fontSize:18,fontWeight:900,color:T.teal }}>{Math.round(pct)}%</span>
                </div>
              </div>
              {/* Kcal badge */}
              <div style={{ display:"flex",alignItems:"center",gap:4,marginTop:6,background:`${ORANGE}12`,padding:"4px 10px",borderRadius:10 }}>
                <Flame size={11} color={ORANGE}/>
                <span style={{ fontSize:12,fontWeight:800,color:ORANGE }}>{weekKcal.toLocaleString("it-IT")}</span>
                <span style={{ fontSize:9,fontWeight:600,color:T.textMuted }}>kcal</span>
              </div>
            </div>
          </div>

          {/* Barra progresso */}
          <div style={{ background:"#F0F0F0",borderRadius:6,height:5,marginBottom:14 }}>
            <div style={{ width:`${Math.min(pct,100)}%`,height:"100%",borderRadius:6,background:T.gradient,transition:"width .5s" }}/>
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

        {/* ── SESSIONI RECENTI ── */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
          <div style={{ fontSize:13,fontWeight:700,color:T.text }}>🚶 Sessioni recenti</div>
          {activities.length > 5 && (
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

      {/* Report FAB */}
      <button onClick={onReport} style={{
        position:"fixed",bottom:86,right:20,
        background:T.gradient,border:"none",
        borderRadius:50,padding:"11px 20px",
        display:"flex",alignItems:"center",gap:8,
        boxShadow:"0 6px 24px rgba(2,128,144,0.35)",
        cursor:"pointer",zIndex:15,
      }}>
        <BarChart3 size={16} color="#fff"/>
        <span style={{ fontSize:13,fontWeight:700,color:"#fff" }}>Report</span>
      </button>

      <FitnessBottomNav onAdd={onAdd} onNavigate={onNavigate}/>
    </div>
  );
};

/* ═══════════════════════════════════════════
   SCREEN: REPORT — Dettaglio, Confronto, Streak, Storico
   ═══════════════════════════════════════════ */
const ReportScreen = ({ activities, onBack, onNavigate }) => {
  const [period,      setPeriod]      = useState("week");
  const [chartMetric, setChartMetric] = useState("km");

  // ── Helper: dati raggruppati per settimane / mesi ──
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

  const data    = period === "week" ? weekData : monthData;
  const curr    = data[data.length - 1];
  const prev    = data[data.length - 2];
  const sliced  = data.slice(-6);
  const maxVal  = Math.max(...sliced.map(d => d[chartMetric]), 1);
  const avg     = sliced.filter(d => d[chartMetric] > 0).length
    ? Math.round(sliced.reduce((s, d) => s + d[chartMetric], 0) / sliced.filter(d => d[chartMetric] > 0).length)
    : 0;

  // Streak & costanza
  const walkDates  = useMemo(() => new Set(activities.map(a => a.date)), [activities]);
  const streak     = useMemo(() => calcStreak(activities), [activities]);
  const goalDays   = 5;
  const thisSess   = curr?.sess || 0;
  const consistency = Math.round(Math.min(100, (thisSess / goalDays) * 100));
  const totalDays  = walkDates.size;

  const metricColor = chartMetric === "km" ? T.teal : ORANGE;
  const metricUnit  = chartMetric === "km" ? "km" : "kcal";

  // Confronto metriche
  const confrontoMetrics = [
    { label:"Km",       key:"km",       color:T.teal },
    { label:"Kcal",     key:"kcal",     color:ORANGE },
    { label:"Sessioni", key:"sess",     color:T.purple },
    { label:"Passo",    key:"avgPace",  color:GREEN, inv:true },
  ];

  // Storico tabelle (ultime 6)
  const visW = weekData.slice().reverse().slice(0, 6);
  const visM = monthData.slice().reverse().slice(0, 6);

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:100 }}>
      {/* Header */}
      <div style={{ position:"sticky",top:0,zIndex:10,background:T.bg,display:"flex",alignItems:"center",gap:12,padding:"16px 16px 12px" }}>
        <button onClick={onBack} style={{ width:36,height:36,borderRadius:12,background:T.tealLight,border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
          <ChevronLeft size={18} color={T.teal}/>
        </button>
        <div style={{ fontSize:20,fontWeight:800,color:T.text }}>Report Camminata</div>
      </div>

      <div style={{ padding:"0 16px" }}>

        {/* Toggle settimana/mese */}
        <div style={{ display:"flex",background:"#F3F4F6",borderRadius:12,padding:4,marginBottom:14 }}>
          {[["week","Settimanale"],["month","Mensile"]].map(([v,l]) => (
            <button key={v} onClick={() => setPeriod(v)} style={{
              flex:1,padding:"9px 0",borderRadius:9,border:"none",cursor:"pointer",
              background:period===v?T.card:"transparent",fontWeight:700,fontSize:13,
              color:period===v?T.text:T.textMuted,
              boxShadow:period===v?T.shadow:"none",transition:".2s",
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
                  color:chartMetric===v?"#fff":T.textMuted,
                  fontWeight:700,fontSize:11,transition:".15s",
                }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ textAlign:"center",marginBottom:12 }}>
            <div style={{ fontSize:12,fontWeight:700,color:T.text }}>
              {period==="week" ? "Ultime 6 settimane" : "Ultimi 6 mesi"}
            </div>
          </div>
          {/* Bar chart semplice */}
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
                      background:metricColor,borderRadius:4,opacity:0.85,
                      transition:"height 0.3s",
                    }}/>
                  </div>
                  <div style={{ fontSize:8,color:T.textMuted,fontWeight:600 }}>{d.label}</div>
                </div>
              );
            })}
          </div>
          {/* Media */}
          <div style={{ display:"flex",justifyContent:"center",padding:"8px 0 0",borderTop:`1px solid ${T.border}` }}>
            <span style={{ fontSize:16,fontWeight:800,color:metricColor }}>{avg}</span>
            <span style={{ fontSize:10,color:T.textMuted,marginLeft:4 }}>
              {metricUnit}/{period==="week"?"settimana":"mese"} media
            </span>
          </div>
        </div>

        {/* ── CONFRONTO ── */}
        {curr && prev && (
          <div style={{ background:T.card,borderRadius:18,padding:16,boxShadow:T.shadow,marginBottom:12 }}>
            <div style={{ fontSize:14,fontWeight:700,color:T.text,marginBottom:4 }}>📊 Confronto</div>
            <div style={{ fontSize:10,color:T.textMuted,marginBottom:12 }}>{curr.periodLabel} vs {prev.periodLabel}</div>
            <div style={{ display:"flex",gap:6 }}>
              {confrontoMetrics.map(m => {
                const cV = curr[m.key] || 0;
                const pV = prev[m.key] || 0;
                const diff = cV - pV;
                const pctChange = pV > 0 ? Math.round((diff / pV) * 100) : 0;
                const isUp = diff > 0;
                const arrow = isUp ? "↑" : diff < 0 ? "↓" : "=";
                const arrowColor = m.inv
                  ? (isUp ? T.coral : GREEN)
                  : (isUp ? GREEN : T.coral);
                return (
                  <div key={m.key} style={{ flex:1,background:`${m.color}0A`,borderRadius:12,padding:"10px 6px",textAlign:"center" }}>
                    <div style={{ fontSize:9,fontWeight:600,color:T.textMuted,marginBottom:4 }}>{m.label}</div>
                    <div style={{ fontSize:16,fontWeight:800,color:m.color }}>
                      {m.key === "avgPace" && cV > 0 ? cV.toFixed(1) : cV}
                    </div>
                    <div style={{ fontSize:9,color:T.textMuted,marginTop:2 }}>
                      vs {m.key === "avgPace" && pV > 0 ? pV.toFixed(1) : pV}
                    </div>
                    <div style={{ fontSize:11,fontWeight:700,color: diff === 0 ? T.textMuted : arrowColor,marginTop:4 }}>
                      {arrow}{Math.abs(pctChange)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STREAK & COSTANZA ── */}
        <div style={{ background:T.card,borderRadius:18,padding:16,boxShadow:T.shadow,marginBottom:12 }}>
          <div style={{ fontSize:14,fontWeight:700,color:T.text,marginBottom:14 }}>🔥 Streak & Costanza</div>
          <div style={{ display:"flex",gap:8 }}>
            {/* Streak */}
            <div style={{ flex:1,background:`${T.gold}0A`,borderRadius:14,padding:14,textAlign:"center" }}>
              <div style={{ fontSize:30,fontWeight:900,color:T.gold,lineHeight:1 }}>{streak}</div>
              <div style={{ fontSize:10,color:T.textMuted,fontWeight:600,marginTop:4 }}>giorni consecutivi</div>
              <div style={{ fontSize:9,color:T.textMuted,marginTop:2 }}>con camminata</div>
            </div>
            {/* Consistency ring */}
            <div style={{ flex:1,background:`${T.mint}0A`,borderRadius:14,padding:14,textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center" }}>
              <div style={{ position:"relative",width:56,height:56 }}>
                <CircularRing pct={consistency} size={56} stroke={5} color={T.mint}/>
                <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <span style={{ fontSize:14,fontWeight:800,color:T.mint }}>{consistency}%</span>
                </div>
              </div>
              <div style={{ fontSize:10,color:T.textMuted,fontWeight:600,marginTop:6 }}>{thisSess}/{goalDays} sessioni</div>
              <div style={{ fontSize:9,color:T.textMuted }}>obiettivo sett.</div>
            </div>
            {/* Total days */}
            <div style={{ flex:1,background:`${T.teal}0A`,borderRadius:14,padding:14,textAlign:"center",display:"flex",flexDirection:"column",justifyContent:"center" }}>
              <div style={{ fontSize:30,fontWeight:900,color:T.teal,lineHeight:1 }}>{totalDays}</div>
              <div style={{ fontSize:10,color:T.textMuted,fontWeight:600,marginTop:4 }}>giorni tracciati</div>
              <div style={{ fontSize:9,color:T.textMuted,marginTop:2 }}>totale</div>
            </div>
          </div>
        </div>

        {/* ── STORICO ── */}
        <div style={{ background:T.card,borderRadius:18,padding:16,boxShadow:T.shadow,marginBottom:20 }}>
          <div style={{ fontSize:14,fontWeight:700,color:T.text,marginBottom:14 }}>🕐 Storico</div>

          {/* Settimanale */}
          <div style={{ fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8 }}>Settimanale</div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
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
                {visW.map((w, i) => (
                  <tr key={i} style={{ background: i === 0 ? `${T.teal}08` : "transparent" }}>
                    <td style={{ padding:"8px 4px",borderBottom:`1px solid ${T.border}`,fontWeight:i===0?700:500,color:i===0?T.teal:T.text }}>
                      {w.periodLabel}{i === 0 && <span style={{ fontSize:8,color:T.mint,marginLeft:4 }}>attuale</span>}
                    </td>
                    <td style={{ textAlign:"right",padding:"8px 4px",borderBottom:`1px solid ${T.border}`,fontWeight:700,color:T.text }}>{w.km}</td>
                    <td style={{ textAlign:"right",padding:"8px 4px",borderBottom:`1px solid ${T.border}`,fontWeight:700,color:T.text }}>{w.kcal}</td>
                    <td style={{ textAlign:"right",padding:"8px 4px",borderBottom:`1px solid ${T.border}`,fontWeight:700,color:T.text }}>{w.sess}</td>
                    <td style={{ textAlign:"right",padding:"8px 4px",borderBottom:`1px solid ${T.border}`,fontWeight:700,color:T.text }}>{w.avgPace > 0 ? w.avgPace.toFixed(1) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mensile */}
          <div style={{ marginTop:16,fontSize:11,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8 }}>Mensile</div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
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
                {visM.map((m, i) => (
                  <tr key={i} style={{ background: i === 0 ? `${T.teal}08` : "transparent" }}>
                    <td style={{ padding:"8px 4px",borderBottom:`1px solid ${T.border}`,fontWeight:i===0?700:500,color:i===0?T.teal:T.text }}>
                      {m.periodLabel}{i === 0 && <span style={{ fontSize:8,color:T.mint,marginLeft:4 }}>attuale</span>}
                    </td>
                    <td style={{ textAlign:"right",padding:"8px 4px",borderBottom:`1px solid ${T.border}`,fontWeight:700,color:T.text }}>{m.km}</td>
                    <td style={{ textAlign:"right",padding:"8px 4px",borderBottom:`1px solid ${T.border}`,fontWeight:700,color:T.text }}>{m.kcal}</td>
                    <td style={{ textAlign:"right",padding:"8px 4px",borderBottom:`1px solid ${T.border}`,fontWeight:700,color:T.text }}>{m.sess}</td>
                    <td style={{ textAlign:"right",padding:"8px 4px",borderBottom:`1px solid ${T.border}`,fontWeight:700,color:T.text }}>{m.avgPace > 0 ? m.avgPace.toFixed(1) : "—"}</td>
                  </tr>
                ))}
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
      getWeeklyGoalKm(),
      getNutritionGoals(),
      getLastFitnessActivity(),
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

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [subScreen]);

  // Default values from last session
  const defaultInitial = useMemo(() => ({
    distanceKm:  lastSession?.distanceKm  ?? 5.0,
    durationMin: lastSession?.durationMin  ?? 50,
    heartRate:   lastSession?.heartRate    ?? 0,
    slope:       lastSession?.slope        ?? 0,
  }), [lastSession]);

  if (subScreen === "addWalk") return (
    <>
      <WalkForm
        title="Nuova camminata"
        initial={defaultInitial}
        userProfile={userProfile}
        onSave={handleSaveNew}
        onBack={() => setSubScreen("main")}
      />
      {showGoalModal && <GoalModal current={weeklyGoal} onSave={handleSaveGoal} onClose={() => setShowGoalModal(false)}/>}
    </>
  );

  if (subScreen === "editWalk") return (
    <>
      <WalkForm
        title="Modifica camminata"
        initial={editTarget}
        userProfile={userProfile}
        onSave={handleSaveEdit}
        onBack={() => { setEditTarget(null); setSubScreen("main"); }}
      />
      {showGoalModal && <GoalModal current={weeklyGoal} onSave={handleSaveGoal} onClose={() => setShowGoalModal(false)}/>}
    </>
  );

  if (subScreen === "report") return (
    <ReportScreen
      activities={activities}
      onBack={() => setSubScreen("main")}
      onNavigate={onNavigate}
    />
  );

  return (
    <>
      <MainScreen
        activities={activities}
        weeklyGoal={weeklyGoal}
        onAdd={() => setSubScreen("addWalk")}
        onDelete={handleDelete}
        onEdit={openEdit}
        onEditGoal={() => setShowGoalModal(true)}
        onNavigate={onNavigate}
        onReport={() => setSubScreen("report")}
      />
      {showGoalModal && <GoalModal current={weeklyGoal} onSave={handleSaveGoal} onClose={() => setShowGoalModal(false)}/>}
    </>
  );
}
