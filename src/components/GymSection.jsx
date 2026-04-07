"use client";
// GymSection.jsx — Gym workout tracker (Hevy-style)
// v3 — Routine creation flow, exercise database with uni field, reordering, superset linking, notes, timers

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import {
  ChevronLeft, Plus, Check, X, Settings, Timer, Home, Utensils, Dumbbell,
  User, Flame, TrendingUp, Search, Play, Square, RotateCcw, Trash2,
  Edit3, Copy, ChevronRight, ChevronDown, Clock, Award, Trophy,
  BarChart3, Target, Zap, Minus, MoreVertical, Pause, Footprints,
  AlertTriangle, CheckCircle2, Bookmark, FolderOpen,
  ChevronUp, Link2, ArrowLeftRight, FileText, GripVertical,
} from "lucide-react";
import {
  addGymWorkout, updateGymWorkout, deleteGymWorkout, getAllGymWorkouts,
  getGymSetsByWorkout, addGymSets, getGymSetsByExercise,
  getAllGymRoutines, addGymRoutine, updateGymRoutine, deleteGymRoutine,
  getAllGymCustomExercises, addGymCustomExercise,
  getGymRestTimer, saveGymRestTimer,
} from "../lib/food-db";

/* ═══════════════════════════════════════════
   THEME & UTILS
   ═══════════════════════════════════════════ */
const T = {
  bg: "#F4F5F7", card: "#FFFFFF", text: "#1A1A2E", textSec: "#6B7280",
  textMuted: "#9CA3AF", border: "#E5E7EB", teal: "#028090",
  tealLight: "#E6F4F1", gradient: "linear-gradient(135deg, #028090, #05B2C6)",
  shadow: "0 2px 12px rgba(0,0,0,0.06)", purple: "#7C5CFC",
  purpleLight: "#F0EDFF", gold: "#D4A017", green: "#16A34A",
  orange: "#F97316", red: "#EF4444",
};

const GREEN = "#16A34A";
const toISO = d => new Date(d).toISOString().split("T")[0];
const todayISO = () => toISO(new Date());
const formatDate = d => new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
const formatDateFull = d => new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "long" });
const formatDuration = (mins) => {
  if (!mins) return "0min";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};
const formatTimer = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

/* ═══════════════════════════════════════════
   EXERCISE DATABASE (~54 exercises with uni field)
   ═══════════════════════════════════════════ */
const MUSCLE_GROUPS = ["Petto", "Schiena", "Spalle", "Bicipiti", "Tricipiti", "Gambe", "Core"];
const EQUIPMENT = ["Bilanciere", "Manubri", "Macchina", "Cavi", "Corpo libero"];

const EXERCISES = [
  // Petto
  { id: "bench_press",       name: "Panca Piana",          muscle: "Petto",    secondary: "Tricipiti",  equipment: "Bilanciere", uni: false },
  { id: "incline_bench",     name: "Panca Inclinata",      muscle: "Petto",    secondary: "Spalle",     equipment: "Bilanciere", uni: false },
  { id: "decline_bench",     name: "Panca Declinata",      muscle: "Petto",    secondary: "Tricipiti",  equipment: "Bilanciere", uni: false },
  { id: "db_bench",          name: "Panca Manubri",        muscle: "Petto",    secondary: "Tricipiti",  equipment: "Manubri", uni: false },
  { id: "db_incline",        name: "Inclinata Manubri",    muscle: "Petto",    secondary: "Spalle",     equipment: "Manubri", uni: false },
  { id: "chest_fly",         name: "Croci Manubri",        muscle: "Petto",    secondary: "",           equipment: "Manubri", uni: false },
  { id: "cable_fly",         name: "Croci ai Cavi",        muscle: "Petto",    secondary: "",           equipment: "Cavi", uni: false },
  { id: "chest_press",       name: "Chest Press",          muscle: "Petto",    secondary: "Tricipiti",  equipment: "Macchina", uni: false },
  { id: "pec_deck",          name: "Pec Deck",             muscle: "Petto",    secondary: "",           equipment: "Macchina", uni: false },
  // Schiena
  { id: "deadlift",          name: "Stacco da Terra",      muscle: "Schiena",  secondary: "Gambe",      equipment: "Bilanciere", uni: false },
  { id: "barbell_row",       name: "Rematore Bilanciere",  muscle: "Schiena",  secondary: "Bicipiti",   equipment: "Bilanciere", uni: false },
  { id: "db_row",            name: "Rematore Manubrio",    muscle: "Schiena",  secondary: "Bicipiti",   equipment: "Manubri", uni: true },
  { id: "lat_pulldown",      name: "Lat Machine",          muscle: "Schiena",  secondary: "Bicipiti",   equipment: "Macchina", uni: false },
  { id: "seated_row",        name: "Pulley Basso",         muscle: "Schiena",  secondary: "Bicipiti",   equipment: "Cavi", uni: false },
  { id: "cable_row",         name: "Rematore ai Cavi",     muscle: "Schiena",  secondary: "Bicipiti",   equipment: "Cavi", uni: false },
  { id: "tbar_row",          name: "T-Bar Row",            muscle: "Schiena",  secondary: "Bicipiti",   equipment: "Bilanciere", uni: false },
  { id: "pullup",            name: "Trazioni",             muscle: "Schiena",  secondary: "Bicipiti",   equipment: "Corpo libero", uni: false },
  { id: "hyperextension",    name: "Hyperextension",       muscle: "Schiena",  secondary: "Gambe",      equipment: "Corpo libero", uni: false },
  // Spalle
  { id: "ohp",               name: "Military Press",       muscle: "Spalle",   secondary: "Tricipiti",  equipment: "Bilanciere", uni: false },
  { id: "db_shoulder_press", name: "Lento Manubri",        muscle: "Spalle",   secondary: "Tricipiti",  equipment: "Manubri", uni: false },
  { id: "lateral_raise",     name: "Alzate Laterali",      muscle: "Spalle",   secondary: "",           equipment: "Manubri", uni: false },
  { id: "front_raise",       name: "Alzate Frontali",      muscle: "Spalle",   secondary: "",           equipment: "Manubri", uni: false },
  { id: "rear_delt_fly",     name: "Rear Delt Fly",        muscle: "Spalle",   secondary: "Schiena",    equipment: "Manubri", uni: false },
  { id: "face_pull",         name: "Face Pull",            muscle: "Spalle",   secondary: "Schiena",    equipment: "Cavi", uni: false },
  { id: "shrug",             name: "Scrollate",            muscle: "Spalle",   secondary: "",           equipment: "Manubri", uni: false },
  { id: "shoulder_press_m",  name: "Shoulder Press",       muscle: "Spalle",   secondary: "Tricipiti",  equipment: "Macchina", uni: false },
  // Bicipiti
  { id: "barbell_curl",      name: "Curl Bilanciere",      muscle: "Bicipiti", secondary: "",           equipment: "Bilanciere", uni: false },
  { id: "db_curl",           name: "Curl Manubri",         muscle: "Bicipiti", secondary: "",           equipment: "Manubri", uni: false },
  { id: "hammer_curl",       name: "Hammer Curl",          muscle: "Bicipiti", secondary: "",           equipment: "Manubri", uni: false },
  { id: "preacher_curl",     name: "Panca Scott",          muscle: "Bicipiti", secondary: "",           equipment: "Bilanciere", uni: false },
  { id: "cable_curl",        name: "Curl ai Cavi",         muscle: "Bicipiti", secondary: "",           equipment: "Cavi", uni: false },
  { id: "concentration_curl",name: "Curl Concentrato",     muscle: "Bicipiti", secondary: "",           equipment: "Manubri", uni: true },
  // Tricipiti
  { id: "close_grip_bench",  name: "Panca Presa Stretta",  muscle: "Tricipiti",secondary: "Petto",      equipment: "Bilanciere", uni: false },
  { id: "french_press",      name: "French Press",         muscle: "Tricipiti",secondary: "",           equipment: "Bilanciere", uni: false },
  { id: "tricep_pushdown",   name: "Push Down Cavi",       muscle: "Tricipiti",secondary: "",           equipment: "Cavi", uni: false },
  { id: "overhead_ext",      name: "Estensioni Sopra Testa",muscle:"Tricipiti",secondary: "",           equipment: "Manubri", uni: true },
  { id: "skull_crusher",     name: "Skull Crusher",        muscle: "Tricipiti",secondary: "",           equipment: "Bilanciere", uni: false },
  { id: "dip",               name: "Dip",                  muscle: "Tricipiti",secondary: "Petto",      equipment: "Corpo libero", uni: false },
  { id: "kickback",          name: "Kickback",             muscle: "Tricipiti",secondary: "",           equipment: "Manubri", uni: true },
  // Gambe
  { id: "squat",             name: "Squat",                muscle: "Gambe",    secondary: "Core",       equipment: "Bilanciere", uni: false },
  { id: "front_squat",       name: "Front Squat",          muscle: "Gambe",    secondary: "Core",       equipment: "Bilanciere", uni: false },
  { id: "leg_press",         name: "Leg Press",            muscle: "Gambe",    secondary: "",           equipment: "Macchina", uni: false },
  { id: "leg_extension",     name: "Leg Extension",        muscle: "Gambe",    secondary: "",           equipment: "Macchina", uni: false },
  { id: "leg_curl",          name: "Leg Curl",             muscle: "Gambe",    secondary: "",           equipment: "Macchina", uni: false },
  { id: "romanian_dl",       name: "Stacco Rumeno",        muscle: "Gambe",    secondary: "Schiena",    equipment: "Bilanciere", uni: false },
  { id: "lunges",            name: "Affondi",              muscle: "Gambe",    secondary: "",           equipment: "Manubri", uni: true },
  { id: "hack_squat",        name: "Hack Squat",           muscle: "Gambe",    secondary: "",           equipment: "Macchina", uni: false },
  { id: "calf_raise",        name: "Calf Raise",           muscle: "Gambe",    secondary: "",           equipment: "Macchina", uni: false },
  { id: "hip_thrust",        name: "Hip Thrust",           muscle: "Gambe",    secondary: "",           equipment: "Bilanciere", uni: false },
  { id: "adductor",          name: "Adductor Machine",     muscle: "Gambe",    secondary: "",           equipment: "Macchina", uni: false },
  { id: "abductor",          name: "Abductor Machine",     muscle: "Gambe",    secondary: "",           equipment: "Macchina", uni: false },
  // Core
  { id: "crunch",            name: "Crunch",               muscle: "Core",     secondary: "",           equipment: "Corpo libero", uni: false },
  { id: "plank",             name: "Plank",                muscle: "Core",     secondary: "",           equipment: "Corpo libero", uni: false },
  { id: "cable_crunch",      name: "Crunch ai Cavi",       muscle: "Core",     secondary: "",           equipment: "Cavi", uni: false },
  { id: "leg_raise",         name: "Leg Raise",            muscle: "Core",     secondary: "",           equipment: "Corpo libero", uni: false },
  { id: "ab_wheel",          name: "Ab Wheel",             muscle: "Core",     secondary: "",           equipment: "Corpo libero", uni: false },
];

const MUSCLE_COLORS = {
  Petto: "#EF4444", Schiena: "#3B82F6", Spalle: "#F97316", Bicipiti: "#8B5CF6",
  Tricipiti: "#EC4899", Gambe: "#16A34A", Core: "#EAB308",
};

/* Timer defaults per set type (seconds) */
const SET_TYPE_TIMERS = { W: 60, N: 90, D: 60, F: 180 };
const SET_TYPES = [
  { id: "N", label: "N", color: T.text, name: "Normale" },
  { id: "W", label: "W", color: "#EAB308", name: "Warmup" },
  { id: "D", label: "D", color: T.purple, name: "Drop set" },
  { id: "F", label: "F", color: T.red, name: "Failure" },
];

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */
const calcVolume = (sets) => sets.reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0);
const calc1RM = (w, r) => r === 1 ? w : Math.round(w * (1 + r / 30));

const getExerciseById = (id, customExercises = []) => {
  return EXERCISES.find(e => e.id === id) || customExercises.find(e => e.id === id) || { id, name: id, muscle: "Altro", secondary: "", equipment: "", uni: false };
};

const getRestForSet = (ex, setType) => {
  if (setType === "W" && ex.warmupTimer > 0) return ex.warmupTimer;
  if (ex.restTimer > 0) return ex.restTimer;
  return setType === "W" ? 60 : 90;
};

const estimateWithHistory = (theoretical, realDurations) => {
  if (!realDurations || realDurations.length === 0) return theoretical;
  const weighted = realDurations.map((d, i) => ({ d, w: 1 / (i + 1) }));
  const sum = weighted.reduce((s, x) => s + x.d * x.w, 0);
  const wSum = weighted.reduce((s, x) => s + x.w, 0);
  return Math.round(sum / wSum);
};

const estimateRoutineDuration = (exercises) => {
  let theoretical = 0;
  exercises.forEach(ex => {
    const nSets = ex.sets ? ex.sets.length : 3;
    const rest = ex.restTimer || 90;
    const warmup = ex.warmupTimer || 60;
    const hasWarmup = ex.sets && ex.sets.some(s => s.type === "W");
    theoretical += nSets * (40 + rest) + (hasWarmup ? warmup : 0);
    if (ex.unilateral) theoretical += nSets * (ex.sideTimer || 30);
  });
  return Math.round(theoretical / 60);
};

/* ═══════════════════════════════════════════
   BOTTOM NAV
   ═══════════════════════════════════════════ */
const GymBottomNav = ({ onAdd, onNavigate }) => {
  const tabs = [
    { id: "dashboard", Icon: Home,       label: "Home" },
    { id: "food",      Icon: Utensils,   label: "Cibo" },
    { id: "add",       Icon: null,       label: "" },
    { id: "fitness",   Icon: Footprints, label: "Fitness" },
    { id: "gym",       Icon: Dumbbell,   label: "Gym" },
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
        const isActive = tab.id === "gym";
        return (
          <button key={tab.id} onClick={() => onNavigate(tab.id)} style={{
            background:"none",border:"none",cursor:"pointer",
            display:"flex",flexDirection:"column",alignItems:"center",gap:3,
            padding:"6px 14px",opacity:isActive?1:0.5,transition:"opacity 0.2s",
          }}>
            <tab.Icon size={21} color={isActive?T.teal:T.textSec} strokeWidth={isActive?2.3:1.8}/>
            <span style={{ fontSize:10,fontWeight:700,letterSpacing:0.2,color:isActive?T.teal:T.textSec }}>{tab.label}</span>
            {isActive && <div style={{ width:4,height:4,borderRadius:2,background:T.teal,marginTop:-1 }}/>}
          </button>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════ */
const Toast = ({ message, icon, action, onAction, onDismiss }) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div style={{
      position:"fixed",bottom:100,left:16,right:16,background:T.card,
      borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:10,
      boxShadow:"0 8px 24px rgba(0,0,0,0.12)",zIndex:50,
    }}>
      <span style={{ fontSize:16 }}>{icon}</span>
      <span style={{ flex:1,fontSize:13,fontWeight:600,color:T.text }}>{message}</span>
      {action && <button onClick={onAction} style={{
        background:"none",border:"none",cursor:"pointer",color:T.teal,
        fontSize:12,fontWeight:700,padding:0,
      }}>{action}</button>}
    </div>
  );
};

/* ═══════════════════════════════════════════
   REST TIMER OVERLAY
   ═══════════════════════════════════════════ */
const RestTimerOverlay = ({ seconds, exerciseName, isSideTimer, onSkip }) => {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (remaining <= 0) { onSkip(); return; }
    const t = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [remaining, onSkip]);
  return (
    <div style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      zIndex:100,
    }}>
      <div style={{ fontSize:48,fontWeight:900,color:"#fff",marginBottom:16,fontVariantNumeric:"tabular-nums" }}>
        {formatTimer(remaining)}
      </div>
      <div style={{ fontSize:16,fontWeight:700,color:"#fff",marginBottom:8 }}>
        {isSideTimer ? "CAMBIA LATO" : "RIPOSO"}
      </div>
      <div style={{ fontSize:14,color:"#fff",marginBottom:24,opacity:0.8 }}>{exerciseName}</div>
      <button onClick={onSkip} style={{
        background:"#fff",border:"none",borderRadius:12,padding:"12px 28px",
        fontSize:14,fontWeight:700,color:T.text,cursor:"pointer",
      }}>Salta</button>
    </div>
  );
};

/* ═══════════════════════════════════════════
   DRUM PICKER (for timers)
   ═══════════════════════════════════════════ */
const DrumPicker = ({ value, onSelect, min = 0, max = 300, step = 15 }) => {
  const ref = useRef(null);
  const items = Array.from({ length: (max - min) / step + 1 }, (_, i) => min + i * step);
  const handleScroll = () => {
    if (ref.current) {
      const idx = Math.round(ref.current.scrollLeft / 50);
      onSelect(items[idx] || min);
    }
  };
  return (
    <div style={{
      background:T.card,borderRadius:14,padding:"12px",marginBottom:16,
      border:`1px solid ${T.border}`,
    }}>
      <div style={{ fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:8 }}>Secondi</div>
      <div ref={ref} onScroll={handleScroll} style={{
        display:"flex",gap:8,overflowX:"auto",overflowY:"hidden",scrollSnapType:"x mandatory",
        scrollBehavior:"smooth",WebkitOverflowScrolling:"touch",paddingBottom:8,
      }}>
        {items.map(v => (
          <div key={v} style={{
            minWidth:50,height:50,borderRadius:10,
            background:value===v?T.teal:T.bg,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:13,fontWeight:700,color:value===v?"#fff":T.text,
            scrollSnapAlign:"center",cursor:"pointer",
          }} onClick={() => onSelect(v)}>
            {v}s
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   NUMPAD OVERLAY
   ═══════════════════════════════════════════ */
const NumpadOverlay = ({ onValue, onClose, decimal = false }) => {
  const [display, setDisplay] = useState("0");
  const handleKey = (k) => {
    if (k === "⌫") setDisplay(d => d.length === 1 ? "0" : d.slice(0, -1));
    else if (k === ".") { if (!display.includes(".")) setDisplay(d => d + "."); }
    else setDisplay(d => d === "0" && k !== "." ? k : d + k);
  };
  const handleSubmit = () => {
    onValue(parseFloat(display) || 0);
    onClose();
  };
  const buttons = decimal ? ["1","2","3","4","5","6","7","8","9",".","0","⌫"] : ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  return (
    <div style={{
      position:"fixed",bottom:0,left:0,right:0,background:T.card,
      borderTopLeftRadius:20,borderTopRightRadius:20,padding:"16px",zIndex:100,
      boxShadow:"0 -4px 20px rgba(0,0,0,0.1)",
    }}>
      <div style={{
        fontSize:28,fontWeight:800,color:T.text,textAlign:"right",marginBottom:16,
        minHeight:40,paddingRight:16,
      }}>{display}</div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12 }}>
        {buttons.map((b, i) => (
          <button key={i} onClick={() => b && handleKey(b)} disabled={!b} style={{
            padding:"12px",borderRadius:12,border:`1px solid ${T.border}`,
            background:T.bg,fontSize:16,fontWeight:700,cursor:b?"pointer":"default",
            color:T.text,opacity:b?1:0,
          }}>{b}</button>
        ))}
      </div>
      <button onClick={handleSubmit} style={{
        width:"100%",padding:"14px",background:T.gradient,border:"none",
        borderRadius:12,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",
      }}>Conferma</button>
    </div>
  );
};

/* ═══════════════════════════════════════════
   EXERCISE PICKER (multi-select for routine creation)
   ═══════════════════════════════════════════ */
const ExercisePicker = ({ onSelect, onClose, customExercises, onAddCustom, multiSelect = false }) => {
  const [search, setSearch] = useState("");
  const [filterMuscle, setFilterMuscle] = useState(null);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customMuscle, setCustomMuscle] = useState("Petto");
  const [customEquip, setCustomEquip] = useState("Bilanciere");
  const [selected, setSelected] = useState([]);

  const allExercises = useMemo(() => [...EXERCISES, ...customExercises], [customExercises]);
  const filtered = useMemo(() => {
    let list = allExercises;
    if (filterMuscle) list = list.filter(e => e.muscle === filterMuscle);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q));
    }
    return list;
  }, [allExercises, filterMuscle, search]);

  const handleAddCustom = () => {
    if (!customName.trim()) return;
    const ex = { id: "custom_" + Date.now(), name: customName.trim(), muscle: customMuscle, secondary: "", equipment: customEquip, uni: false };
    onAddCustom(ex);
    if (multiSelect) setSelected(p => [...p, ex]);
    else onSelect(ex);
    setCustomName("");
    setShowAddCustom(false);
  };

  const toggleSelect = (ex) => {
    if (multiSelect) {
      if (selected.find(s => s.id === ex.id)) setSelected(p => p.filter(s => s.id !== ex.id));
      else setSelected(p => [...p, ex]);
    } else {
      onSelect(ex);
    }
  };

  if (showAddCustom) {
    return (
      <div style={{
        position:"fixed",inset:0,zIndex:60,background:T.bg,
        animation:"slideUp .3s ease-out",display:"flex",flexDirection:"column",
      }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,padding:"16px 16px 8px" }}>
          <button onClick={() => setShowAddCustom(false)} style={{
            width:36,height:36,borderRadius:12,background:T.tealLight,border:"none",
            display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
          }}><ChevronLeft size={18} color={T.teal}/></button>
          <div style={{ fontSize:18,fontWeight:800,color:T.text }}>Nuovo esercizio</div>
        </div>
        <div style={{ padding:"16px",flex:1,display:"flex",flexDirection:"column" }}>
          <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Nome esercizio"
            style={{
              width:"100%",padding:"12px 14px",borderRadius:10,border:`1px solid ${T.border}`,
              fontSize:13,color:T.text,marginBottom:12,fontFamily:"inherit",boxSizing:"border-box",
            }}/>
          <select value={customMuscle} onChange={e => setCustomMuscle(e.target.value)}
            style={{ flex:1,padding:"8px 10px",borderRadius:10,border:`1px solid ${T.border}`,fontSize:12,color:T.text,fontFamily:"inherit",marginBottom:8 }}>
            {MUSCLE_GROUPS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={customEquip} onChange={e => setCustomEquip(e.target.value)}
            style={{ flex:1,padding:"8px 10px",borderRadius:10,border:`1px solid ${T.border}`,fontSize:12,color:T.text,fontFamily:"inherit",marginBottom:16 }}>
            {EQUIPMENT.map(eq => <option key={eq} value={eq}>{eq}</option>)}
          </select>
          <button onClick={handleAddCustom} style={{
            padding:"12px",borderRadius:10,border:"none",background:T.teal,
            fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",
          }}>Aggiungi</button>
        </div>
        <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      position:"fixed",inset:0,zIndex:60,background:T.bg,
      animation:"slideUp .3s ease-out",display:"flex",flexDirection:"column",
    }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"16px 16px 8px" }}>
        <button onClick={onClose} style={{
          width:36,height:36,borderRadius:12,background:T.tealLight,border:"none",
          display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
        }}><X size={18} color={T.teal}/></button>
        <div style={{ fontSize:18,fontWeight:800,color:T.text }}>Aggiungi Esercizio</div>
      </div>

      <div style={{ padding:"0 16px 8px" }}>
        <div style={{
          display:"flex",alignItems:"center",gap:8,background:T.card,borderRadius:12,
          padding:"10px 14px",border:`1px solid ${T.border}`,
        }}>
          <Search size={16} color={T.textMuted}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca esercizio..."
            style={{ border:"none",outline:"none",flex:1,fontSize:14,color:T.text,background:"transparent",fontFamily:"inherit" }}/>
        </div>
      </div>

      <div style={{ display:"flex",gap:6,padding:"0 16px 10px",overflowX:"auto",flexShrink:0 }}>
        <button onClick={() => setFilterMuscle(null)} style={{
          background:!filterMuscle?T.teal:T.card,color:!filterMuscle?"#fff":T.textSec,
          border:`1px solid ${!filterMuscle?T.teal:T.border}`,borderRadius:20,
          padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",
        }}>Tutti</button>
        {MUSCLE_GROUPS.map(mg => (
          <button key={mg} onClick={() => setFilterMuscle(filterMuscle===mg?null:mg)} style={{
            background:filterMuscle===mg?MUSCLE_COLORS[mg]:T.card,
            color:filterMuscle===mg?"#fff":T.textSec,
            border:`1px solid ${filterMuscle===mg?MUSCLE_COLORS[mg]:T.border}`,
            borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",
          }}>{mg}</button>
        ))}
      </div>

      {multiSelect && selected.length > 0 && (
        <div style={{ padding:"0 16px 8px",display:"flex",gap:6,flexWrap:"wrap" }}>
          {selected.map(s => (
            <div key={s.id} style={{
              background:T.teal,color:"#fff",borderRadius:20,padding:"6px 12px",
              fontSize:11,fontWeight:700,display:"flex",alignItems:"center",gap:6,
            }}>
              {s.name}
              <button onClick={() => setSelected(p => p.filter(x => x.id !== s.id))}
                style={{ background:"none",border:"none",cursor:"pointer",color:"#fff",padding:0 }}>
                <X size={12}/>
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex:1,overflowY:"auto",padding:"0 16px" }}>
        {filtered.map(ex => (
          <button key={ex.id} onClick={() => toggleSelect(ex)} style={{
            width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 14px",
            background:multiSelect && selected.find(s => s.id === ex.id) ? T.tealLight : T.card,
            border:`1px solid ${T.border}`,borderRadius:14,marginBottom:8,
            cursor:"pointer",textAlign:"left",
          }}>
            {multiSelect && (
              <div style={{
                width:20,height:20,borderRadius:6,border:`2px solid ${T.teal}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                background:selected.find(s => s.id === ex.id) ? T.teal : "transparent",
              }}>
                {selected.find(s => s.id === ex.id) && <Check size={12} color="#fff"/>}
              </div>
            )}
            <div style={{
              width:38,height:38,borderRadius:10,background:`${MUSCLE_COLORS[ex.muscle]||T.teal}18`,
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>
              <Dumbbell size={16} color={MUSCLE_COLORS[ex.muscle]||T.teal}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13,fontWeight:700,color:T.text }}>{ex.name}</div>
              <div style={{ fontSize:10,color:T.textMuted }}>{ex.muscle}{ex.secondary?` • ${ex.secondary}`:""} • {ex.equipment}</div>
            </div>
            {!multiSelect && <Plus size={16} color={T.teal}/>}
          </button>
        ))}

        <button onClick={() => setShowAddCustom(true)} style={{
          width:"100%",padding:"12px",background:T.tealLight,border:`1px dashed ${T.teal}`,
          borderRadius:14,cursor:"pointer",fontSize:12,fontWeight:700,color:T.teal,
          display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:20,
        }}>
          <Plus size={14}/> Crea esercizio personalizzato
        </button>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
};

/* ═══════════════════════════════════════════
   ROUTINE NAME MODAL
   ═══════════════════════════════════════════ */
const NameModal = ({ onContinue, onClose, title = "Nome Routine" }) => {
  const [name, setName] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",
      display:"flex",alignItems:"flex-end",zIndex:70,
    }}>
      <div style={{
        width:"100%",background:T.card,borderTopLeftRadius:20,borderTopRightRadius:20,
        padding:"20px 16px 28px",
      }}>
        <div style={{ fontSize:16,fontWeight:800,color:T.text,marginBottom:16 }}>{title}</div>
        <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && name.trim() && onContinue(name)}
          placeholder="es. Push Day"
          style={{
            width:"100%",padding:"12px 14px",borderRadius:12,border:`1px solid ${T.border}`,
            fontSize:15,fontWeight:600,color:T.text,marginBottom:16,fontFamily:"inherit",boxSizing:"border-box",
          }}/>
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{
            flex:1,padding:"12px",borderRadius:12,border:`1px solid ${T.border}`,background:T.card,
            fontSize:14,fontWeight:700,color:T.textSec,cursor:"pointer",
          }}>Annulla</button>
          <button onClick={() => name.trim() && onContinue(name)} disabled={!name.trim()} style={{
            flex:1,padding:"12px",borderRadius:12,border:"none",background:T.gradient,
            fontSize:14,fontWeight:700,color:"#fff",cursor:name.trim()?"pointer":"default",opacity:name.trim()?1:0.5,
          }}>Continua</button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   ROUTINE EDITOR (set creation and configuration)
   ═══════════════════════════════════════════ */
const RoutineEditor = ({ routine, exercises, onSave, onClose, customExercises, onAddCustomExercise, onAddExercises }) => {
  const [exList, setExList] = useState(exercises || []);
  const [editNoteIdx, setEditNoteIdx] = useState(null);
  const [showAddMore, setShowAddMore] = useState(false);

  const moveExercise = (idx, dir) => {
    if ((dir === -1 && idx === 0) || (dir === 1 && idx === exList.length - 1)) return;
    const next = [...exList];
    [next[idx], next[idx + dir]] = [next[idx + dir], next[idx]];
    setExList(next);
  };

  const toggleUnilateral = (idx) => {
    const next = [...exList];
    next[idx] = { ...next[idx], unilateral: !next[idx].unilateral };
    setExList(next);
  };

  const toggleSuperset = (idx) => {
    const next = [...exList];
    if (next[idx].supersetWith === idx + 1) next[idx] = { ...next[idx], supersetWith: null };
    else next[idx] = { ...next[idx], supersetWith: idx + 1 };
    setExList(next);
  };

  const updateSet = (exIdx, setIdx, field, value) => {
    const next = [...exList];
    next[exIdx] = { ...next[exIdx], sets: [...next[exIdx].sets] };
    next[exIdx].sets[setIdx] = { ...next[exIdx].sets[setIdx], [field]: value };
    setExList(next);
  };

  const addSet = (exIdx) => {
    const next = [...exList];
    const ex = next[exIdx];
    const lastSet = ex.sets[ex.sets.length - 1];
    const newSet = { weight: lastSet?.weight || 0, reps: lastSet?.reps || 0, type: "N" };
    next[exIdx] = { ...ex, sets: [...ex.sets, newSet] };
    setExList(next);
  };

  const removeSet = (exIdx, setIdx) => {
    const next = [...exList];
    if (next[exIdx].sets.length <= 1) return;
    next[exIdx] = { ...next[exIdx], sets: next[exIdx].sets.filter((_, i) => i !== setIdx) };
    setExList(next);
  };

  const removeExercise = (idx) => {
    setExList(prev => prev.filter((_, i) => i !== idx));
  };

  const cycleSetType = (exIdx, setIdx) => {
    const types = ["N", "W"];
    const cur = exList[exIdx].sets[setIdx].type;
    updateSet(exIdx, setIdx, "type", types[(types.indexOf(cur) + 1) % types.length]);
  };

  const handleSave = () => {
    onSave(exList);
  };

  const addMoreExercises = (exs) => {
    setExList(prev => [...prev, ...exs.map(e => ({
      exerciseId: e.id,
      sets: [{ weight: 0, reps: 0, type: "N" }],
      restTimer: 90,
      warmupTimer: 60,
      sideTimer: 30,
      unilateral: e.uni || false,
      supersetWith: null,
      note: "",
    }))]);
    setShowAddMore(false);
  };

  if (showAddMore) {
    return <ExercisePicker multiSelect onSelect={() => {}} onClose={() => setShowAddMore(false)}
      customExercises={customExercises} onAddCustom={onAddCustomExercise}
      onMultiSelect={addMoreExercises}/>;
  }

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:100 }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"16px 16px 12px" }}>
        <button onClick={onClose} style={{
          width:36,height:36,borderRadius:12,background:T.tealLight,border:"none",
          display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
        }}><ChevronLeft size={18} color={T.teal}/></button>
        <div style={{ fontSize:18,fontWeight:800,color:T.text }}>Configura Esercizi</div>
        <button onClick={handleSave} style={{
          marginLeft:"auto",background:T.teal,border:"none",borderRadius:10,padding:"8px 16px",
          color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",
        }}>Avanti</button>
      </div>

      <div style={{ padding:"0 16px" }}>
        {exList.map((ex, exIdx) => {
          const info = getExerciseById(ex.exerciseId, customExercises);
          return (
            <div key={exIdx} style={{
              background:T.card,borderRadius:14,padding:14,marginBottom:14,
              border:`1px solid ${T.border}`,
              borderLeft: ex.supersetWith === exIdx + 1 ? `4px solid ${T.orange}` : "none",
            }}>
              {/* Header row */}
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
                <div style={{ display:"flex",flexDirection:"column",gap:2 }}>
                  <button onClick={() => moveExercise(exIdx, -1)} disabled={exIdx === 0} style={{
                    background:"none",border:"none",cursor:exIdx===0?"default":"pointer",opacity:exIdx===0?0.4:1,
                    padding:2,display:"flex",alignItems:"center",justifyContent:"center",
                  }}><ChevronUp size={14} color={T.textMuted}/></button>
                  <button onClick={() => moveExercise(exIdx, 1)} disabled={exIdx === exList.length - 1} style={{
                    background:"none",border:"none",cursor:exIdx===exList.length-1?"default":"pointer",opacity:exIdx===exList.length-1?0.4:1,
                    padding:2,display:"flex",alignItems:"center",justifyContent:"center",
                  }}><ChevronDown size={14} color={T.textMuted}/></button>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13,fontWeight:700,color:T.text }}>{info.name}</div>
                  <div style={{ fontSize:10,color:T.textMuted }}>{info.muscle}</div>
                </div>
                <button onClick={() => toggleUnilateral(exIdx)} style={{
                  background:"none",border:"none",cursor:"pointer",padding:6,
                  opacity:ex.unilateral?1:0.4,
                }}><ArrowLeftRight size={14} color={T.textMuted}/></button>
                {exIdx < exList.length - 1 && (
                  <button onClick={() => toggleSuperset(exIdx)} style={{
                    background:"none",border:"none",cursor:"pointer",padding:6,
                    opacity:ex.supersetWith===exIdx+1?1:0.4,
                  }}><Link2 size={14} color={ex.supersetWith===exIdx+1?T.orange:T.textMuted}/></button>
                )}
                <button onClick={() => removeExercise(exIdx)} style={{
                  background:"none",border:"none",cursor:"pointer",padding:6,
                }}><Trash2 size={14} color={T.textMuted}/></button>
              </div>

              {/* Timer row */}
              <div style={{ display:"flex",gap:10,marginBottom:12,fontSize:11,fontWeight:700,color:T.textMuted,flexWrap:"wrap" }}>
                <div style={{ display:"flex",alignItems:"center",gap:4 }}>
                  <span>Riposo:</span>
                  <button onClick={() => {}} style={{
                    background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"4px 8px",
                    fontSize:10,fontWeight:700,color:T.text,cursor:"pointer",
                  }}>{ex.restTimer}s</button>
                </div>
                {ex.sets && ex.sets.some(s => s.type === "W") && (
                  <div style={{ display:"flex",alignItems:"center",gap:4 }}>
                    <span>Warmup:</span>
                    <button onClick={() => {}} style={{
                      background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"4px 8px",
                      fontSize:10,fontWeight:700,color:T.text,cursor:"pointer",
                    }}>{ex.warmupTimer}s</button>
                  </div>
                )}
                {ex.unilateral && (
                  <div style={{ display:"flex",alignItems:"center",gap:4 }}>
                    <span>Lati:</span>
                    <button onClick={() => {}} style={{
                      background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"4px 8px",
                      fontSize:10,fontWeight:700,color:T.text,cursor:"pointer",
                    }}>{ex.sideTimer}s</button>
                  </div>
                )}
              </div>

              {/* Note section */}
              {editNoteIdx === exIdx ? (
                <textarea value={ex.note || ""} onChange={e => {
                  const next = [...exList];
                  next[exIdx] = { ...next[exIdx], note: e.target.value };
                  setExList(next);
                }} onBlur={() => setEditNoteIdx(null)}
                  style={{
                    width:"100%",padding:"8px 10px",borderRadius:10,border:`1px solid ${T.border}`,
                    fontSize:12,color:T.text,marginBottom:12,fontFamily:"inherit",boxSizing:"border-box",
                    minHeight:60,
                  }} placeholder="Nota esercizio..."/>
              ) : (
                <button onClick={() => setEditNoteIdx(exIdx)} style={{
                  background:"none",border:"none",cursor:"pointer",padding:0,marginBottom:12,
                  display:"flex",alignItems:"center",gap:6,fontSize:11,fontWeight:700,color:T.textMuted,
                }}>
                  <FileText size={12}/> {ex.note ? "Modifica nota" : "Aggiungi nota"}
                </button>
              )}

              {/* Sets table */}
              <div style={{ marginBottom:12 }}>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:8,fontSize:10,fontWeight:700,color:T.textMuted,marginBottom:8 }}>
                  <div>Tipo</div>
                  <div>Kg</div>
                  <div>Reps</div>
                  <div></div>
                </div>
                {ex.sets && ex.sets.map((set, setIdx) => (
                  <div key={setIdx} style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:8,marginBottom:8 }}>
                    <button onClick={() => cycleSetType(exIdx, setIdx)} style={{
                      background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:"6px",
                      fontSize:12,fontWeight:700,color:T.text,cursor:"pointer",
                    }}>{set.type}</button>
                    <input type="number" value={set.weight || ""} onChange={e => updateSet(exIdx, setIdx, "weight", parseFloat(e.target.value) || 0)}
                      style={{
                        padding:"6px 8px",borderRadius:8,border:`1px solid ${T.border}`,
                        fontSize:12,fontWeight:700,color:T.text,textAlign:"center",fontFamily:"inherit",
                      }}/>
                    <input type="number" value={set.reps || ""} onChange={e => updateSet(exIdx, setIdx, "reps", parseFloat(e.target.value) || 0)}
                      style={{
                        padding:"6px 8px",borderRadius:8,border:`1px solid ${T.border}`,
                        fontSize:12,fontWeight:700,color:T.text,textAlign:"center",fontFamily:"inherit",
                      }}/>
                    <button onClick={() => removeSet(exIdx, setIdx)} disabled={ex.sets.length === 1} style={{
                      background:"none",border:"none",cursor:ex.sets.length===1?"default":"pointer",
                      opacity:ex.sets.length===1?0.4:1,padding:4,
                    }}><Minus size={12} color={T.textMuted}/></button>
                  </div>
                ))}
              </div>

              <button onClick={() => addSet(exIdx)} style={{
                width:"100%",padding:"10px",background:T.tealLight,border:`1px dashed ${T.teal}`,
                borderRadius:10,cursor:"pointer",fontSize:11,fontWeight:700,color:T.teal,
              }}>+ Aggiungi serie</button>
            </div>
          );
        })}

        <button onClick={() => setShowAddMore(true)} style={{
          width:"100%",padding:"12px",background:T.tealLight,border:`1px dashed ${T.teal}`,
          borderRadius:14,cursor:"pointer",fontSize:12,fontWeight:700,color:T.teal,
          display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:20,
        }}>
          <Plus size={14}/> Aggiungi Esercizi
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   ROUTINE SUMMARY
   ═══════════════════════════════════════════ */
const RoutineSummary = ({ name, exercises, onSave, onBack, customExercises }) => {
  const totalSets = exercises.reduce((s, ex) => s + (ex.sets ? ex.sets.length : 0), 0);
  const estimatedDuration = estimateRoutineDuration(exercises);

  const muscleGroups = {};
  exercises.forEach(ex => {
    const info = getExerciseById(ex.exerciseId, customExercises);
    if (!muscleGroups[info.muscle]) muscleGroups[info.muscle] = 0;
    muscleGroups[info.muscle] += ex.sets ? ex.sets.length : 0;
  });

  const sortedMuscles = Object.entries(muscleGroups).sort((a, b) => b[1] - a[1]);
  const maxSets = Math.max(...Object.values(muscleGroups));

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:100 }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"16px 16px 12px" }}>
        <button onClick={onBack} style={{
          width:36,height:36,borderRadius:12,background:T.tealLight,border:"none",
          display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
        }}><ChevronLeft size={18} color={T.teal}/></button>
        <div style={{ fontSize:18,fontWeight:800,color:T.text }}>Riepilogo</div>
      </div>

      <div style={{ padding:"12px 16px" }}>
        {/* Header card */}
        <div style={{
          background:T.gradient,borderRadius:16,padding:20,marginBottom:16,color:"#fff",
        }}>
          <div style={{ fontSize:28,fontWeight:900,marginBottom:4 }}>{exercises.length}</div>
          <div style={{ fontSize:12,fontWeight:700,marginBottom:12 }}>Esercizi • {totalSets} serie</div>
          <div style={{ fontSize:14,fontWeight:700 }}>~{estimatedDuration} minuti</div>
        </div>

        {/* Muscle groups */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:12,fontWeight:800,color:T.text,marginBottom:12 }}>Serie per gruppo muscolare</div>
          {sortedMuscles.map(([muscle, count]) => (
            <div key={muscle} style={{ marginBottom:12 }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6 }}>
                <div style={{ fontSize:11,fontWeight:700,color:T.text }}>{muscle}</div>
                <div style={{ fontSize:11,fontWeight:700,color:T.textMuted }}>{count} serie</div>
              </div>
              <div style={{
                height:8,borderRadius:4,background:T.bg,overflow:"hidden",
              }}>
                <div style={{
                  height:"100%",background:MUSCLE_COLORS[muscle]||T.teal,
                  width:`${(count/maxSets)*100}%`,
                }}/>
              </div>
            </div>
          ))}
        </div>

        {/* Exercise list */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:12,fontWeight:800,color:T.text,marginBottom:12 }}>Esercizi</div>
          {exercises.map((ex, idx) => {
            const info = getExerciseById(ex.exerciseId, customExercises);
            return (
              <div key={idx} style={{
                background:T.card,borderRadius:12,padding:12,marginBottom:8,
                border:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:10,
              }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:T.text }}>{info.name}</div>
                  <div style={{ fontSize:10,color:T.textMuted }}>{ex.sets ? ex.sets.length : 0} serie</div>
                </div>
                {ex.supersetWith === idx + 1 && <span style={{ fontSize:9,fontWeight:700,background:T.orange,color:"#fff",padding:"2px 8px",borderRadius:4 }}>SS</span>}
                {ex.unilateral && <span style={{ fontSize:9,fontWeight:700,background:T.purple,color:"#fff",padding:"2px 8px",borderRadius:4 }}>UNI</span>}
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        <button onClick={onSave} style={{
          width:"100%",padding:"14px",background:T.gradient,border:"none",borderRadius:12,
          color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:10,
        }}>Salva Routine</button>
        <button onClick={onBack} style={{
          width:"100%",padding:"14px",background:T.card,border:`1px solid ${T.border}`,borderRadius:12,
          color:T.text,fontSize:14,fontWeight:700,cursor:"pointer",
        }}>Torna a modificare</button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   ACTIVE WORKOUT SCREEN
   ═══════════════════════════════════════════ */
const ActiveWorkoutScreen = ({
  initialExercises, routineName, onFinish, onDiscard, onNavigate,
  allWorkouts, allSets, customExercises, onAddCustomExercise,
}) => {
  const [workoutName, setWorkoutName] = useState(routineName || "");
  const [exercises, setExercises] = useState(initialExercises || []);
  const [showPicker, setShowPicker] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [restTimer, setRestTimer] = useState(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const prevData = useMemo(() => {
    const map = {};
    if (!allWorkouts || !allSets) return map;
    exercises.forEach(ex => {
      const exSets = allSets.filter(s => s.exerciseId === ex.exerciseId);
      if (exSets.length === 0) return;
      const byWorkout = {};
      exSets.forEach(s => {
        if (!byWorkout[s.workoutId]) byWorkout[s.workoutId] = [];
        byWorkout[s.workoutId].push(s);
      });
      const workoutIds = Object.keys(byWorkout).map(Number).sort((a, b) => b - a);
      if (workoutIds.length > 0) {
        map[ex.exerciseId] = byWorkout[workoutIds[0]].sort((a, b) => a.order - b.order);
      }
    });
    return map;
  }, [exercises, allWorkouts, allSets]);

  const addExercise = (ex) => {
    const prev = allSets.filter(s => s.exerciseId === ex.id);
    let defaultSets = [{ weight: 0, reps: 0, type: "N", completed: false }];
    if (prev.length > 0) {
      const byWorkout = {};
      prev.forEach(s => { if (!byWorkout[s.workoutId]) byWorkout[s.workoutId] = []; byWorkout[s.workoutId].push(s); });
      const lastWId = Object.keys(byWorkout).map(Number).sort((a, b) => b - a)[0];
      if (lastWId != null) {
        const lastSets = byWorkout[lastWId].sort((a, b) => a.order - b.order);
        defaultSets = lastSets.map(s => ({ weight: s.weight || 0, reps: s.reps || 0, type: s.type || "N", completed: false }));
      }
    }
    setExercises(p => [...p, { exerciseId: ex.id, restTimer: 0, warmupTimer: 60, sideTimer: 30, unilateral: false, supersetWith: null, note: "", sets: defaultSets }]);
    setShowPicker(false);
  };

  const updateSet = (exIdx, setIdx, field, value) => {
    setExercises(prev => {
      const next = [...prev];
      const ex = { ...next[exIdx], sets: [...next[exIdx].sets] };
      ex.sets[setIdx] = { ...ex.sets[setIdx], [field]: value };
      next[exIdx] = ex;
      return next;
    });
  };

  const toggleComplete = (exIdx, setIdx) => {
    const ex = exercises[exIdx];
    const set = ex.sets[setIdx];
    const info = getExerciseById(ex.exerciseId, customExercises);
    if (ex.unilateral) {
      if (!set.sideCompleted && !set.completed) {
        // First side done → start side timer
        updateSet(exIdx, setIdx, "sideCompleted", true);
        if (ex.sideTimer > 0) {
          setRestTimer({ seconds: ex.sideTimer, exerciseName: info.name, isSideTimer: true });
        }
      } else if (set.sideCompleted && !set.completed) {
        // Second side done → mark complete, start rest timer
        updateSet(exIdx, setIdx, "completed", true);
        const restSec = getRestForSet(ex, set.type);
        setRestTimer({ seconds: restSec, exerciseName: info.name, isSideTimer: false });
      } else {
        // Reset
        updateSet(exIdx, setIdx, "completed", false);
        updateSet(exIdx, setIdx, "sideCompleted", false);
      }
    } else {
      const newCompleted = !set.completed;
      updateSet(exIdx, setIdx, "completed", newCompleted);
      if (newCompleted) {
        const restSec = getRestForSet(ex, set.type);
        setRestTimer({ seconds: restSec, exerciseName: info.name, isSideTimer: false });
      }
    }
  };

  const addSet = (exIdx) => {
    setExercises(prev => {
      const next = [...prev];
      const ex = { ...next[exIdx], sets: [...next[exIdx].sets] };
      const lastSet = ex.sets[ex.sets.length - 1];
      ex.sets.push({ weight: lastSet?.weight || 0, reps: lastSet?.reps || 0, type: "N", completed: false });
      next[exIdx] = ex;
      return next;
    });
  };

  const removeSet = (exIdx, setIdx) => {
    setExercises(prev => {
      const next = [...prev];
      const ex = { ...next[exIdx], sets: [...next[exIdx].sets] };
      if (ex.sets.length <= 1) return prev;
      ex.sets.splice(setIdx, 1);
      next[exIdx] = ex;
      return next;
    });
  };

  const removeExercise = (exIdx) => setExercises(prev => prev.filter((_, i) => i !== exIdx));

  const cycleSetType = (exIdx, setIdx) => {
    const types = ["N", "W", "D", "F"];
    const cur = exercises[exIdx].sets[setIdx].type;
    updateSet(exIdx, setIdx, "type", types[(types.indexOf(cur) + 1) % types.length]);
  };

  const totalVolume = useMemo(() =>
    exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).reduce((ss, s) => ss + (s.weight||0)*(s.reps||0), 0), 0)
  , [exercises]);

  const totalSetsCompleted = useMemo(() =>
    exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0)
  , [exercises]);

  const handleFinish = () => {
    const durationMin = Math.round(elapsedSec / 60);
    const completedExercises = exercises.filter(ex => ex.sets.some(s => s.completed));
    if (completedExercises.length === 0) { onDiscard(); return; }
    onFinish({
      name: workoutName || `Allenamento ${formatDate(new Date())}`,
      date: todayISO(),
      startTime: new Date(startRef.current).toISOString(),
      endTime: new Date().toISOString(),
      durationMin,
      exercises: completedExercises.map(ex => ({
        exerciseId: ex.exerciseId,
        sets: ex.sets.filter(s => s.completed).map((s, i) => ({ ...s, order: i })),
      })),
    });
  };

  if (restTimer) {
    return <RestTimerOverlay seconds={restTimer.seconds} exerciseName={restTimer.exerciseName}
      isSideTimer={restTimer.isSideTimer} onSkip={() => setRestTimer(null)}/>;
  }

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:100 }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"16px 16px 8px",background:T.card,borderBottom:`1px solid ${T.border}` }}>
        <button onClick={() => setShowDiscardConfirm(true)} style={{
          width:36,height:36,borderRadius:12,background:T.tealLight,border:"none",
          display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
        }}><ChevronLeft size={18} color={T.teal}/></button>
        <div style={{ flex:1 }}>
          <input value={workoutName} onChange={e => setWorkoutName(e.target.value)}
            placeholder="Nome allenamento"
            style={{
              width:"100%",padding:"8px 12px",borderRadius:10,border:`1px solid ${T.border}`,
              fontSize:13,fontWeight:700,color:T.text,fontFamily:"inherit",boxSizing:"border-box",
            }}/>
        </div>
        <button onClick={() => setShowFinishConfirm(true)} style={{
          background:T.gradient,border:"none",borderRadius:10,padding:"8px 14px",
          color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",
        }}>Finisci</button>
      </div>

      <div style={{ display:"flex",gap:16,padding:"12px 16px",fontSize:12,fontWeight:700 }}>
        <div style={{ display:"flex",alignItems:"center",gap:6,color:T.textMuted }}>
          <Clock size={14} color={T.teal}/>
          {formatTimer(elapsedSec)}
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:6,color:T.textMuted }}>
          <Flame size={14} color={T.orange}/>
          {Math.round(totalVolume)} kg
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:6,color:T.textMuted }}>
          <Check size={14} color={T.green}/>
          {totalSetsCompleted} serie
        </div>
      </div>

      <div style={{ padding:"0 16px" }}>
        {exercises.map((ex, exIdx) => {
          const info = getExerciseById(ex.exerciseId, customExercises);
          return (
            <div key={exIdx} style={{
              background:T.card,borderRadius:14,padding:14,marginBottom:12,
              border:`1px solid ${T.border}`,
              borderLeft: ex.supersetWith ? `4px solid ${T.orange}` : "none",
            }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14,fontWeight:700,color:T.text }}>{info.name}</div>
                  <div style={{ fontSize:10,color:T.textMuted }}>{ex.sets.filter(s => s.completed).length}/{ex.sets.length}</div>
                </div>
                <button onClick={() => removeExercise(exIdx)} style={{
                  background:"none",border:"none",cursor:"pointer",padding:6,
                }}><Trash2 size={14} color={T.textMuted}/></button>
              </div>

              {ex.sets.map((set, setIdx) => (
                <div key={setIdx} style={{
                  display:"grid",gridTemplateColumns:"auto 1fr 1fr 1fr auto",gap:8,alignItems:"center",
                  padding:"10px 0",borderBottom:`1px solid ${T.border}`,marginBottom:8,
                }}>
                  <button onClick={() => toggleComplete(exIdx, setIdx)} style={{
                    width:28,height:28,borderRadius:8,
                    border:`2px solid ${set.completed ? GREEN : set.sideCompleted ? T.orange : T.border}`,
                    background: set.completed ? GREEN : set.sideCompleted ? T.orange : "#fff",
                    display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
                    transition:"all .15s",
                  }}>
                    {set.completed && <Check size={14} color="#fff" strokeWidth={3}/>}
                    {set.sideCompleted && !set.completed && <span style={{fontSize:10,fontWeight:900,color:"#fff"}}>½</span>}
                  </button>
                  <button onClick={() => cycleSetType(exIdx, setIdx)} style={{
                    background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"4px 8px",
                    fontSize:11,fontWeight:700,color:T.text,cursor:"pointer",
                  }}>{set.type}</button>
                  <input type="number" value={set.weight || ""} onChange={e => updateSet(exIdx, setIdx, "weight", parseFloat(e.target.value) || 0)}
                    style={{
                      padding:"6px 8px",borderRadius:6,border:`1px solid ${T.border}`,
                      fontSize:11,fontWeight:700,color:T.text,textAlign:"center",fontFamily:"inherit",
                    }} placeholder="Kg"/>
                  <input type="number" value={set.reps || ""} onChange={e => updateSet(exIdx, setIdx, "reps", parseFloat(e.target.value) || 0)}
                    style={{
                      padding:"6px 8px",borderRadius:6,border:`1px solid ${T.border}`,
                      fontSize:11,fontWeight:700,color:T.text,textAlign:"center",fontFamily:"inherit",
                    }} placeholder="Reps"/>
                  <button onClick={() => removeSet(exIdx, setIdx)} disabled={ex.sets.length === 1} style={{
                    background:"none",border:"none",cursor:ex.sets.length===1?"default":"pointer",
                    opacity:ex.sets.length===1?0.4:1,padding:4,
                  }}><Minus size={12} color={T.textMuted}/></button>
                </div>
              ))}

              <button onClick={() => addSet(exIdx)} style={{
                width:"100%",padding:"8px",background:T.tealLight,border:`1px dashed ${T.teal}`,
                borderRadius:10,cursor:"pointer",fontSize:11,fontWeight:700,color:T.teal,
              }}>+ Serie</button>
            </div>
          );
        })}

        <button onClick={() => setShowPicker(true)} style={{
          width:"100%",padding:"12px",background:T.tealLight,border:`1px dashed ${T.teal}`,
          borderRadius:14,cursor:"pointer",fontSize:12,fontWeight:700,color:T.teal,
          display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:20,
        }}>
          <Plus size={14}/> Aggiungi Esercizio
        </button>
      </div>

      {showPicker && <ExercisePicker onSelect={addExercise} onClose={() => setShowPicker(false)}
        customExercises={customExercises} onAddCustom={onAddCustomExercise}/>}

      {showFinishConfirm && (
        <div style={{
          position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",
          display:"flex",alignItems:"flex-end",zIndex:70,
        }}>
          <div style={{ width:"100%",background:T.card,borderTopLeftRadius:20,borderTopRightRadius:20,padding:"20px 16px 28px" }}>
            <div style={{ fontSize:16,fontWeight:800,color:T.text,marginBottom:8 }}>Finisci allenamento?</div>
            <div style={{ fontSize:12,color:T.textMuted,marginBottom:16 }}>Saranno salvate {totalSetsCompleted} serie</div>
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={() => setShowFinishConfirm(false)} style={{
                flex:1,padding:"12px",borderRadius:12,border:`1px solid ${T.border}`,background:T.card,
                fontSize:14,fontWeight:700,color:T.textSec,cursor:"pointer",
              }}>Continua</button>
              <button onClick={handleFinish} style={{
                flex:1,padding:"12px",borderRadius:12,border:"none",background:T.gradient,
                fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer",
              }}>Salva e finisci</button>
            </div>
          </div>
        </div>
      )}

      {showDiscardConfirm && (
        <div style={{
          position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",
          display:"flex",alignItems:"flex-end",zIndex:70,
        }}>
          <div style={{ width:"100%",background:T.card,borderTopLeftRadius:20,borderTopRightRadius:20,padding:"20px 16px 28px" }}>
            <div style={{ fontSize:16,fontWeight:800,color:T.text,marginBottom:8 }}>Scartare allenamento?</div>
            <div style={{ fontSize:12,color:T.textMuted,marginBottom:16 }}>I dati non salvati saranno persi</div>
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={() => setShowDiscardConfirm(false)} style={{
                flex:1,padding:"12px",borderRadius:12,border:`1px solid ${T.border}`,background:T.card,
                fontSize:14,fontWeight:700,color:T.textSec,cursor:"pointer",
              }}>Continua</button>
              <button onClick={onDiscard} style={{
                flex:1,padding:"12px",borderRadius:12,border:"none",background:T.red,
                fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer",
              }}>Scarta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   EXERCISE DETAIL SCREEN
   ═══════════════════════════════════════════ */
const ExerciseDetailScreen = ({ exerciseId, allWorkouts, allSets, customExercises, onBack }) => {
  const info = getExerciseById(exerciseId, customExercises);
  const sets = useMemo(() => allSets.filter(s => s.exerciseId === exerciseId).sort((a, b) => b.workoutId - a.workoutId), [allSets, exerciseId]);

  const stats = useMemo(() => {
    const completed = sets.length;
    const totalVol = calcVolume(sets);
    const maxWeight = Math.max(...sets.map(s => s.weight || 0), 0);
    const maxReps = Math.max(...sets.map(s => s.reps || 0), 0);
    const max1RM = sets.length > 0 ? calc1RM(maxWeight, maxReps) : 0;
    const workoutDates = {};
    sets.forEach(s => { if (!workoutDates[s.workoutId]) workoutDates[s.workoutId] = true; });
    return { completed, totalVol: Math.round(totalVol), maxWeight, maxReps, max1RM, numWorkouts: Object.keys(workoutDates).length };
  }, [sets]);

  const chartData = useMemo(() => {
    const byDay = {};
    sets.forEach(s => {
      const w = allWorkouts.find(wk => wk.id === s.workoutId);
      if (w) {
        const d = new Date(w.date).toLocaleDateString("it-IT", { month: "short", day: "numeric" });
        if (!byDay[d]) byDay[d] = 0;
        byDay[d] += (s.weight || 0) * (s.reps || 0);
      }
    });
    return Object.entries(byDay).slice(-7).map(([d, v]) => ({ name: d, volume: v }));
  }, [sets, allWorkouts]);

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:60 }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"16px 16px 12px" }}>
        <button onClick={onBack} style={{
          width:36,height:36,borderRadius:12,background:T.tealLight,border:"none",
          display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
        }}><ChevronLeft size={18} color={T.teal}/></button>
        <div style={{ fontSize:18,fontWeight:800,color:T.text }}>{info.name}</div>
      </div>

      <div style={{ padding:"0 16px" }}>
        <div style={{ background:T.card,borderRadius:14,padding:16,marginBottom:16,border:`1px solid ${T.border}`,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:20,fontWeight:900,color:T.teal }}>{stats.completed}</div>
            <div style={{ fontSize:10,color:T.textMuted,fontWeight:700,marginTop:4 }}>Set</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:20,fontWeight:900,color:T.orange }}>{stats.numWorkouts}</div>
            <div style={{ fontSize:10,color:T.textMuted,fontWeight:700,marginTop:4 }}>Sessioni</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:20,fontWeight:900,color:T.green }}>{stats.maxWeight}kg</div>
            <div style={{ fontSize:10,color:T.textMuted,fontWeight:700,marginTop:4 }}>Max</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:20,fontWeight:900,color:T.purple }}>{stats.max1RM}kg</div>
            <div style={{ fontSize:10,color:T.textMuted,fontWeight:700,marginTop:4 }}>1RM</div>
          </div>
        </div>

        {chartData.length > 0 && (
          <div style={{ background:T.card,borderRadius:14,padding:16,marginBottom:16,border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:12,fontWeight:800,color:T.text,marginBottom:12 }}>Volume (ultimi 7 giorni)</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }}/>
                <YAxis hide/>
                <Tooltip contentStyle={{ background:T.card,borderRadius:8,border:`1px solid ${T.border}` }}/>
                <Line type="monotone" dataKey="volume" stroke={T.teal} strokeWidth={2} dot={{ r: 3 }}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div style={{ fontSize:12,fontWeight:800,color:T.text,marginBottom:12 }}>Storico set</div>
        {sets.slice(0, 10).map((s, i) => {
          const w = allWorkouts.find(wk => wk.id === s.workoutId);
          return (
            <div key={i} style={{
              background:T.card,borderRadius:12,padding:12,marginBottom:8,border:`1px solid ${T.border}`,
              display:"flex",alignItems:"center",justifyContent:"space-between",
            }}>
              <div>
                <div style={{ fontSize:12,fontWeight:700,color:T.text }}>{s.weight}kg × {s.reps}</div>
                <div style={{ fontSize:10,color:T.textMuted }}>{w ? formatDate(w.date) : "Data sconosciuta"}</div>
              </div>
              <div style={{ fontSize:11,fontWeight:700,color:T.teal }}>{(s.weight||0)*(s.reps||0)} vol</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   WORKOUT CARD (history view)
   ═══════════════════════════════════════════ */
const WorkoutCard = ({ workout, sets, customExercises, onTap }) => {
  const exSet = new Set(sets.map(s => s.exerciseId));
  const exNames = Array.from(exSet).map(id => getExerciseById(id, customExercises).name).join(" • ");
  return (
    <button onClick={onTap} style={{
      width:"100%",background:T.card,borderRadius:14,padding:14,marginBottom:10,
      border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",
      cursor:"pointer",textAlign:"left",
    }}>
      <div>
        <div style={{ fontSize:13,fontWeight:700,color:T.text }}>{workout.name}</div>
        <div style={{ fontSize:10,color:T.textMuted,marginTop:4 }}>{exNames}</div>
        <div style={{ fontSize:10,color:T.textMuted,marginTop:2 }}>{formatDate(workout.date)} • {formatDuration(workout.durationMin)}</div>
      </div>
      <ChevronRight size={16} color={T.textMuted}/>
    </button>
  );
};

/* ═══════════════════════════════════════════
   WORKOUT DETAIL SCREEN
   ═══════════════════════════════════════════ */
const WorkoutDetailScreen = ({ workout, sets, customExercises, onBack, onExerciseDetail, onDelete }) => {
  const totalVol = useMemo(() => calcVolume(sets), [sets]);
  const exData = useMemo(() => {
    const map = {};
    sets.forEach(s => {
      if (!map[s.exerciseId]) map[s.exerciseId] = [];
      map[s.exerciseId].push(s);
    });
    return map;
  }, [sets]);

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:100 }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"16px 16px 12px" }}>
        <button onClick={onBack} style={{
          width:36,height:36,borderRadius:12,background:T.tealLight,border:"none",
          display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
        }}><ChevronLeft size={18} color={T.teal}/></button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16,fontWeight:800,color:T.text }}>{workout.name}</div>
          <div style={{ fontSize:11,color:T.textMuted }}>{formatDateFull(workout.date)}</div>
        </div>
        <button onClick={onDelete} style={{
          padding:"6px 8px",borderRadius:8,border:`1px solid ${T.border}`,background:T.card,cursor:"pointer",
        }}><Trash2 size={14} color={T.textMuted}/></button>
      </div>

      <div style={{ padding:"0 16px" }}>
        <div style={{ background:T.card,borderRadius:14,padding:16,marginBottom:16,border:`1px solid ${T.border}`,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12 }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:20,fontWeight:900,color:T.teal }}>{sets.length}</div>
            <div style={{ fontSize:10,color:T.textMuted,fontWeight:700,marginTop:4 }}>Set</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:20,fontWeight:900,color:T.orange }}>{Math.round(totalVol)}</div>
            <div style={{ fontSize:10,color:T.textMuted,fontWeight:700,marginTop:4 }}>Volume</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:20,fontWeight:900,color:T.green }}>{formatDuration(workout.durationMin)}</div>
            <div style={{ fontSize:10,color:T.textMuted,fontWeight:700,marginTop:4 }}>Durata</div>
          </div>
        </div>

        <div style={{ fontSize:12,fontWeight:800,color:T.text,marginBottom:12 }}>Esercizi</div>
        {Object.entries(exData).map(([exId, exSets]) => {
          const info = getExerciseById(exId, customExercises);
          return (
            <button key={exId} onClick={() => onExerciseDetail(exId)} style={{
              width:"100%",background:T.card,borderRadius:12,padding:12,marginBottom:8,border:`1px solid ${T.border}`,
              textAlign:"left",cursor:"pointer",
            }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
                <div style={{ fontSize:12,fontWeight:700,color:T.text }}>{info.name}</div>
                <div style={{ fontSize:11,fontWeight:700,color:T.textMuted }}>{exSets.length} set</div>
              </div>
              <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
                {exSets.sort((a, b) => a.order - b.order).map((s, i) => (
                  <div key={i} style={{ fontSize:10,fontWeight:700,background:T.bg,color:T.text,padding:"4px 8px",borderRadius:6 }}>
                    {s.weight}kg × {s.reps}
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   TAB: ALLENAMENTO
   ═══════════════════════════════════════════ */
const TabAllenamento = ({
  workouts, allSets, routines, customExercises,
  onStartFromRoutine, onEditRoutine, onNewRoutine, onDeleteRoutine,
  onWorkoutDetail,
}) => {
  const [showAllWorkouts, setShowAllWorkouts] = useState(false);
  const displayedWorkouts = showAllWorkouts ? workouts : workouts.slice(0, 5);

  return (
    <div style={{ padding:"12px 16px 0" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
        <div style={{ fontSize:14,fontWeight:800,color:T.text }}>Le tue Routine</div>
        <button onClick={onNewRoutine} style={{
          background:T.gradient,border:"none",borderRadius:12,padding:"10px 20px",
          fontSize:14,fontWeight:800,color:"#fff",cursor:"pointer",
          display:"flex",alignItems:"center",gap:6,
          boxShadow:"0 4px 16px rgba(2,128,144,0.3)",
        }}><Plus size={16}/> Crea</button>
      </div>

      {routines.length === 0 ? (
        <div style={{
          background:T.card,borderRadius:16,padding:24,textAlign:"center",marginBottom:16,
          border:`1px dashed ${T.border}`,
        }}>
          <div style={{ fontSize:32,marginBottom:8 }}>📋</div>
          <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:4 }}>Nessuna routine</div>
          <div style={{ fontSize:11,color:T.textMuted,marginBottom:12 }}>Crea una routine per iniziare ad allenarti</div>
          <button onClick={onNewRoutine} style={{
            background:T.teal,border:"none",borderRadius:10,padding:"10px 20px",
            color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",
          }}>Crea routine</button>
        </div>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:20 }}>
          {routines.map(r => (
            <div key={r.id} style={{
              background:T.card,borderRadius:14,padding:14,
              border:`1px solid ${T.border}`,boxShadow:T.shadow,
            }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6 }}>
                <div>
                  <div style={{ fontSize:14,fontWeight:700,color:T.text }}>{r.name}</div>
                  <div style={{ fontSize:10,color:T.textMuted,marginTop:2 }}>
                    {r.exercises.length} esercizi • {r.exercises.map(e => getExerciseById(e.exerciseId, customExercises).muscle).filter((v,i,a) => a.indexOf(v)===i).join(", ")}
                  </div>
                </div>
                <div style={{ display:"flex",gap:4 }}>
                  <button onClick={() => onEditRoutine(r)} style={{
                    padding:"6px 8px",borderRadius:8,border:`1px solid ${T.border}`,background:T.card,cursor:"pointer",
                  }}><Edit3 size={12} color={T.textMuted}/></button>
                  <button onClick={() => onDeleteRoutine(r.id)} style={{
                    padding:"6px 8px",borderRadius:8,border:`1px solid ${T.border}`,background:T.card,cursor:"pointer",
                  }}><Trash2 size={12} color={T.textMuted}/></button>
                </div>
              </div>
              <button onClick={() => onStartFromRoutine(r)} style={{
                width:"100%",padding:"10px",borderRadius:10,border:"none",background:T.gradient,
                color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",gap:6,
              }}>
                <Play size={14} fill="#fff"/> Avvia
              </button>
            </div>
          ))}
        </div>
      )}

      {workouts.length > 0 && (
        <>
          <div style={{ fontSize:14,fontWeight:800,color:T.text,marginBottom:10 }}>Storico allenamenti</div>
          {displayedWorkouts.map(w => {
            const wSets = allSets.filter(s => s.workoutId === w.id);
            return <WorkoutCard key={w.id} workout={w} sets={wSets} customExercises={customExercises}
              onTap={() => onWorkoutDetail(w)}/>;
          })}
          {workouts.length > 5 && (
            <button onClick={() => setShowAllWorkouts(v => !v)} style={{
              width:"100%",padding:10,background:"none",border:"none",cursor:"pointer",
              fontSize:12,fontWeight:700,color:T.teal,
            }}>{showAllWorkouts ? "Mostra meno" : `Vedi tutti (${workouts.length})`}</button>
          )}
        </>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   TAB: ESERCIZI
   ═══════════════════════════════════════════ */
const TabEsercizi = ({ allSets, allWorkouts, customExercises, onExerciseDetail }) => {
  const allExercises = useMemo(() => [...EXERCISES, ...customExercises], [customExercises]);
  const exStats = useMemo(() => {
    const map = {};
    allExercises.forEach(ex => {
      const sets = allSets.filter(s => s.exerciseId === ex.id);
      map[ex.id] = { count: sets.length, volume: calcVolume(sets) };
    });
    return map;
  }, [allExercises, allSets]);

  const sorted = useMemo(() => {
    return allExercises.filter(ex => exStats[ex.id].count > 0).sort((a, b) => exStats[b.id].count - exStats[a.id].count);
  }, [allExercises, exStats]);

  return (
    <div style={{ padding:"12px 16px 0" }}>
      {sorted.length === 0 ? (
        <div style={{ padding:"20px 0",textAlign:"center",color:T.textMuted,fontSize:12 }}>Nessun esercizio completato</div>
      ) : (
        <>
          <div style={{ fontSize:12,fontWeight:800,color:T.text,marginBottom:12 }}>Esercizi per volume</div>
          <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:20 }}>
            {sorted.map(ex => {
              const stat = exStats[ex.id];
              return (
                <button key={ex.id} onClick={() => onExerciseDetail(ex.id)} style={{
                  width:"100%",background:T.card,borderRadius:12,padding:12,border:`1px solid ${T.border}`,
                  textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:10,
                }}>
                  <div style={{
                    width:40,height:40,borderRadius:10,background:`${MUSCLE_COLORS[ex.muscle]||T.teal}18`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                  }}>
                    <Dumbbell size={16} color={MUSCLE_COLORS[ex.muscle]||T.teal}/>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12,fontWeight:700,color:T.text }}>{ex.name}</div>
                    <div style={{ fontSize:10,color:T.textMuted }}>{stat.count} set • {Math.round(stat.volume)} kg</div>
                  </div>
                  <ChevronRight size={16} color={T.textMuted}/>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   TAB: STATISTICHE
   ═══════════════════════════════════════════ */
const TabStatistiche = ({ workouts, allSets, customExercises }) => {
  const stats = useMemo(() => {
    const totalSets = allSets.length;
    const totalVol = Math.round(calcVolume(allSets));
    const totalWorkouts = workouts.length;
    const avgDuration = workouts.length > 0 ? Math.round(workouts.reduce((s, w) => s + w.durationMin, 0) / workouts.length) : 0;
    const exCount = new Set(allSets.map(s => s.exerciseId)).size;
    return { totalSets, totalVol, totalWorkouts, avgDuration, exCount };
  }, [workouts, allSets]);

  const volumeByMuscle = useMemo(() => {
    const map = {};
    allSets.forEach(s => {
      const ex = getExerciseById(s.exerciseId, customExercises);
      if (!map[ex.muscle]) map[ex.muscle] = 0;
      map[ex.muscle] += (s.weight || 0) * (s.reps || 0);
    });
    return Object.entries(map).map(([m, v]) => ({ name: m, value: Math.round(v) })).sort((a, b) => b.value - a.value);
  }, [allSets, customExercises]);

  const volumeOverTime = useMemo(() => {
    const map = {};
    allSets.forEach(s => {
      const w = workouts.find(wk => wk.id === s.workoutId);
      if (w) {
        const d = new Date(w.date).toLocaleDateString("it-IT", { month: "short", day: "numeric" });
        if (!map[d]) map[d] = 0;
        map[d] += (s.weight || 0) * (s.reps || 0);
      }
    });
    return Object.entries(map).slice(-14).map(([d, v]) => ({ name: d, volume: v }));
  }, [workouts, allSets]);

  return (
    <div style={{ padding:"12px 16px 0" }}>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16 }}>
        {[
          { label:"Allenamenti", value:stats.totalWorkouts, icon:"🏋️", color:T.teal },
          { label:"Set", value:stats.totalSets, icon:"💪", color:T.orange },
          { label:"Volume", value:`${stats.totalVol}kg`, icon:"📊", color:T.green },
          { label:"Esercizi", value:stats.exCount, icon:"🎯", color:T.purple },
        ].map((s, i) => (
          <div key={i} style={{
            background:T.card,borderRadius:12,padding:16,border:`1px solid ${T.border}`,textAlign:"center",
          }}>
            <div style={{ fontSize:20,marginBottom:6 }}>{s.icon}</div>
            <div style={{ fontSize:18,fontWeight:900,color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10,color:T.textMuted,fontWeight:700,marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {volumeOverTime.length > 0 && (
        <div style={{ background:T.card,borderRadius:12,padding:16,border:`1px solid ${T.border}`,marginBottom:16 }}>
          <div style={{ fontSize:12,fontWeight:800,color:T.text,marginBottom:12 }}>Volume (ultimi 14 giorni)</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={volumeOverTime}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }}/>
              <YAxis hide/>
              <Tooltip contentStyle={{ background:T.card,borderRadius:8,border:`1px solid ${T.border}` }}/>
              <Line type="monotone" dataKey="volume" stroke={T.teal} strokeWidth={2} dot={{ r: 3 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {volumeByMuscle.length > 0 && (
        <div style={{ background:T.card,borderRadius:12,padding:16,border:`1px solid ${T.border}`,marginBottom:20 }}>
          <div style={{ fontSize:12,fontWeight:800,color:T.text,marginBottom:12 }}>Volume per gruppo muscolare</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={volumeByMuscle} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                {volumeByMuscle.map((e, i) => <Cell key={i} fill={MUSCLE_COLORS[e.name]||T.teal}/>)}
              </Pie>
              <Tooltip/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   TABS DEFINITION
   ═══════════════════════════════════════════ */
const TABS = [
  { id: "allenamento", label: "Allenamento", icon: Play },
  { id: "esercizi", label: "Esercizi", icon: Dumbbell },
  { id: "statistiche", label: "Statistiche", icon: BarChart3 },
];

/* ═══════════════════════════════════════════
   MAIN SCREEN WITH TABS
   ═══════════════════════════════════════════ */
const MainScreenWithTabs = (props) => {
  const [activeTab, setActiveTab] = useState("allenamento");

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:100 }}>
      <div style={{ padding:"16px 16px 0" }}>
        <div style={{ fontSize:22,fontWeight:900,color:T.text }}>Gym</div>
        <div style={{ fontSize:12,color:T.textMuted,fontWeight:500,marginBottom:12 }}>{formatDateFull(new Date())}</div>
      </div>

      <div style={{
        display:"flex",gap:0,padding:"0 16px",marginBottom:4,
        background:T.bg,position:"sticky",top:0,zIndex:10,paddingTop:4,paddingBottom:4,
      }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex:1,padding:"10px 0",background:"none",border:"none",cursor:"pointer",
              borderBottom:`2.5px solid ${isActive?T.teal:"transparent"}`,
              display:"flex",alignItems:"center",justifyContent:"center",gap:5,
              transition:"all .2s ease",
            }}>
              <tab.icon size={14} color={isActive?T.teal:T.textMuted} strokeWidth={isActive?2.5:1.8}/>
              <span style={{ fontSize:12,fontWeight:isActive?800:600,color:isActive?T.teal:T.textMuted }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "allenamento" && <TabAllenamento {...props}/>}
      {activeTab === "esercizi" && <TabEsercizi allSets={props.allSets} allWorkouts={props.workouts}
        customExercises={props.customExercises} onExerciseDetail={props.onExerciseDetail}/>}
      {activeTab === "statistiche" && <TabStatistiche workouts={props.workouts} allSets={props.allSets}
        customExercises={props.customExercises}/>}

      <GymBottomNav onAdd={props.onAdd} onNavigate={props.onNavigate}/>
    </div>
  );
};

/* ═══════════════════════════════════════════
   ROOT EXPORT
   ═══════════════════════════════════════════ */
export default function GymSection({ onNavigate }) {
  const [subScreen, setSubScreen] = useState("main");
  const [workouts, setWorkouts] = useState([]);
  const [allSets, setAllSets] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [customExercises, setCustomExercises] = useState([]);
  const [toast, setToast] = useState(null);
  const [activeRoutine, setActiveRoutine] = useState(null);
  const [editRoutine, setEditRoutine] = useState(null);
  const [detailExerciseId, setDetailExerciseId] = useState(null);
  const [detailWorkout, setDetailWorkout] = useState(null);
  const [routineName, setRoutineName] = useState("");
  const [routineExercises, setRoutineExercises] = useState([]);

  const showToast = useCallback((msg, icon) => setToast({ msg, icon }), []);

  const loadData = useCallback(async () => {
    const [w, r, ce] = await Promise.all([
      getAllGymWorkouts(), getAllGymRoutines(), getAllGymCustomExercises(),
    ]);
    setWorkouts(w);
    setRoutines(r);
    setCustomExercises(ce);
    const setsArrays = await Promise.all(w.map(wk => getGymSetsByWorkout(wk.id)));
    setAllSets(setsArrays.flat());
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddCustomExercise = useCallback(async (ex) => {
    await addGymCustomExercise(ex);
    setCustomExercises(prev => [...prev, ex]);
  }, []);

  const handleFinishWorkout = useCallback(async (data) => {
    const workoutId = await addGymWorkout({
      date: data.date, name: data.name,
      startTime: data.startTime, endTime: data.endTime,
      durationMin: data.durationMin, routineId: activeRoutine?.id || null,
    });
    const setsToAdd = [];
    data.exercises.forEach(ex => {
      ex.sets.forEach(s => {
        setsToAdd.push({ workoutId, exerciseId: ex.exerciseId, order: s.order, weight: s.weight, reps: s.reps, type: s.type });
      });
    });
    await addGymSets(setsToAdd);
    await loadData();
    setSubScreen("main");
    setActiveRoutine(null);
    showToast("Allenamento salvato! 💪", "✅");
  }, [activeRoutine, loadData, showToast]);

  const handleDiscardWorkout = useCallback(() => {
    setSubScreen("main");
    setActiveRoutine(null);
  }, []);

  const handleStartFromRoutine = useCallback((routine) => {
    setActiveRoutine(routine);
    setSubScreen("workout");
  }, []);

  const handleSaveRoutine = useCallback(async (data) => {
    if (editRoutine?.id) await updateGymRoutine(editRoutine.id, data);
    else await addGymRoutine(data);
    await loadData();
    setSubScreen("main");
    setEditRoutine(null);
    setRoutineName("");
    setRoutineExercises([]);
    showToast(editRoutine?.id ? "Routine aggiornata" : "Routine creata!", "📋");
  }, [editRoutine, loadData, showToast]);

  const handleDeleteRoutine = useCallback(async (id) => {
    await deleteGymRoutine(id);
    await loadData();
    showToast("Routine eliminata", "🗑️");
  }, [loadData, showToast]);

  const handleDeleteWorkout = useCallback(async (id) => {
    await deleteGymWorkout(id);
    await loadData();
    setSubScreen("main");
    setDetailWorkout(null);
    showToast("Allenamento eliminato", "🗑️");
  }, [loadData, showToast]);

  const routineExercisesForWorkout = useMemo(() => {
    if (!activeRoutine) return null;
    return activeRoutine.exercises.map(ex => {
      const prevSets = allSets.filter(s => s.exerciseId === ex.exerciseId);
      let sets;
      if (prevSets.length > 0) {
        const byWorkout = {};
        prevSets.forEach(s => { if (!byWorkout[s.workoutId]) byWorkout[s.workoutId] = []; byWorkout[s.workoutId].push(s); });
        const lastWId = Object.keys(byWorkout).map(Number).sort((a, b) => b - a)[0];
        if (lastWId != null) {
          const lastSorted = byWorkout[lastWId].sort((a, b) => a.order - b.order);
          sets = lastSorted.map(s => ({ weight: s.weight||0, reps: s.reps||0, type: s.type||"N", completed: false }));
        }
      }
      if (!sets) {
        sets = Array.from({ length: ex.targetSets || 3 }, () => ({
          weight: ex.targetWeight || 0, reps: ex.targetReps || 0, type: "N", completed: false,
        }));
      }
      return { exerciseId: ex.exerciseId, restTimer: ex.restTimer || 90, warmupTimer: ex.warmupTimer || 60, sideTimer: ex.sideTimer || 30, unilateral: ex.unilateral || false, supersetWith: ex.supersetWith || null, note: ex.note || "", sets };
    });
  }, [activeRoutine, allSets]);

  if (subScreen === "workout") {
    return (
      <ActiveWorkoutScreen
        initialExercises={routineExercisesForWorkout}
        routineName={activeRoutine?.name || ""}
        onFinish={handleFinishWorkout}
        onDiscard={handleDiscardWorkout}
        onNavigate={onNavigate}
        allWorkouts={workouts}
        allSets={allSets}
        customExercises={customExercises}
        onAddCustomExercise={handleAddCustomExercise}
      />
    );
  }

  if (subScreen === "nameModal") {
    return (
      <MainScreenWithTabs
        workouts={workouts} allSets={allSets} routines={routines} customExercises={customExercises}
        onStartFromRoutine={handleStartFromRoutine}
        onEditRoutine={(r) => { setEditRoutine(r); setSubScreen("routineEditor"); }}
        onNewRoutine={() => {}}
        onDeleteRoutine={handleDeleteRoutine}
        onExerciseDetail={(exId) => { setDetailExerciseId(exId); setSubScreen("exerciseDetail"); }}
        onWorkoutDetail={(w) => { setDetailWorkout(w); setSubScreen("workoutDetail"); }}
        onNavigate={onNavigate}
        onAdd={() => {}}
      >
        <NameModal onContinue={(name) => { setRoutineName(name); setSubScreen("pickExercises"); }} onClose={() => setSubScreen("main")}/>
      </MainScreenWithTabs>
    );
  }

  if (subScreen === "pickExercises") {
    return (
      <ExercisePicker multiSelect onSelect={() => {}} onClose={() => setSubScreen("main")}
        customExercises={customExercises} onAddCustom={handleAddCustomExercise}
        onMultiSelect={(exs) => {
          setRoutineExercises(exs.map(e => ({
            exerciseId: e.id,
            sets: [{ weight: 0, reps: 0, type: "N" }],
            restTimer: 90,
            warmupTimer: 60,
            sideTimer: 30,
            unilateral: e.uni || false,
            supersetWith: null,
            note: "",
          })));
          setSubScreen("routineEditor");
        }}/>
    );
  }

  if (subScreen === "routineEditor") {
    return (
      <RoutineEditor routine={editRoutine} exercises={routineExercises} onSave={(exs) => { setRoutineExercises(exs); setSubScreen("routineSummary"); }}
        onClose={() => { setSubScreen("main"); setEditRoutine(null); setRoutineName(""); setRoutineExercises([]); }}
        customExercises={customExercises} onAddCustomExercise={handleAddCustomExercise}/>
    );
  }

  if (subScreen === "routineSummary") {
    return (
      <RoutineSummary name={routineName} exercises={routineExercises}
        onSave={async () => {
          await handleSaveRoutine({ name: routineName, exercises: routineExercises });
          setSubScreen("main");
        }}
        onBack={() => setSubScreen("routineEditor")}
        customExercises={customExercises}/>
    );
  }

  if (subScreen === "exerciseDetail" && detailExerciseId) {
    return (
      <ExerciseDetailScreen exerciseId={detailExerciseId}
        allWorkouts={workouts} allSets={allSets} customExercises={customExercises}
        onBack={() => { setSubScreen(detailWorkout ? "workoutDetail" : "main"); setDetailExerciseId(null); }}/>
    );
  }

  if (subScreen === "workoutDetail" && detailWorkout) {
    const wSets = allSets.filter(s => s.workoutId === detailWorkout.id);
    return (
      <WorkoutDetailScreen workout={detailWorkout} sets={wSets} customExercises={customExercises}
        onBack={() => { setSubScreen("main"); setDetailWorkout(null); }}
        onExerciseDetail={(exId) => { setDetailExerciseId(exId); setSubScreen("exerciseDetail"); }}
        onDelete={handleDeleteWorkout}/>
    );
  }

  return (
    <>
      <MainScreenWithTabs
        workouts={workouts} allSets={allSets} routines={routines} customExercises={customExercises}
        onStartFromRoutine={handleStartFromRoutine}
        onEditRoutine={(r) => { setEditRoutine(r); setSubScreen("routineEditor"); setRoutineExercises(r.exercises); }}
        onNewRoutine={() => { setSubScreen("nameModal"); }}
        onDeleteRoutine={handleDeleteRoutine}
        onExerciseDetail={(exId) => { setDetailExerciseId(exId); setSubScreen("exerciseDetail"); }}
        onWorkoutDetail={(w) => { setDetailWorkout(w); setSubScreen("workoutDetail"); }}
        onNavigate={onNavigate}
        onAdd={() => {
          if (routines.length > 0) handleStartFromRoutine(routines[0]);
          else setSubScreen("nameModal");
        }}
      />
      {toast && <Toast message={toast.msg} icon={toast.icon} onDismiss={() => setToast(null)}/>}
    </>
  );
}
