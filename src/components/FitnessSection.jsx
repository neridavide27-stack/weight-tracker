"use client";
// FitnessSection.jsx — Walking tracker module
// Features:
//   - Card unificata obiettivo + grafico settimanale
//   - Streak giornaliero + record personali
//   - Storico mensile a calendario
//   - Sessioni recenti (5 + "Vedi tutte"), click → modifica, swipe → elimina
//   - Form con km pre-compilato dall'ultima sessione (+/- 0.1 km)
//   - Campi opzionali: pendenza (%) e battiti cardiaci medi
//   - Calcolo kcal adattivo: HR-based (Keytel 2005) o MET + correzione pendenza
//   - Report: confronto settimane/mesi, statistiche, record
//   - Trend settimanale

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  ChevronLeft, Plus, Check, X, Settings,
  Timer, Gauge, Footprints, Home, Utensils, Dumbbell, User,
  Flame, Trophy, TrendingUp, TrendingDown, BarChart3, Zap,
  Heart, Mountain, ChevronDown, ChevronUp, Star,
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
const DAY_LABELS_SM = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];

/* ═══════════════════════════════════════════
   CALCOLO KCAL ADATTIVO
   ═══════════════════════════════════════════ */
/**
 * Calcola le kcal totali bruciate durante una camminata.
 *
 * Gerarchia:
 *  1. Se HR disponibile → formula HR-based Keytel 2005 (più precisa)
 *  2. Altrimenti → MET × peso × ore, con correzione pendenza
 *
 * @param {Object} p
 * @param {number} p.durationMin  - durata in minuti
 * @param {number} p.paceMinKm   - ritmo (min/km), usato per stimare MET dalla velocità
 * @param {number} p.weight      - peso kg (dal profilo)
 * @param {number} p.age         - età (dal profilo)
 * @param {string} p.sex         - "male" | "female" (dal profilo)
 * @param {number} [p.heartRate] - battiti medi (opzionale)
 * @param {number} [p.slope]     - pendenza % positiva (opzionale)
 */
export const calcKcal = ({ durationMin, paceMinKm, weight, age, sex, heartRate, slope }) => {
  if (!durationMin || !weight) return 0;

  // ── 1. HR-based (Keytel et al., 2005) ──
  if (heartRate && age && sex) {
    let kcalPerMin;
    if (sex === "male") {
      kcalPerMin = (-55.0969 + 0.6309 * heartRate + 0.1988 * weight + 0.2017 * age) / 4.184;
    } else {
      kcalPerMin = (-20.4022 + 0.4472 * heartRate - 0.1263 * weight + 0.074 * age) / 4.184;
    }
    return Math.max(0, Math.round(kcalPerMin * durationMin));
  }

  // ── 2. MET-based con correzione pendenza ──
  // Stima MET dalla velocità (ritmo → km/h → MET tabella ACSM)
  let met = 3.5; // camminata normale default
  if (paceMinKm) {
    const kmh = 60 / paceMinKm;
    if      (kmh < 3)  met = 2.0;
    else if (kmh < 4)  met = 2.8;
    else if (kmh < 5)  met = 3.5;
    else if (kmh < 6)  met = 4.3;
    else if (kmh < 7)  met = 5.0;
    else               met = 6.0;
  }

  // Correzione pendenza (Pandolf semplificato: +0.35 MET per ogni 1% di dislivello positivo)
  if (slope && slope > 0) {
    met += slope * 0.35;
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
      // Oggi non ancora registrato: non rompe lo streak
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

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"rgba(0,0,0,.75)", borderRadius:8, padding:"6px 10px", fontSize:11, color:"#fff", fontWeight:700 }}>
      {label}: {payload[0].value} km
    </div>
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
   SWIPE-TO-DELETE CARD
   ═══════════════════════════════════════════ */
const SwipeCard = ({ activity: a, onDelete, onClick }) => {
  const [swipeX, setSwipeX]   = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef  = useRef(null);
  const threshold = 80;

  const startDrag = (x) => { startRef.current = x; setDragging(true); };
  const moveDrag  = (x) => {
    if (!dragging || startRef.current === null) return;
    const dx = x - startRef.current;
    if (dx > 0) setSwipeX(Math.min(dx, threshold + 20));
  };
  const endDrag = () => {
    setDragging(false);
    if (swipeX >= threshold) onDelete(a.id);
    else setSwipeX(0);
    startRef.current = null;
  };

  return (
    <div style={{ position:"relative", marginBottom:10, overflow:"hidden", borderRadius:16 }}>
      {/* Delete layer */}
      <div style={{
        position:"absolute",inset:0,background:"#FEE2E2",
        display:"flex",alignItems:"center",paddingLeft:18,borderRadius:16,
        opacity: Math.min(swipeX / threshold, 1),
      }}>
        <span style={{ fontSize:22 }}>🗑️</span>
        <span style={{ marginLeft:8,fontSize:12,fontWeight:700,color:T.coral }}>
          {swipeX >= threshold ? "Rilascia!" : "Scorri →"}
        </span>
      </div>

      {/* Card */}
      <div
        onClick={() => { if (swipeX < 5) onClick(a); }}
        onTouchStart={e => startDrag(e.touches[0].clientX)}
        onTouchMove={e  => moveDrag(e.touches[0].clientX)}
        onTouchEnd={endDrag}
        onMouseDown={e  => startDrag(e.clientX)}
        onMouseMove={e  => moveDrag(e.clientX)}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        style={{
          background:T.card, borderRadius:16, padding:"14px 16px",
          boxShadow:T.shadow, display:"flex", alignItems:"center", gap:12,
          transform:`translateX(${swipeX}px)`,
          transition: dragging ? "none" : "transform 0.25s ease",
          cursor:"pointer", userSelect:"none", position:"relative",
        }}
      >
        <div style={{ width:46,height:46,borderRadius:14,background:GREEN_LIGHT,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <Footprints size={21} color={GREEN}/>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex",alignItems:"baseline",gap:5,marginBottom:4 }}>
            <span style={{ fontSize:22,fontWeight:900,color:T.text,letterSpacing:-.5 }}>{a.distanceKm.toFixed(1)}</span>
            <span style={{ fontSize:12,fontWeight:700,color:T.textMuted }}>km</span>
            <span style={{ fontSize:11,color:T.textMuted,marginLeft:"auto",whiteSpace:"nowrap" }}>{formatDateLabel(a.date)}</span>
          </div>
          <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
            <span style={{ fontSize:11,color:T.textSec,display:"flex",alignItems:"center",gap:3 }}>
              <Timer size={11} color={T.textMuted}/>{formatDuration(a.durationMin)}
            </span>
            <span style={{ fontSize:11,color:T.textSec,display:"flex",alignItems:"center",gap:3 }}>
              <Gauge size={11} color={T.textMuted}/>{formatPace(a.paceMinKm)}/km
            </span>
            {a.kcal > 0 && (
              <span style={{ fontSize:11,color:T.textSec,display:"flex",alignItems:"center",gap:3 }}>
                <Flame size={11} color={T.textMuted}/>{a.kcal} kcal
              </span>
            )}
            {a.heartRate && (
              <span style={{ fontSize:11,color:T.textSec,display:"flex",alignItems:"center",gap:3 }}>
                <Heart size={11} color={T.coral}/>{a.heartRate} bpm
              </span>
            )}
            {a.slope > 0 && (
              <span style={{ fontSize:11,color:T.textSec,display:"flex",alignItems:"center",gap:3 }}>
                <Mountain size={11} color={T.purple}/>{a.slope}%
              </span>
            )}
          </div>
        </div>
        {/* Hint modifica */}
        <div style={{ fontSize:10,color:T.textMuted,flexShrink:0 }}>✏️</div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   CALENDARIO MENSILE
   ═══════════════════════════════════════════ */
const MonthCalendar = ({ activities, year, month }) => {
  const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDate   = new Date().getDate();
  const todayYear   = new Date().getFullYear();
  const todayMonth  = new Date().getMonth();

  const actMap = useMemo(() => {
    const m = {};
    activities
      .filter(a => { const d = new Date(a.date); return d.getFullYear() === year && d.getMonth() === month; })
      .forEach(a => { m[a.date] = (m[a.date] || 0) + a.distanceKm; });
    return m;
  }, [activities, year, month]);

  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4 }}>
        {DAY_LABELS.map((d, i) => (
          <div key={i} style={{ textAlign:"center",fontSize:9,fontWeight:700,color:T.textMuted,padding:"2px 0" }}>{d}</div>
        ))}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i}/>;
          const iso = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const km  = actMap[iso] || 0;
          const isToday = day === todayDate && year === todayYear && month === todayMonth;
          const hasAct  = km > 0;
          return (
            <div key={i} title={hasAct ? `${km.toFixed(1)} km` : ""} style={{
              aspectRatio:"1",display:"flex",flexDirection:"column",
              alignItems:"center",justifyContent:"center",borderRadius:7,
              background: isToday ? T.teal : hasAct ? GREEN_LIGHT : "transparent",
              border: isToday ? "none" : hasAct ? "1px solid #BBF7D0" : `1px solid ${T.border}`,
              cursor: hasAct ? "default" : "default",
            }}>
              <span style={{ fontSize:10,fontWeight:700,color:isToday?"#fff":hasAct?GREEN:T.textMuted,lineHeight:1 }}>{day}</span>
              {hasAct && !isToday && <div style={{ width:4,height:4,borderRadius:2,background:GREEN,marginTop:2 }}/>}
              {hasAct && isToday  && <div style={{ width:4,height:4,borderRadius:2,background:"rgba(255,255,255,.8)",marginTop:2 }}/>}
            </div>
          );
        })}
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
   FORM CAMMINATA (usato sia per Add che Edit)
   ═══════════════════════════════════════════ */
const WalkForm = ({ initial, userProfile, onSave, onBack, title }) => {
  const [date,      setDate]      = useState(initial?.date      ?? todayISO());
  const [km,        setKm]        = useState(initial?.distanceKm ?? 5.0);
  const [hours,     setHours]     = useState(initial ? Math.floor(initial.durationMin / 60) : 0);
  const [minutes,   setMinutes]   = useState(initial ? initial.durationMin % 60 : 0);
  const [heartRate, setHeartRate] = useState(initial?.heartRate ?? "");
  const [slope,     setSlope]     = useState(initial?.slope     ?? "");
  const [kcalOver,  setKcalOver]  = useState(null);   // null = auto-calcolato
  const [showExtra, setShowExtra] = useState(!!(initial?.heartRate || initial?.slope));
  const [saving,    setSaving]    = useState(false);

  const totalMin = hours * 60 + minutes;
  const kmNum    = parseFloat(parseFloat(km).toFixed(1)) || 0;
  const valid    = kmNum > 0 && totalMin > 0;
  const pace     = valid ? totalMin / kmNum : null;

  // Kcal auto-calcolate (o override manuale)
  const kcalAuto = useMemo(() => calcKcal({
    durationMin: totalMin,
    paceMinKm:   pace,
    weight:      userProfile?.weight   || 75,
    age:         userProfile?.age      || 35,
    sex:         userProfile?.sex      || "male",
    heartRate:   heartRate ? parseFloat(heartRate) : null,
    slope:       slope     ? parseFloat(slope)     : null,
  }), [totalMin, pace, userProfile, heartRate, slope]);

  const kcalDisplay = kcalOver !== null ? kcalOver : kcalAuto;
  const formulaHint = heartRate
    ? "Basato su battiti cardiaci (Keytel 2005)"
    : slope > 0
      ? "MET camminata + correzione pendenza"
      : "MET standard camminata";

  const adjustKm = (delta) => {
    setKm(prev => Math.max(0.1, parseFloat((parseFloat(prev) + delta).toFixed(1))));
  };

  const DurationStepper = ({ value, onChange, max, label }) => (
    <div style={{ flex:1,textAlign:"center" }}>
      <div style={{ fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:8 }}>{label}</div>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
        <button onClick={() => onChange(Math.max(0, value-1))} style={{ width:34,height:34,borderRadius:10,border:"1.5px solid #E5E7EB",background:T.card,cursor:"pointer",fontSize:20,fontWeight:700,color:T.text,display:"flex",alignItems:"center",justifyContent:"center" }}>−</button>
        <span style={{ fontSize:28,fontWeight:900,color:T.text,minWidth:40,textAlign:"center" }}>{String(value).padStart(2,"0")}</span>
        <button onClick={() => onChange(Math.min(max, value+1))} style={{ width:34,height:34,borderRadius:10,border:"1.5px solid #E5E7EB",background:T.card,cursor:"pointer",fontSize:20,fontWeight:700,color:T.text,display:"flex",alignItems:"center",justifyContent:"center" }}>+</button>
      </div>
    </div>
  );

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const activity = {
      date,
      distanceKm:  kmNum,
      durationMin: totalMin,
      paceMinKm:   parseFloat((pace || 0).toFixed(2)),
      kcal:        kcalDisplay,
      heartRate:   heartRate ? parseInt(heartRate) : null,
      slope:       slope     ? parseFloat(slope)   : null,
    };
    await onSave(activity);
    setSaving(false);
  };

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif" }}>
      {/* HEADER */}
      <div style={{ padding:"20px 20px 10px",background:T.bg,position:"sticky",top:0,zIndex:10 }}>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <button onClick={onBack} style={{ background:T.card,border:"none",cursor:"pointer",padding:8,borderRadius:10,display:"flex",alignItems:"center",boxShadow:T.shadow }}>
            <ChevronLeft size={20} color={T.teal}/>
          </button>
          <div>
            <div style={{ fontSize:12,color:T.textMuted,fontWeight:500 }}>Fitness</div>
            <h1 style={{ fontSize:24,fontWeight:800,color:T.text,margin:0,letterSpacing:-.5 }}>{title}</h1>
          </div>
        </div>
      </div>

      <div style={{ padding:"12px 20px 120px" }}>
        <div style={{ background:T.card,borderRadius:24,padding:"24px 20px",boxShadow:T.shadowLg,marginBottom:16 }}>
          <div style={{ width:64,height:64,borderRadius:20,background:GREEN_LIGHT,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 22px" }}>
            <Footprints size={30} color={GREEN}/>
          </div>

          {/* DATA */}
          <div style={{ marginBottom:20,textAlign:"center" }}>
            <div style={{ fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:6 }}>DATA</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ fontSize:15,fontWeight:700,color:T.text,textAlign:"center",border:"1.5px solid #E5E7EB",borderRadius:10,padding:"8px 16px",background:"#F9FAFB",outline:"none",fontFamily:"inherit" }}/>
          </div>

          {/* KM — stepper con +/- da 0.1 e input diretto */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:10,textAlign:"center" }}>DISTANZA</div>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:12 }}>
              <button onClick={() => adjustKm(-0.1)} style={{ width:40,height:40,borderRadius:13,border:"1.5px solid #E5E7EB",background:T.bg,cursor:"pointer",fontSize:22,fontWeight:700,color:T.text,display:"flex",alignItems:"center",justifyContent:"center" }}>−</button>
              <div style={{ display:"flex",alignItems:"baseline",gap:4 }}>
                <input
                  type="number" inputMode="decimal"
                  value={km}
                  onChange={e => setKm(e.target.value)}
                  style={{ fontSize:46,fontWeight:900,color:T.text,textAlign:"center",border:"none",background:"transparent",outline:"none",width:110,fontFamily:"inherit",letterSpacing:-2 }}
                />
                <span style={{ fontSize:17,fontWeight:700,color:T.textMuted }}>km</span>
              </div>
              <button onClick={() => adjustKm(+0.1)} style={{ width:40,height:40,borderRadius:13,border:"1.5px solid #E5E7EB",background:T.bg,cursor:"pointer",fontSize:22,fontWeight:700,color:T.text,display:"flex",alignItems:"center",justifyContent:"center" }}>+</button>
            </div>
          </div>

          {/* DURATA */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:12,textAlign:"center" }}>DURATA</div>
            <div style={{ display:"flex",alignItems:"center",gap:4 }}>
              <DurationStepper value={hours}   onChange={setHours}   max={23} label="Ore"/>
              <span style={{ fontSize:30,fontWeight:800,color:T.textMuted,paddingBottom:8 }}>:</span>
              <DurationStepper value={minutes} onChange={setMinutes} max={59} label="Minuti"/>
            </div>
          </div>

          {/* RITMO CALCOLATO */}
          {valid && (
            <div style={{ background:`${T.teal}08`,border:`1px solid ${T.tealLight}`,borderRadius:12,padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:16 }}>
              <Gauge size={15} color={T.teal}/>
              <span style={{ fontSize:13,fontWeight:600,color:T.teal }}>
                Ritmo medio: <strong>{formatPace(pace)}/km</strong>
              </span>
            </div>
          )}

          {/* KCAL */}
          <div style={{ background:`${T.gold}10`,border:`1px solid ${T.gold}30`,borderRadius:12,padding:"12px 16px",marginBottom:16 }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6 }}>
              <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                <Flame size={15} color={T.gold}/>
                <span style={{ fontSize:13,fontWeight:700,color:T.text }}>Calorie bruciate</span>
              </div>
              <button onClick={() => setKcalOver(kcalOver !== null ? null : kcalAuto)}
                style={{ fontSize:10,fontWeight:700,color:T.teal,background:"none",border:"none",cursor:"pointer" }}>
                {kcalOver !== null ? "← Auto" : "Modifica"}
              </button>
            </div>
            {kcalOver !== null ? (
              <input type="number" value={kcalOver} onChange={e => setKcalOver(parseInt(e.target.value)||0)}
                style={{ fontSize:28,fontWeight:900,color:T.text,border:"none",background:"transparent",outline:"none",fontFamily:"inherit",width:"100%" }}/>
            ) : (
              <div style={{ fontSize:28,fontWeight:900,color:T.text }}>{kcalDisplay} <span style={{ fontSize:13,color:T.textMuted,fontWeight:600 }}>kcal</span></div>
            )}
            <div style={{ fontSize:10,color:T.textMuted,fontWeight:600,marginTop:4 }}>{formulaHint}</div>
          </div>

          {/* CAMPI OPZIONALI: toggle */}
          <button onClick={() => setShowExtra(v => !v)} style={{ width:"100%",background:`${T.purple}08`,border:`1px solid ${T.purple}20`,borderRadius:12,padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"between",cursor:"pointer",gap:8 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,flex:1 }}>
              <Star size={14} color={T.purple}/>
              <span style={{ fontSize:12,fontWeight:700,color:T.purple }}>Dati aggiuntivi (facoltativo)</span>
            </div>
            {showExtra ? <ChevronUp size={16} color={T.purple}/> : <ChevronDown size={16} color={T.purple}/>}
          </button>

          {showExtra && (
            <div style={{ marginTop:12,display:"flex",gap:12 }}>
              {/* Battiti */}
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:6,display:"flex",alignItems:"center",gap:4 }}>
                  <Heart size={11} color={T.coral}/> Battiti medi
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                  <input type="number" inputMode="numeric" value={heartRate}
                    onChange={e => setHeartRate(e.target.value)}
                    placeholder="—" min={40} max={220}
                    style={{ flex:1,fontSize:18,fontWeight:800,color:T.text,textAlign:"center",border:"1.5px solid #E5E7EB",borderRadius:10,padding:"8px",background:"#F9FAFB",outline:"none",fontFamily:"inherit" }}/>
                  <span style={{ fontSize:12,fontWeight:700,color:T.textMuted }}>bpm</span>
                </div>
              </div>
              {/* Pendenza */}
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:6,display:"flex",alignItems:"center",gap:4 }}>
                  <Mountain size={11} color={T.purple}/> Pendenza media
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                  <input type="number" inputMode="decimal" value={slope}
                    onChange={e => setSlope(e.target.value)}
                    placeholder="0" min={-30} max={60}
                    style={{ flex:1,fontSize:18,fontWeight:800,color:T.text,textAlign:"center",border:"1.5px solid #E5E7EB",borderRadius:10,padding:"8px",background:"#F9FAFB",outline:"none",fontFamily:"inherit" }}/>
                  <span style={{ fontSize:12,fontWeight:700,color:T.textMuted }}>%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTONE SALVA */}
        <button onClick={handleSave} disabled={!valid || saving} style={{
          width:"100%",padding:17,borderRadius:16,border:"none",
          background: valid ? GG : "#E5E7EB",
          color: valid ? "#fff" : T.textMuted,
          fontSize:16,fontWeight:800,
          cursor: valid && !saving ? "pointer" : "not-allowed",
          boxShadow: valid ? "0 6px 24px rgba(22,163,74,0.28)" : "none",
          display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          transition:"background 0.2s, box-shadow 0.2s",
        }}>
          <Check size={20}/>
          {saving ? "Salvataggio…" : "Salva camminata"}
        </button>
      </div>

      <FitnessBottomNav onAdd={() => {}} onNavigate={() => {}}/>
    </div>
  );
};

/* ═══════════════════════════════════════════
   SCREEN: MAIN
   ═══════════════════════════════════════════ */
const MainScreen = ({ activities, weeklyGoal, onAdd, onDelete, onEdit, onEditGoal, onNavigate, onReport }) => {
  const [showAll,   setShowAll]   = useState(false);
  const [calYear,   setCalYear]   = useState(new Date().getFullYear());
  const [calMonth,  setCalMonth]  = useState(new Date().getMonth());

  const weekDays = useMemo(() => getWeekDays(getMondayISO()), []);
  const chart    = useMemo(() => weekDays.map((iso, i) => ({
    day: DAY_LABELS[i],
    km:  parseFloat(activities.filter(a => a.date === iso).reduce((s, a) => s + a.distanceKm, 0).toFixed(2)),
    iso,
  })), [activities, weekDays]);

  const weekTotal = useMemo(() => chart.reduce((s, d) => s + d.km, 0), [chart]);
  const pct       = Math.min((weekTotal / weeklyGoal) * 100, 100);
  const oggi      = todayISO();

  // Trend settimana scorsa
  const prevMonISO  = (() => { const d = new Date(getMondayISO()); d.setDate(d.getDate()-7); return toISO(d); })();
  const prevWkDays  = useMemo(() => getWeekDays(prevMonISO), [prevMonISO]);
  const prevTotal   = useMemo(() => prevWkDays.reduce((s, iso) => s + activities.filter(a => a.date === iso).reduce((ss, a) => ss + a.distanceKm, 0), 0), [activities, prevWkDays]);
  const trendDiff   = weekTotal - prevTotal;

  const streak = useMemo(() => calcStreak(activities), [activities]);
  const pr     = useMemo(() => calcPR(activities),     [activities]);

  const displayed = showAll ? activities : activities.slice(0, 5);

  const prevMonth = () => { if (calMonth === 0) { setCalYear(y => y-1); setCalMonth(11); } else setCalMonth(m => m-1); };
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y => y+1); setCalMonth(0); } else setCalMonth(m => m+1); };

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

        {/* ── CARD UNIFICATA: OBIETTIVO + GRAFICO ── */}
        <div style={{ background:GG,borderRadius:24,padding:"20px 18px 16px",marginBottom:14,boxShadow:"0 8px 32px rgba(22,163,74,0.22)",color:"#fff" }}>
          {/* Riga superiore: numeri + anello */}
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontSize:11,fontWeight:600,opacity:.85,marginBottom:4 }}>Questa settimana</div>
              <div style={{ fontSize:40,fontWeight:900,lineHeight:1,letterSpacing:-1.5 }}>
                {weekTotal.toFixed(1)}
                <span style={{ fontSize:16,fontWeight:700,opacity:.75,marginLeft:4 }}>/ {weeklyGoal} km</span>
              </div>
              {/* Trend */}
              <div style={{ display:"flex",alignItems:"center",gap:5,marginTop:8 }}>
                {trendDiff >= 0
                  ? <TrendingUp  size={13} color="rgba(255,255,255,0.9)"/>
                  : <TrendingDown size={13} color="rgba(255,255,255,0.9)"/>}
                <span style={{ fontSize:11,fontWeight:700,opacity:.9 }}>
                  {trendDiff >= 0 ? "+" : ""}{trendDiff.toFixed(1)} km vs settimana scorsa
                </span>
              </div>
              <div style={{ fontSize:12,fontWeight:600,opacity:.88,marginTop:6 }}>
                {pct >= 100 ? "🎉 Obiettivo raggiunto!" : `Mancano ${(weeklyGoal - weekTotal).toFixed(1)} km`}
              </div>
            </div>
            <div style={{ position:"relative",flexShrink:0,marginLeft:10 }}>
              <CircularRing pct={pct} size={104} stroke={11} color="#fff"/>
              <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
                <span style={{ fontSize:21,fontWeight:900 }}>{Math.round(pct)}%</span>
              </div>
            </div>
          </div>

          {/* Grafico integrato */}
          <div style={{ background:"rgba(255,255,255,0.13)",borderRadius:14,padding:"10px 6px 4px" }}>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={chart} barSize={18} margin={{ top:0,right:0,left:-28,bottom:0 }}>
                <XAxis dataKey="day" tick={{ fontSize:10,fill:"rgba(255,255,255,.8)",fontWeight:700 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:9,fill:"rgba(255,255,255,.45)" }} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{ background:"rgba(0,0,0,.7)",border:"none",borderRadius:8,fontSize:11,color:"#fff" }} cursor={{ fill:"rgba(255,255,255,.1)" }} formatter={v => [`${v} km`]}/>
                <Bar dataKey="km" radius={[5,5,0,0]}>
                  {chart.map((d,i) => (
                    <Cell key={i} fill={d.iso===oggi?"#fff":d.km>0?"rgba(255,255,255,.65)":"rgba(255,255,255,.18)"}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── STREAK + PR ── */}
        <div style={{ display:"flex",gap:10,marginBottom:14 }}>
          <div style={{ flex:1,background:T.card,borderRadius:18,padding:"14px 16px",boxShadow:T.shadow,display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:42,height:42,borderRadius:13,background:streak>0?"#FEF3C7":"#F3F4F6",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <Flame size={22} color={streak>0?T.gold:"#D1D5DB"}/>
            </div>
            <div>
              <div style={{ fontSize:24,fontWeight:900,color:T.text,lineHeight:1 }}>{streak}</div>
              <div style={{ fontSize:10,fontWeight:700,color:T.textMuted,marginTop:2 }}>
                {streak===0?"inizia oggi!":streak===1?"giorno di fila":"giorni di fila"}
              </div>
            </div>
          </div>
          <div style={{ flex:1,background:T.card,borderRadius:18,padding:"14px 16px",boxShadow:T.shadow,display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:42,height:42,borderRadius:13,background:"#EDE9FE",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <Trophy size={22} color={T.purple}/>
            </div>
            <div>
              <div style={{ fontSize:24,fontWeight:900,color:T.text,lineHeight:1 }}>
                {pr.maxDist > 0 ? pr.maxDist.toFixed(1) : "—"}
              </div>
              <div style={{ fontSize:10,fontWeight:700,color:T.textMuted,marginTop:2 }}>km record</div>
            </div>
          </div>
        </div>

        {/* ── CALENDARIO MENSILE ── */}
        <div style={{ background:T.card,borderRadius:18,padding:"16px 16px 14px",boxShadow:T.shadow,marginBottom:14 }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
            <div style={{ fontSize:13,fontWeight:700,color:T.text }}>
              {MONTH_LABELS[calMonth]} {calYear}
            </div>
            <div style={{ display:"flex",gap:4 }}>
              <button onClick={prevMonth} style={{ background:"none",border:"none",cursor:"pointer",padding:"2px 8px",fontSize:18,color:T.textMuted }}>‹</button>
              <button onClick={nextMonth} style={{ background:"none",border:"none",cursor:"pointer",padding:"2px 8px",fontSize:18,color:T.textMuted }}>›</button>
            </div>
          </div>
          <MonthCalendar activities={activities} year={calYear} month={calMonth}/>
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
          displayed.map(a => (
            <SwipeCard key={a.id} activity={a} onDelete={onDelete} onClick={onEdit}/>
          ))
        )}
      </div>

      {/* Report button (floating, sopra nav) */}
      <button onClick={onReport} style={{
        position:"fixed",bottom:88,right:20,
        background:T.card,border:`1.5px solid ${T.tealLight}`,
        borderRadius:14,padding:"9px 16px",
        display:"flex",alignItems:"center",gap:7,
        boxShadow:T.shadowLg,cursor:"pointer",zIndex:15,
      }}>
        <BarChart3 size={16} color={T.teal}/>
        <span style={{ fontSize:12,fontWeight:700,color:T.teal }}>Report</span>
      </button>

      <FitnessBottomNav onAdd={onAdd} onNavigate={onNavigate}/>
    </div>
  );
};

/* ═══════════════════════════════════════════
   SCREEN: REPORT
   ═══════════════════════════════════════════ */
const ReportScreen = ({ activities, onBack, onNavigate }) => {
  const [period, setPeriod] = useState("week");

  const chart = useMemo(() => {
    if (period === "week") {
      return Array.from({ length: 8 }, (_, i) => {
        const d = new Date(getMondayISO()); d.setDate(d.getDate() - i*7);
        const days = getWeekDays(toISO(d));
        const km   = days.reduce((s, iso) => s + activities.filter(a => a.date === iso).reduce((ss, a) => ss + a.distanceKm, 0), 0);
        return { label: i === 0 ? "Questa" : `-${i}w`, km: parseFloat(km.toFixed(1)) };
      }).reverse();
    }
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const y = d.getFullYear(), m = d.getMonth();
      const km = activities
        .filter(a => { const dd = new Date(a.date); return dd.getFullYear()===y && dd.getMonth()===m; })
        .reduce((s, a) => s + a.distanceKm, 0);
      return { label: MONTH_LABELS[m].slice(0,3), km: parseFloat(km.toFixed(1)) };
    }).reverse();
  }, [activities, period]);

  const pr          = useMemo(() => calcPR(activities), [activities]);
  const totalKm     = pr.totalKm.toFixed(1);
  const totalKcal   = activities.reduce((s, a) => s + (a.kcal || 0), 0);
  const avgDist     = activities.length ? (pr.totalKm / activities.length).toFixed(1) : 0;
  const streak      = useMemo(() => calcStreak(activities), [activities]);

  // Confronto periodo corrente vs precedente
  const mondayISO   = getMondayISO();
  const prevMon     = (() => { const d = new Date(mondayISO); d.setDate(d.getDate()-7); return toISO(d); })();
  const thisWkDays  = getWeekDays(mondayISO);
  const prevWkDays  = getWeekDays(prevMon);
  const thisWkKm    = thisWkDays.reduce((s, iso) => s + activities.filter(a => a.date === iso).reduce((ss,a) => ss+a.distanceKm, 0), 0);
  const prevWkKm    = prevWkDays.reduce((s, iso) => s + activities.filter(a => a.date === iso).reduce((ss,a) => ss+a.distanceKm, 0), 0);
  const diff        = thisWkKm - prevWkKm;

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:100 }}>
      <div style={{ padding:"20px 20px 10px",background:T.bg,position:"sticky",top:0,zIndex:10 }}>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <button onClick={onBack} style={{ background:T.card,border:"none",cursor:"pointer",padding:8,borderRadius:10,display:"flex",alignItems:"center",boxShadow:T.shadow }}>
            <ChevronLeft size={20} color={T.teal}/>
          </button>
          <div>
            <div style={{ fontSize:12,color:T.textMuted,fontWeight:500 }}>Fitness</div>
            <h1 style={{ fontSize:24,fontWeight:800,color:T.text,margin:0,letterSpacing:-.5 }}>Report</h1>
          </div>
        </div>
      </div>

      <div style={{ padding:"0 20px" }}>
        {/* Toggle */}
        <div style={{ display:"flex",background:"#F3F4F6",borderRadius:12,padding:4,marginBottom:14 }}>
          {[["week","Settimanale"],["month","Mensile"]].map(([v,l]) => (
            <button key={v} onClick={() => setPeriod(v)} style={{ flex:1,padding:"9px 0",borderRadius:9,border:"none",cursor:"pointer",background:period===v?T.card:"transparent",fontWeight:700,fontSize:13,color:period===v?T.text:T.textMuted,boxShadow:period===v?T.shadow:"none",transition:".2s" }}>{l}</button>
          ))}
        </div>

        {/* Card confronto */}
        <div style={{ background:GG,borderRadius:20,padding:"18px 20px",marginBottom:14,color:"#fff" }}>
          <div style={{ fontSize:11,fontWeight:600,opacity:.85,marginBottom:8 }}>
            {period==="week" ? "Questa settimana vs scorsa" : "Questo mese vs scorso"}
          </div>
          <div style={{ fontSize:36,fontWeight:900,letterSpacing:-1 }}>
            {thisWkKm.toFixed(1)} <span style={{ fontSize:14,opacity:.7 }}>km</span>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:6,marginTop:6 }}>
            {diff >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
            <span style={{ fontSize:12,fontWeight:700 }}>
              {diff >= 0 ? "+" : ""}{diff.toFixed(1)} km ({prevWkKm.toFixed(1)} km prec.)
            </span>
          </div>
        </div>

        {/* Grafico storico */}
        <div style={{ background:T.card,borderRadius:18,padding:"16px 14px 10px",boxShadow:T.shadow,marginBottom:14 }}>
          <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:12 }}>
            {period==="week" ? "Ultime 8 settimane" : "Ultimi 6 mesi"}
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={chart} barSize={22} margin={{ top:0,right:0,left:-22,bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={T.border}/>
              <XAxis dataKey="label" tick={{ fontSize:10,fill:T.textMuted,fontWeight:600 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:9,fill:T.textMuted }} axisLine={false} tickLine={false}/>
              <Tooltip content={<ChartTooltip/>} cursor={{ fill:`${T.teal}10` }}/>
              <Bar dataKey="km" radius={[6,6,0,0]}>
                {chart.map((d,i) => <Cell key={i} fill={i===chart.length-1?T.teal:GREEN}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stats */}
        <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:10 }}>📈 Statistiche totali</div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
          {[
            { Icon:Footprints, color:GREEN,   label:"Km totali",     val:`${totalKm} km`          },
            { Icon:Zap,        color:T.gold,  label:"Sessioni",      val:activities.length         },
            { Icon:BarChart3,  color:T.teal,  label:"Media/sessione",val:`${avgDist} km`           },
            { Icon:Flame,      color:ORANGE,  label:"Kcal bruciate", val:totalKcal.toLocaleString("it-IT") },
            { Icon:Flame,      color:T.gold,  label:"Streak attuale",val:`${streak} gg`            },
            { Icon:Trophy,     color:T.purple,label:"Record km",     val:`${pr.maxDist.toFixed(1)} km` },
          ].map(({ Icon, color, label, val }) => (
            <div key={label} style={{ background:T.card,borderRadius:16,padding:"14px 16px",boxShadow:T.shadow }}>
              <div style={{ width:34,height:34,borderRadius:10,background:`${color}15`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:8 }}>
                <Icon size={17} color={color}/>
              </div>
              <div style={{ fontSize:20,fontWeight:900,color:T.text,letterSpacing:-.5 }}>{val}</div>
              <div style={{ fontSize:11,color:T.textMuted,fontWeight:600,marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Record personali */}
        <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:10 }}>🏆 Record personali</div>
        <div style={{ background:T.card,borderRadius:18,padding:"4px 0",boxShadow:T.shadow }}>
          {[
            { Icon:Trophy, color:T.gold,   label:"Distanza massima", val:`${pr.maxDist.toFixed(1)} km` },
            { Icon:Gauge,  color:T.purple, label:"Ritmo migliore",   val:pr.bestPace < Infinity ? `${formatPace(pr.bestPace)}/km` : "—" },
            { Icon:Flame,  color:ORANGE,   label:"Kcal max/sessione",val:`${pr.maxKcal} kcal` },
            { Icon:Footprints,color:GREEN, label:"Km totali percorsi",val:`${parseFloat(totalKm).toFixed(0)} km` },
          ].map(({ Icon, color, label, val }, i, arr) => (
            <div key={label} style={{ display:"flex",alignItems:"center",gap:12,padding:"13px 16px",borderBottom:i<arr.length-1?`1px solid ${T.border}`:"none" }}>
              <div style={{ width:36,height:36,borderRadius:11,background:`${color}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <Icon size={17} color={color}/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12,color:T.textMuted,fontWeight:600 }}>{label}</div>
              </div>
              <div style={{ fontSize:15,fontWeight:800,color:T.text }}>{val}</div>
            </div>
          ))}
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
  const [subScreen,     setSubScreen]     = useState("main");   // main | addWalk | editWalk | report
  const [activities,    setActivities]    = useState([]);
  const [weeklyGoal,    setWeeklyGoal]    = useState(20);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editTarget,    setEditTarget]    = useState(null);     // activity da modificare
  const [lastDistance,  setLastDistance]  = useState(5.0);
  const [userProfile,   setUserProfile]   = useState(null);

  const loadData = useCallback(async () => {
    const [goal, profile, last] = await Promise.all([
      getWeeklyGoalKm(),
      getNutritionGoals(),
      getLastFitnessActivity(),
    ]);
    if (goal)    setWeeklyGoal(goal);
    if (profile) setUserProfile(profile);
    if (last)    setLastDistance(last.distanceKm);

    const end   = todayISO();
    const start = toISO(new Date(Date.now() - 120 * 86400000));   // ultimi 120 giorni
    const acts  = await getFitnessActivitiesByDateRange(start, end);
    setActivities(acts.sort((a, b) => b.date.localeCompare(a.date)));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Record personali: controlla se l'ultima sessione salvata è un nuovo record
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
    if (pr) setTimeout(() => alert(pr), 400);  // semplice alert — in produzione usa un toast
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

  // ── RENDER ──
  if (subScreen === "addWalk") return (
    <>
      <WalkForm
        title="Nuova camminata"
        initial={{ distanceKm: lastDistance }}
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
