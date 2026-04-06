"use client";
// GymSection.jsx — Gym workout tracker (Hevy-style)
// v1 — Full workout logging, exercise library, routines, rest timer, progress charts

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import {
  ChevronLeft, Plus, Check, X, Settings, Timer, Home, Utensils, Dumbbell,
  User, Flame, TrendingUp, Search, Play, Square, RotateCcw, Trash2,
  Edit3, Copy, ChevronRight, ChevronDown, Clock, Award, Trophy,
  BarChart3, Target, Zap, Minus, MoreVertical, Pause, Footprints,
  AlertTriangle, CheckCircle2, Bookmark, FolderOpen,
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
   EXERCISE DATABASE (~50 exercises)
   ═══════════════════════════════════════════ */
const MUSCLE_GROUPS = ["Petto", "Schiena", "Spalle", "Bicipiti", "Tricipiti", "Gambe", "Core"];
const EQUIPMENT = ["Bilanciere", "Manubri", "Macchina", "Cavi", "Corpo libero"];

const EXERCISES = [
  // Petto
  { id: "bench_press",       name: "Panca Piana",          muscle: "Petto",    secondary: "Tricipiti",  equipment: "Bilanciere" },
  { id: "incline_bench",     name: "Panca Inclinata",      muscle: "Petto",    secondary: "Spalle",     equipment: "Bilanciere" },
  { id: "decline_bench",     name: "Panca Declinata",      muscle: "Petto",    secondary: "Tricipiti",  equipment: "Bilanciere" },
  { id: "db_bench",          name: "Panca Manubri",        muscle: "Petto",    secondary: "Tricipiti",  equipment: "Manubri" },
  { id: "db_incline",        name: "Inclinata Manubri",    muscle: "Petto",    secondary: "Spalle",     equipment: "Manubri" },
  { id: "chest_fly",         name: "Croci Manubri",        muscle: "Petto",    secondary: "",           equipment: "Manubri" },
  { id: "cable_fly",         name: "Croci ai Cavi",        muscle: "Petto",    secondary: "",           equipment: "Cavi" },
  { id: "chest_press",       name: "Chest Press",          muscle: "Petto",    secondary: "Tricipiti",  equipment: "Macchina" },
  { id: "pec_deck",          name: "Pec Deck",             muscle: "Petto",    secondary: "",           equipment: "Macchina" },
  // Schiena
  { id: "deadlift",          name: "Stacco da Terra",      muscle: "Schiena",  secondary: "Gambe",      equipment: "Bilanciere" },
  { id: "barbell_row",       name: "Rematore Bilanciere",  muscle: "Schiena",  secondary: "Bicipiti",   equipment: "Bilanciere" },
  { id: "db_row",            name: "Rematore Manubrio",    muscle: "Schiena",  secondary: "Bicipiti",   equipment: "Manubri" },
  { id: "lat_pulldown",      name: "Lat Machine",          muscle: "Schiena",  secondary: "Bicipiti",   equipment: "Macchina" },
  { id: "seated_row",        name: "Pulley Basso",         muscle: "Schiena",  secondary: "Bicipiti",   equipment: "Cavi" },
  { id: "cable_row",         name: "Rematore ai Cavi",     muscle: "Schiena",  secondary: "Bicipiti",   equipment: "Cavi" },
  { id: "tbar_row",          name: "T-Bar Row",            muscle: "Schiena",  secondary: "Bicipiti",   equipment: "Bilanciere" },
  { id: "pullup",            name: "Trazioni",             muscle: "Schiena",  secondary: "Bicipiti",   equipment: "Corpo libero" },
  { id: "hyperextension",    name: "Hyperextension",       muscle: "Schiena",  secondary: "Gambe",      equipment: "Corpo libero" },
  // Spalle
  { id: "ohp",               name: "Military Press",       muscle: "Spalle",   secondary: "Tricipiti",  equipment: "Bilanciere" },
  { id: "db_shoulder_press", name: "Lento Manubri",        muscle: "Spalle",   secondary: "Tricipiti",  equipment: "Manubri" },
  { id: "lateral_raise",     name: "Alzate Laterali",      muscle: "Spalle",   secondary: "",           equipment: "Manubri" },
  { id: "front_raise",       name: "Alzate Frontali",      muscle: "Spalle",   secondary: "",           equipment: "Manubri" },
  { id: "rear_delt_fly",     name: "Rear Delt Fly",        muscle: "Spalle",   secondary: "Schiena",    equipment: "Manubri" },
  { id: "face_pull",         name: "Face Pull",            muscle: "Spalle",   secondary: "Schiena",    equipment: "Cavi" },
  { id: "shrug",             name: "Scrollate",            muscle: "Spalle",   secondary: "",           equipment: "Manubri" },
  { id: "shoulder_press_m",  name: "Shoulder Press",       muscle: "Spalle",   secondary: "Tricipiti",  equipment: "Macchina" },
  // Bicipiti
  { id: "barbell_curl",      name: "Curl Bilanciere",      muscle: "Bicipiti", secondary: "",           equipment: "Bilanciere" },
  { id: "db_curl",           name: "Curl Manubri",         muscle: "Bicipiti", secondary: "",           equipment: "Manubri" },
  { id: "hammer_curl",       name: "Hammer Curl",          muscle: "Bicipiti", secondary: "",           equipment: "Manubri" },
  { id: "preacher_curl",     name: "Panca Scott",          muscle: "Bicipiti", secondary: "",           equipment: "Bilanciere" },
  { id: "cable_curl",        name: "Curl ai Cavi",         muscle: "Bicipiti", secondary: "",           equipment: "Cavi" },
  { id: "concentration_curl",name: "Curl Concentrato",     muscle: "Bicipiti", secondary: "",           equipment: "Manubri" },
  // Tricipiti
  { id: "close_grip_bench",  name: "Panca Presa Stretta",  muscle: "Tricipiti",secondary: "Petto",      equipment: "Bilanciere" },
  { id: "french_press",      name: "French Press",         muscle: "Tricipiti",secondary: "",           equipment: "Bilanciere" },
  { id: "tricep_pushdown",   name: "Push Down Cavi",       muscle: "Tricipiti",secondary: "",           equipment: "Cavi" },
  { id: "overhead_ext",      name: "Estensioni Sopra Testa",muscle:"Tricipiti",secondary: "",           equipment: "Manubri" },
  { id: "skull_crusher",     name: "Skull Crusher",        muscle: "Tricipiti",secondary: "",           equipment: "Bilanciere" },
  { id: "dip",               name: "Dip",                  muscle: "Tricipiti",secondary: "Petto",      equipment: "Corpo libero" },
  { id: "kickback",          name: "Kickback",             muscle: "Tricipiti",secondary: "",           equipment: "Manubri" },
  // Gambe
  { id: "squat",             name: "Squat",                muscle: "Gambe",    secondary: "Core",       equipment: "Bilanciere" },
  { id: "front_squat",       name: "Front Squat",          muscle: "Gambe",    secondary: "Core",       equipment: "Bilanciere" },
  { id: "leg_press",         name: "Leg Press",            muscle: "Gambe",    secondary: "",           equipment: "Macchina" },
  { id: "leg_extension",     name: "Leg Extension",        muscle: "Gambe",    secondary: "",           equipment: "Macchina" },
  { id: "leg_curl",          name: "Leg Curl",             muscle: "Gambe",    secondary: "",           equipment: "Macchina" },
  { id: "romanian_dl",       name: "Stacco Rumeno",        muscle: "Gambe",    secondary: "Schiena",    equipment: "Bilanciere" },
  { id: "lunges",            name: "Affondi",              muscle: "Gambe",    secondary: "",           equipment: "Manubri" },
  { id: "hack_squat",        name: "Hack Squat",           muscle: "Gambe",    secondary: "",           equipment: "Macchina" },
  { id: "calf_raise",        name: "Calf Raise",           muscle: "Gambe",    secondary: "",           equipment: "Macchina" },
  { id: "hip_thrust",        name: "Hip Thrust",           muscle: "Gambe",    secondary: "",           equipment: "Bilanciere" },
  { id: "adductor",          name: "Adductor Machine",     muscle: "Gambe",    secondary: "",           equipment: "Macchina" },
  { id: "abductor",          name: "Abductor Machine",     muscle: "Gambe",    secondary: "",           equipment: "Macchina" },
  // Core
  { id: "crunch",            name: "Crunch",               muscle: "Core",     secondary: "",           equipment: "Corpo libero" },
  { id: "plank",             name: "Plank",                muscle: "Core",     secondary: "",           equipment: "Corpo libero" },
  { id: "cable_crunch",      name: "Crunch ai Cavi",       muscle: "Core",     secondary: "",           equipment: "Cavi" },
  { id: "leg_raise",         name: "Leg Raise",            muscle: "Core",     secondary: "",           equipment: "Corpo libero" },
  { id: "ab_wheel",          name: "Ab Wheel",             muscle: "Core",     secondary: "",           equipment: "Corpo libero" },
];

const MUSCLE_COLORS = {
  Petto: "#EF4444", Schiena: "#3B82F6", Spalle: "#F97316", Bicipiti: "#8B5CF6",
  Tricipiti: "#EC4899", Gambe: "#16A34A", Core: "#EAB308",
};

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */
const calcVolume = (sets) => sets.reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0);
const calc1RM = (w, r) => r === 1 ? w : Math.round(w * (1 + r / 30));

const getExerciseById = (id, customExercises = []) => {
  return EXERCISES.find(e => e.id === id) || customExercises.find(e => e.id === id) || { id, name: id, muscle: "Altro", secondary: "", equipment: "" };
};

/* ═══════════════════════════════════════════
   BOTTOM NAV (consistent with FitnessSection)
   ═══════════════════════════════════════════ */
const GymBottomNav = ({ onAdd, onNavigate }) => {
  const tabs = [
    { id: "dashboard", Icon: Home,     label: "Home" },
    { id: "food",      Icon: Utensils, label: "Cibo" },
    { id: "add",       Icon: null,     label: "" },
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
  useEffect(() => { const t = setTimeout(onDismiss, action ? 5000 : 3000); return () => clearTimeout(t); }, [onDismiss, action]);
  return (
    <div style={{
      position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:100,
      background:T.text,color:"#fff",borderRadius:14,padding:"10px 18px",
      display:"flex",alignItems:"center",gap:10,boxShadow:"0 8px 32px rgba(0,0,0,0.25)",
      animation:"slideDown .3s ease-out",maxWidth:"90vw",
    }}>
      {icon && <span style={{ fontSize:18 }}>{icon}</span>}
      <span style={{ fontSize:13,fontWeight:600 }}>{message}</span>
      {action && (
        <button onClick={onAction} style={{
          background:"rgba(255,255,255,0.15)",border:"none",borderRadius:8,
          padding:"4px 10px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",marginLeft:4,
        }}>{action}</button>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   REST TIMER OVERLAY
   ═══════════════════════════════════════════ */
const RestTimerOverlay = ({ seconds, onSkip, onAddTime }) => {
  const [remaining, setRemaining] = useState(seconds);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    if (remaining <= 0) { onSkip(); return; }
    const t = setInterval(() => setRemaining(r => r - 1), 1000);
    return () => clearInterval(t);
  }, [remaining, isPaused, onSkip]);

  const pct = ((seconds - remaining) / seconds) * 100;

  return (
    <div style={{
      position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",zIndex:50,
      background:"linear-gradient(135deg, #1A1A2E, #2D2D44)",borderRadius:20,
      padding:"16px 24px",display:"flex",alignItems:"center",gap:16,
      boxShadow:"0 8px 40px rgba(0,0,0,0.4)",minWidth:300,
      animation:"slideUp .3s ease-out",
    }}>
      {/* Circular progress */}
      <div style={{ position:"relative",width:56,height:56,flexShrink:0 }}>
        <svg width={56} height={56} style={{ transform:"rotate(-90deg)" }}>
          <circle cx={28} cy={28} r={24} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={4}/>
          <circle cx={28} cy={28} r={24} fill="none" stroke={T.teal} strokeWidth={4}
            strokeDasharray={150.8} strokeDashoffset={150.8 * (1 - pct / 100)}
            strokeLinecap="round" style={{ transition:"stroke-dashoffset .5s linear" }}/>
        </svg>
        <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <span style={{ fontSize:16,fontWeight:800,color:"#fff" }}>{formatTimer(remaining)}</span>
        </div>
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",marginBottom:4 }}>RIPOSO</div>
        <div style={{ display:"flex",gap:8 }}>
          <button onClick={() => setIsPaused(p => !p)} style={{
            background:"rgba(255,255,255,0.1)",border:"none",borderRadius:10,
            padding:"6px 12px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",
            display:"flex",alignItems:"center",gap:4,
          }}>
            {isPaused ? <Play size={12}/> : <Pause size={12}/>}
            {isPaused ? "Riprendi" : "Pausa"}
          </button>
          <button onClick={() => setRemaining(r => r + 30)} style={{
            background:"rgba(255,255,255,0.1)",border:"none",borderRadius:10,
            padding:"6px 12px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",
          }}>+30s</button>
          <button onClick={onSkip} style={{
            background:T.teal,border:"none",borderRadius:10,
            padding:"6px 12px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",
          }}>Salta</button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   EXERCISE PICKER SHEET
   ═══════════════════════════════════════════ */
const ExercisePicker = ({ onSelect, onClose, customExercises, onAddCustom }) => {
  const [search, setSearch] = useState("");
  const [filterMuscle, setFilterMuscle] = useState(null);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customMuscle, setCustomMuscle] = useState("Petto");
  const [customEquip, setCustomEquip] = useState("Bilanciere");

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
    const ex = {
      id: "custom_" + Date.now(),
      name: customName.trim(),
      muscle: customMuscle,
      secondary: "",
      equipment: customEquip,
    };
    onAddCustom(ex);
    onSelect(ex);
  };

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

      {/* Search */}
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

      {/* Muscle group chips */}
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

      {/* Exercise list */}
      <div style={{ flex:1,overflowY:"auto",padding:"0 16px" }}>
        {filtered.map(ex => (
          <button key={ex.id} onClick={() => onSelect(ex)} style={{
            width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 14px",
            background:T.card,border:`1px solid ${T.border}`,borderRadius:14,marginBottom:8,
            cursor:"pointer",textAlign:"left",
          }}>
            <div style={{
              width:38,height:38,borderRadius:10,
              background:MUSCLE_COLORS[ex.muscle]||T.teal,opacity:0.15,
              display:"flex",alignItems:"center",justifyContent:"center",position:"relative",
            }}>
              <div style={{
                position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",
              }}>
                <Dumbbell size={16} color={MUSCLE_COLORS[ex.muscle]||T.teal}/>
              </div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13,fontWeight:700,color:T.text }}>{ex.name}</div>
              <div style={{ fontSize:10,color:T.textMuted }}>{ex.muscle}{ex.secondary?` • ${ex.secondary}`:""} • {ex.equipment}</div>
            </div>
            <Plus size={16} color={T.teal}/>
          </button>
        ))}

        {/* Add custom */}
        {!showAddCustom ? (
          <button onClick={() => setShowAddCustom(true)} style={{
            width:"100%",padding:"12px",background:T.tealLight,border:`1px dashed ${T.teal}`,
            borderRadius:14,cursor:"pointer",fontSize:12,fontWeight:700,color:T.teal,
            display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:20,
          }}>
            <Plus size={14}/> Crea esercizio personalizzato
          </button>
        ) : (
          <div style={{ background:T.card,borderRadius:14,padding:16,border:`1px solid ${T.border}`,marginBottom:20 }}>
            <div style={{ fontSize:12,fontWeight:700,color:T.text,marginBottom:10 }}>Nuovo esercizio</div>
            <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Nome esercizio"
              style={{
                width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${T.border}`,
                fontSize:13,color:T.text,marginBottom:8,fontFamily:"inherit",boxSizing:"border-box",
              }}/>
            <div style={{ display:"flex",gap:8,marginBottom:10 }}>
              <select value={customMuscle} onChange={e => setCustomMuscle(e.target.value)}
                style={{ flex:1,padding:"8px 10px",borderRadius:10,border:`1px solid ${T.border}`,fontSize:12,color:T.text,fontFamily:"inherit" }}>
                {MUSCLE_GROUPS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={customEquip} onChange={e => setCustomEquip(e.target.value)}
                style={{ flex:1,padding:"8px 10px",borderRadius:10,border:`1px solid ${T.border}`,fontSize:12,color:T.text,fontFamily:"inherit" }}>
                {EQUIPMENT.map(eq => <option key={eq} value={eq}>{eq}</option>)}
              </select>
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={() => setShowAddCustom(false)} style={{
                flex:1,padding:"10px",borderRadius:10,border:`1px solid ${T.border}`,background:T.card,
                fontSize:12,fontWeight:700,color:T.textSec,cursor:"pointer",
              }}>Annulla</button>
              <button onClick={handleAddCustom} style={{
                flex:1,padding:"10px",borderRadius:10,border:"none",background:T.teal,
                fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",
              }}>Aggiungi</button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
};

/* ═══════════════════════════════════════════
   ACTIVE WORKOUT SCREEN
   ═══════════════════════════════════════════ */
const SET_TYPES = [
  { id: "N", label: "N", color: T.text, name: "Normale" },
  { id: "W", label: "W", color: "#EAB308", name: "Warmup" },
  { id: "D", label: "D", color: T.purple, name: "Drop set" },
  { id: "F", label: "F", color: T.red, name: "Failure" },
];

const ActiveWorkoutScreen = ({
  initialExercises, routineName, onFinish, onDiscard, onNavigate,
  allWorkouts, allSets, customExercises, onAddCustomExercise, restTimerDefault,
}) => {
  const [workoutName, setWorkoutName] = useState(routineName || "");
  const [exercises, setExercises] = useState(initialExercises || []);
  // exercises: [{ exerciseId, sets: [{ weight, reps, type, completed }] }]
  const [showPicker, setShowPicker] = useState(!initialExercises || initialExercises.length === 0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [restTimer, setRestTimer] = useState(null); // seconds remaining or null
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const startRef = useRef(Date.now());

  // Workout timer
  useEffect(() => {
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Get previous workout data for each exercise
  const prevData = useMemo(() => {
    const map = {};
    if (!allWorkouts || !allSets) return map;
    // For each exercise in current workout, find the last workout containing it
    exercises.forEach(ex => {
      const exSets = allSets.filter(s => s.exerciseId === ex.exerciseId);
      if (exSets.length === 0) return;
      // Group by workoutId, pick the latest
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
    setExercises(prev => [...prev, {
      exerciseId: ex.id,
      sets: [{ weight: 0, reps: 0, type: "N", completed: false }],
    }]);
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
    const set = exercises[exIdx].sets[setIdx];
    const newCompleted = !set.completed;
    updateSet(exIdx, setIdx, "completed", newCompleted);
    if (newCompleted && restTimerDefault > 0) {
      setRestTimer(restTimerDefault);
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

  const removeExercise = (exIdx) => {
    setExercises(prev => prev.filter((_, i) => i !== exIdx));
  };

  const cycleSetType = (exIdx, setIdx) => {
    const types = ["N", "W", "D", "F"];
    const cur = exercises[exIdx].sets[setIdx].type;
    const next = types[(types.indexOf(cur) + 1) % types.length];
    updateSet(exIdx, setIdx, "type", next);
  };

  const totalVolume = useMemo(() => {
    return exercises.reduce((sum, ex) =>
      sum + ex.sets.filter(s => s.completed).reduce((ss, s) => ss + (s.weight || 0) * (s.reps || 0), 0), 0);
  }, [exercises]);

  const totalSetsCompleted = useMemo(() => {
    return exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0);
  }, [exercises]);

  const handleFinish = () => {
    const durationMin = Math.round(elapsedSec / 60);
    const completedExercises = exercises.filter(ex => ex.sets.some(s => s.completed));
    if (completedExercises.length === 0) {
      onDiscard();
      return;
    }
    onFinish({
      name: workoutName || `Allenamento ${formatDate(new Date())}`,
      date: todayISO(),
      startTime: new Date(startRef.current).toISOString(),
      endTime: new Date().toISOString(),
      durationMin,
      exercises: completedExercises.map(ex => ({
        exerciseId: ex.exerciseId,
        sets: ex.sets.filter(s => s.completed).map((s, i) => ({
          order: i,
          weight: s.weight || 0,
          reps: s.reps || 0,
          type: s.type,
        })),
      })),
    });
  };

  if (showPicker) {
    return <ExercisePicker onSelect={addExercise} onClose={() => {
      if (exercises.length === 0) onDiscard();
      else setShowPicker(false);
    }} customExercises={customExercises} onAddCustom={onAddCustomExercise}/>;
  }

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:110 }}>
      {/* Header */}
      <div style={{ position:"sticky",top:0,zIndex:10,background:T.bg,padding:"12px 16px",
        display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <button onClick={() => setShowDiscardConfirm(true)} style={{
            width:36,height:36,borderRadius:12,background:"#FEE2E2",border:"none",
            display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
          }}><X size={18} color={T.red}/></button>
          <div>
            <input value={workoutName} onChange={e => setWorkoutName(e.target.value)}
              placeholder="Nome allenamento" style={{
                border:"none",outline:"none",fontSize:16,fontWeight:800,color:T.text,
                background:"transparent",width:180,fontFamily:"inherit",
              }}/>
            <div style={{ fontSize:11,color:T.textMuted,fontWeight:600 }}>
              <Clock size={10} style={{ marginRight:3,verticalAlign:"middle" }}/>{formatTimer(elapsedSec)}
              {" • "}{totalSetsCompleted} serie • {Math.round(totalVolume).toLocaleString()} kg
            </div>
          </div>
        </div>
        <button onClick={() => setShowFinishConfirm(true)} style={{
          background:T.teal,border:"none",borderRadius:12,padding:"10px 18px",
          color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",
        }}>Termina</button>
      </div>

      {/* Exercise blocks */}
      <div style={{ padding:"0 16px" }}>
        {exercises.map((ex, exIdx) => {
          const info = getExerciseById(ex.exerciseId, customExercises);
          const prev = prevData[ex.exerciseId];
          return (
            <div key={exIdx} style={{
              background:T.card,borderRadius:16,padding:16,marginBottom:12,
              boxShadow:T.shadow,border:`1px solid ${T.border}`,
            }}>
              {/* Exercise header */}
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:14,fontWeight:800,color:MUSCLE_COLORS[info.muscle]||T.teal }}>{info.name}</div>
                  <div style={{ fontSize:10,color:T.textMuted }}>{info.muscle} • {info.equipment}</div>
                </div>
                <button onClick={() => removeExercise(exIdx)} style={{
                  background:"none",border:"none",cursor:"pointer",padding:4,
                }}><Trash2 size={16} color={T.textMuted}/></button>
              </div>

              {/* Sets table header */}
              <div style={{ display:"grid",gridTemplateColumns:"32px 1fr 70px 70px 40px",gap:4,marginBottom:6,
                fontSize:9,fontWeight:700,color:T.textMuted,textTransform:"uppercase",paddingLeft:4 }}>
                <span>Serie</span><span>Prec.</span><span style={{textAlign:"center"}}>Kg</span>
                <span style={{textAlign:"center"}}>Reps</span><span></span>
              </div>

              {/* Sets */}
              {ex.sets.map((set, setIdx) => {
                const typeObj = SET_TYPES.find(t => t.id === set.type) || SET_TYPES[0];
                const prevSet = prev && prev[setIdx];
                return (
                  <div key={setIdx} style={{
                    display:"grid",gridTemplateColumns:"32px 1fr 70px 70px 40px",gap:4,
                    alignItems:"center",marginBottom:4,
                    background: set.completed ? `${T.teal}08` : "transparent",
                    borderRadius:10,padding:"4px 4px",
                  }}>
                    {/* Set type badge */}
                    <button onClick={() => cycleSetType(exIdx, setIdx)} style={{
                      width:24,height:24,borderRadius:8,border:"none",cursor:"pointer",
                      background:typeObj.color+"18",color:typeObj.color,
                      fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",
                    }}>{typeObj.label}</button>

                    {/* Previous */}
                    <span style={{ fontSize:11,color:T.textMuted,fontWeight:500 }}>
                      {prevSet ? `${prevSet.weight}×${prevSet.reps}` : "—"}
                    </span>

                    {/* Weight input */}
                    <input type="number" value={set.weight || ""} onChange={e => updateSet(exIdx, setIdx, "weight", parseFloat(e.target.value) || 0)}
                      placeholder="0" style={{
                        width:"100%",padding:"8px 6px",borderRadius:10,
                        border:`1px solid ${set.completed?T.teal:T.border}`,
                        fontSize:14,fontWeight:700,color:T.text,textAlign:"center",
                        background:set.completed?"#F0FDF4":"#fff",fontFamily:"inherit",boxSizing:"border-box",
                      }}/>

                    {/* Reps input */}
                    <input type="number" value={set.reps || ""} onChange={e => updateSet(exIdx, setIdx, "reps", parseInt(e.target.value) || 0)}
                      placeholder="0" style={{
                        width:"100%",padding:"8px 6px",borderRadius:10,
                        border:`1px solid ${set.completed?T.teal:T.border}`,
                        fontSize:14,fontWeight:700,color:T.text,textAlign:"center",
                        background:set.completed?"#F0FDF4":"#fff",fontFamily:"inherit",boxSizing:"border-box",
                      }}/>

                    {/* Complete checkbox */}
                    <button onClick={() => toggleComplete(exIdx, setIdx)} style={{
                      width:32,height:32,borderRadius:10,border:`2px solid ${set.completed?T.teal:T.border}`,
                      background:set.completed?T.teal:"#fff",cursor:"pointer",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      transition:"all .2s ease",
                    }}>
                      {set.completed && <Check size={16} color="#fff" strokeWidth={3}/>}
                    </button>
                  </div>
                );
              })}

              {/* Add/remove set buttons */}
              <div style={{ display:"flex",gap:8,marginTop:8 }}>
                <button onClick={() => addSet(exIdx)} style={{
                  flex:1,padding:"8px",borderRadius:10,border:`1px solid ${T.border}`,
                  background:T.card,cursor:"pointer",fontSize:11,fontWeight:700,color:T.teal,
                  display:"flex",alignItems:"center",justifyContent:"center",gap:4,
                }}>
                  <Plus size={12}/> Serie
                </button>
                {ex.sets.length > 1 && (
                  <button onClick={() => removeSet(exIdx, ex.sets.length - 1)} style={{
                    padding:"8px 12px",borderRadius:10,border:`1px solid ${T.border}`,
                    background:T.card,cursor:"pointer",fontSize:11,fontWeight:700,color:T.textMuted,
                  }}>
                    <Minus size={12}/>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add exercise button */}
        <button onClick={() => setShowPicker(true)} style={{
          width:"100%",padding:"14px",background:T.tealLight,border:`1px dashed ${T.teal}`,
          borderRadius:14,cursor:"pointer",fontSize:13,fontWeight:700,color:T.teal,
          display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:16,
        }}>
          <Plus size={16}/> Aggiungi Esercizio
        </button>
      </div>

      {/* Rest timer overlay */}
      {restTimer && (
        <RestTimerOverlay seconds={restTimer} onSkip={() => setRestTimer(null)}/>
      )}

      {/* Finish confirmation */}
      {showFinishConfirm && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:70,
          display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
          <div style={{ background:T.card,borderRadius:20,padding:24,maxWidth:340,width:"100%" }}>
            <div style={{ fontSize:18,fontWeight:800,color:T.text,marginBottom:4 }}>Termina allenamento?</div>
            <div style={{ fontSize:13,color:T.textMuted,marginBottom:16 }}>
              Durata: {formatDuration(Math.round(elapsedSec / 60))} • {totalSetsCompleted} serie • {Math.round(totalVolume).toLocaleString()} kg volume
            </div>
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={() => setShowFinishConfirm(false)} style={{
                flex:1,padding:12,borderRadius:12,border:`1px solid ${T.border}`,background:T.card,
                fontSize:13,fontWeight:700,color:T.textSec,cursor:"pointer",
              }}>Continua</button>
              <button onClick={handleFinish} style={{
                flex:1,padding:12,borderRadius:12,border:"none",background:T.teal,
                fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",
              }}>Termina</button>
            </div>
          </div>
        </div>
      )}

      {/* Discard confirmation */}
      {showDiscardConfirm && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:70,
          display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
          <div style={{ background:T.card,borderRadius:20,padding:24,maxWidth:340,width:"100%" }}>
            <div style={{ fontSize:18,fontWeight:800,color:T.text,marginBottom:4 }}>Scartare allenamento?</div>
            <div style={{ fontSize:13,color:T.textMuted,marginBottom:16 }}>Tutti i dati di questo allenamento andranno persi.</div>
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={() => setShowDiscardConfirm(false)} style={{
                flex:1,padding:12,borderRadius:12,border:`1px solid ${T.border}`,background:T.card,
                fontSize:13,fontWeight:700,color:T.textSec,cursor:"pointer",
              }}>Annulla</button>
              <button onClick={onDiscard} style={{
                flex:1,padding:12,borderRadius:12,border:"none",background:T.red,
                fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",
              }}>Scarta</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes slideDown { from { opacity:0; transform: translateX(-50%) translateY(-20px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }
      `}</style>
    </div>
  );
};

/* ═══════════════════════════════════════════
   ROUTINE EDITOR
   ═══════════════════════════════════════════ */
const RoutineEditor = ({ routine, onSave, onClose, customExercises, onAddCustomExercise }) => {
  const [name, setName] = useState(routine?.name || "");
  const [exercises, setExercises] = useState(routine?.exercises || []);
  const [showPicker, setShowPicker] = useState(false);

  const addExercise = (ex) => {
    setExercises(prev => [...prev, { exerciseId: ex.id, targetSets: 3, targetReps: 10, targetWeight: 0 }]);
    setShowPicker(false);
  };

  const updateExField = (idx, field, value) => {
    setExercises(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const removeExercise = (idx) => {
    setExercises(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    if (!name.trim() || exercises.length === 0) return;
    onSave({ name: name.trim(), exercises });
  };

  if (showPicker) {
    return <ExercisePicker onSelect={addExercise} onClose={() => setShowPicker(false)}
      customExercises={customExercises} onAddCustom={onAddCustomExercise}/>;
  }

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:100 }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"16px 16px 12px" }}>
        <button onClick={onClose} style={{
          width:36,height:36,borderRadius:12,background:T.tealLight,border:"none",
          display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
        }}><ChevronLeft size={18} color={T.teal}/></button>
        <div style={{ fontSize:18,fontWeight:800,color:T.text }}>{routine ? "Modifica" : "Nuova"} Routine</div>
        <button onClick={handleSave} style={{
          marginLeft:"auto",background:T.teal,border:"none",borderRadius:10,padding:"8px 16px",
          color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",opacity:(!name.trim()||exercises.length===0)?0.5:1,
        }}>Salva</button>
      </div>

      <div style={{ padding:"0 16px" }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome routine (es. Push Day)"
          style={{
            width:"100%",padding:"12px 14px",borderRadius:12,border:`1px solid ${T.border}`,
            fontSize:15,fontWeight:600,color:T.text,marginBottom:16,fontFamily:"inherit",boxSizing:"border-box",
          }}/>

        {exercises.map((ex, idx) => {
          const info = getExerciseById(ex.exerciseId, customExercises);
          return (
            <div key={idx} style={{
              background:T.card,borderRadius:14,padding:14,marginBottom:10,
              border:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12,
            }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13,fontWeight:700,color:T.text }}>{info.name}</div>
                <div style={{ display:"flex",gap:10,marginTop:6 }}>
                  {[
                    { label:"Serie", field:"targetSets", val:ex.targetSets },
                    { label:"Reps", field:"targetReps", val:ex.targetReps },
                    { label:"Kg", field:"targetWeight", val:ex.targetWeight },
                  ].map(f => (
                    <div key={f.field} style={{ display:"flex",alignItems:"center",gap:4 }}>
                      <span style={{ fontSize:9,color:T.textMuted,fontWeight:600 }}>{f.label}</span>
                      <input type="number" value={f.val || ""} onChange={e => updateExField(idx, f.field, parseFloat(e.target.value) || 0)}
                        style={{
                          width:44,padding:"4px 6px",borderRadius:8,border:`1px solid ${T.border}`,
                          fontSize:12,fontWeight:700,color:T.text,textAlign:"center",fontFamily:"inherit",
                        }}/>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => removeExercise(idx)} style={{
                background:"none",border:"none",cursor:"pointer",padding:4,
              }}><Trash2 size={14} color={T.textMuted}/></button>
            </div>
          );
        })}

        <button onClick={() => setShowPicker(true)} style={{
          width:"100%",padding:"12px",background:T.tealLight,border:`1px dashed ${T.teal}`,
          borderRadius:14,cursor:"pointer",fontSize:12,fontWeight:700,color:T.teal,
          display:"flex",alignItems:"center",justifyContent:"center",gap:6,
        }}>
          <Plus size={14}/> Aggiungi Esercizio
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   EXERCISE DETAIL (progress + history)
   ═══════════════════════════════════════════ */
const ExerciseDetailScreen = ({ exerciseId, allWorkouts, allSets, customExercises, onBack }) => {
  const info = getExerciseById(exerciseId, customExercises);

  const history = useMemo(() => {
    const exSets = allSets.filter(s => s.exerciseId === exerciseId);
    const byWorkout = {};
    exSets.forEach(s => {
      if (!byWorkout[s.workoutId]) byWorkout[s.workoutId] = [];
      byWorkout[s.workoutId].push(s);
    });
    return Object.entries(byWorkout).map(([wId, sets]) => {
      const workout = allWorkouts.find(w => w.id === parseInt(wId));
      return {
        workoutId: parseInt(wId),
        date: workout?.date || "",
        sets: sets.sort((a, b) => a.order - b.order),
        volume: sets.reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0),
        maxWeight: Math.max(...sets.map(s => s.weight || 0)),
        best1RM: Math.max(...sets.map(s => calc1RM(s.weight || 0, s.reps || 0))),
      };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [exerciseId, allWorkouts, allSets]);

  const chartData = useMemo(() => {
    return [...history].reverse().slice(-20).map(h => ({
      date: formatDate(h.date),
      volume: h.volume,
      max1RM: h.best1RM,
      maxWeight: h.maxWeight,
    }));
  }, [history]);

  const prs = useMemo(() => {
    if (history.length === 0) return null;
    return {
      maxWeight: Math.max(...history.map(h => h.maxWeight)),
      maxVolume: Math.max(...history.map(h => h.volume)),
      max1RM: Math.max(...history.map(h => h.best1RM)),
      totalSessions: history.length,
    };
  }, [history]);

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:100 }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"16px 16px 12px" }}>
        <button onClick={onBack} style={{
          width:36,height:36,borderRadius:12,background:T.tealLight,border:"none",
          display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
        }}><ChevronLeft size={18} color={T.teal}/></button>
        <div>
          <div style={{ fontSize:18,fontWeight:800,color:T.text }}>{info.name}</div>
          <div style={{ fontSize:11,color:T.textMuted }}>{info.muscle} • {info.equipment}</div>
        </div>
      </div>

      <div style={{ padding:"0 16px" }}>
        {/* PR cards */}
        {prs && (
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16 }}>
            {[
              { label:"Peso Max", value:`${prs.maxWeight} kg`, icon:"🏋️" },
              { label:"1RM Stimato", value:`${prs.max1RM} kg`, icon:"💪" },
              { label:"Volume Max", value:`${prs.maxVolume.toLocaleString()} kg`, icon:"📊" },
            ].map((pr, i) => (
              <div key={i} style={{
                background:T.card,borderRadius:14,padding:12,textAlign:"center",
                border:`1px solid ${T.border}`,boxShadow:T.shadow,
              }}>
                <div style={{ fontSize:18,marginBottom:4 }}>{pr.icon}</div>
                <div style={{ fontSize:14,fontWeight:800,color:T.text }}>{pr.value}</div>
                <div style={{ fontSize:9,color:T.textMuted,fontWeight:600 }}>{pr.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Volume chart */}
        {chartData.length > 1 && (
          <div style={{ background:T.card,borderRadius:16,padding:16,marginBottom:16,border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:12,fontWeight:700,color:T.text,marginBottom:12 }}>Volume nel tempo</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize:9 }} tickLine={false} axisLine={false}/>
                <Tooltip formatter={(v) => [`${v.toLocaleString()} kg`, "Volume"]}
                  contentStyle={{ borderRadius:10,fontSize:11,border:`1px solid ${T.border}` }}/>
                <Bar dataKey="volume" fill={T.teal} radius={[6,6,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 1RM chart */}
        {chartData.length > 1 && (
          <div style={{ background:T.card,borderRadius:16,padding:16,marginBottom:16,border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:12,fontWeight:700,color:T.text,marginBottom:12 }}>1RM Stimato</div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize:9 }} tickLine={false} axisLine={false}/>
                <Tooltip formatter={(v) => [`${v} kg`, "1RM"]}
                  contentStyle={{ borderRadius:10,fontSize:11,border:`1px solid ${T.border}` }}/>
                <Line type="monotone" dataKey="max1RM" stroke={T.purple} strokeWidth={2} dot={{ r:3 }}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* History */}
        <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:10 }}>Storico ({history.length} sessioni)</div>
        {history.slice(0, 20).map((h, i) => (
          <div key={i} style={{
            background:T.card,borderRadius:14,padding:12,marginBottom:8,
            border:`1px solid ${T.border}`,
          }}>
            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
              <span style={{ fontSize:12,fontWeight:700,color:T.text }}>{formatDateFull(h.date)}</span>
              <span style={{ fontSize:11,color:T.textMuted }}>{h.volume.toLocaleString()} kg vol</span>
            </div>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {h.sets.map((s, j) => (
                <span key={j} style={{
                  fontSize:11,fontWeight:600,color:T.textSec,
                  background:T.bg,padding:"3px 8px",borderRadius:6,
                }}>{s.weight}×{s.reps}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <GymBottomNav onAdd={() => {}} onNavigate={onBack}/>
    </div>
  );
};

/* ═══════════════════════════════════════════
   WORKOUT SUMMARY CARD
   ═══════════════════════════════════════════ */
const WorkoutCard = ({ workout, sets, customExercises, onTap }) => {
  const exerciseGroups = useMemo(() => {
    const byEx = {};
    sets.forEach(s => {
      if (!byEx[s.exerciseId]) byEx[s.exerciseId] = [];
      byEx[s.exerciseId].push(s);
    });
    return Object.entries(byEx).map(([exId, exSets]) => ({
      info: getExerciseById(exId, customExercises),
      setsCount: exSets.length,
      bestSet: exSets.reduce((best, s) => (s.weight || 0) > (best.weight || 0) ? s : best, exSets[0]),
    }));
  }, [sets, customExercises]);

  const volume = calcVolume(sets);

  return (
    <button onClick={onTap} style={{
      width:"100%",background:T.card,borderRadius:16,padding:16,marginBottom:10,
      border:`1px solid ${T.border}`,boxShadow:T.shadow,cursor:"pointer",textAlign:"left",
    }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
        <div>
          <div style={{ fontSize:14,fontWeight:800,color:T.text }}>{workout.name}</div>
          <div style={{ fontSize:11,color:T.textMuted,marginTop:2 }}>
            {formatDateFull(workout.date)} • {formatDuration(workout.durationMin)}
          </div>
        </div>
        <div style={{ fontSize:12,fontWeight:700,color:T.teal }}>{volume.toLocaleString()} kg</div>
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
        {exerciseGroups.slice(0, 4).map((g, i) => (
          <div key={i} style={{ fontSize:11,color:T.textSec }}>
            <span style={{ fontWeight:600 }}>{g.setsCount}×</span> {g.info.name}
            <span style={{ color:T.textMuted }}> — {g.bestSet.weight}kg × {g.bestSet.reps}</span>
          </div>
        ))}
        {exerciseGroups.length > 4 && (
          <div style={{ fontSize:10,color:T.textMuted }}>+{exerciseGroups.length - 4} altri esercizi</div>
        )}
      </div>
    </button>
  );
};

/* ═══════════════════════════════════════════
   MAIN SCREEN (Home Gym)
   ═══════════════════════════════════════════ */
const MainScreen = ({
  workouts, allSets, routines, customExercises,
  onStartWorkout, onStartFromRoutine, onEditRoutine, onNewRoutine, onDeleteRoutine,
  onExerciseDetail, onWorkoutDetail, onNavigate, onAdd,
}) => {
  const [showAllWorkouts, setShowAllWorkouts] = useState(false);

  // Stats this week
  const weekStats = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(monday.getDate() - ((now.getDay() + 6) % 7));
    const monISO = toISO(monday);
    const weekW = workouts.filter(w => w.date >= monISO);
    const weekS = allSets.filter(s => weekW.some(w => w.id === s.workoutId));
    return {
      count: weekW.length,
      volume: calcVolume(weekS),
      duration: weekW.reduce((s, w) => s + (w.durationMin || 0), 0),
    };
  }, [workouts, allSets]);

  // Muscle distribution (last 4 weeks)
  const muscleData = useMemo(() => {
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const cutoff = toISO(fourWeeksAgo);
    const recentW = workouts.filter(w => w.date >= cutoff);
    const recentS = allSets.filter(s => recentW.some(w => w.id === s.workoutId));
    const byMuscle = {};
    recentS.forEach(s => {
      const info = getExerciseById(s.exerciseId, customExercises);
      const m = info.muscle;
      byMuscle[m] = (byMuscle[m] || 0) + (s.weight || 0) * (s.reps || 0);
    });
    return Object.entries(byMuscle).map(([name, value]) => ({
      name, value: Math.round(value), fill: MUSCLE_COLORS[name] || T.teal,
    })).sort((a, b) => b.value - a.value);
  }, [workouts, allSets, customExercises]);

  const totalMuscleVol = muscleData.reduce((s, d) => s + d.value, 0);
  const displayedWorkouts = showAllWorkouts ? workouts : workouts.slice(0, 5);

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:100 }}>
      {/* Header */}
      <div style={{ padding:"16px 16px 0",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:22,fontWeight:900,color:T.text }}>Gym</div>
          <div style={{ fontSize:12,color:T.textMuted,fontWeight:500 }}>{formatDateFull(new Date())}</div>
        </div>
      </div>

      <div style={{ padding:"12px 16px 0" }}>
        {/* Weekly stats */}
        <div style={{
          background:T.gradient,borderRadius:20,padding:20,marginBottom:16,
          display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,
        }}>
          {[
            { label:"Allenamenti", value:weekStats.count, icon:"🏋️" },
            { label:"Volume", value:`${Math.round(weekStats.volume/1000)}k`, icon:"📊" },
            { label:"Tempo", value:formatDuration(weekStats.duration), icon:"⏱" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign:"center" }}>
              <div style={{ fontSize:18,marginBottom:2 }}>{s.icon}</div>
              <div style={{ fontSize:20,fontWeight:900,color:"#fff" }}>{s.value}</div>
              <div style={{ fontSize:9,color:"rgba(255,255,255,0.7)",fontWeight:600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Start workout button */}
        <button onClick={onStartWorkout} style={{
          width:"100%",padding:"16px",background:T.card,borderRadius:16,border:`2px solid ${T.teal}`,
          cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          marginBottom:16,boxShadow:T.shadow,
        }}>
          <Play size={18} color={T.teal} fill={T.teal}/>
          <span style={{ fontSize:15,fontWeight:800,color:T.teal }}>Inizia Allenamento</span>
        </button>

        {/* Routines */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
          <div style={{ fontSize:13,fontWeight:700,color:T.text }}>📋 Le tue Routine</div>
          <button onClick={onNewRoutine} style={{
            background:T.tealLight,border:"none",borderRadius:8,padding:"4px 10px",
            fontSize:11,fontWeight:700,color:T.teal,cursor:"pointer",
          }}>+ Nuova</button>
        </div>

        {routines.length === 0 ? (
          <div style={{
            background:T.card,borderRadius:14,padding:20,textAlign:"center",marginBottom:16,
            border:`1px dashed ${T.border}`,
          }}>
            <div style={{ fontSize:11,color:T.textMuted }}>Nessuna routine salvata</div>
            <button onClick={onNewRoutine} style={{
              background:T.teal,border:"none",borderRadius:10,padding:"8px 16px",
              color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",marginTop:8,
            }}>Crea la prima routine</button>
          </div>
        ) : (
          <div style={{ display:"flex",gap:10,overflowX:"auto",paddingBottom:6,marginBottom:16 }}>
            {routines.map(r => (
              <div key={r.id} style={{
                minWidth:140,background:T.card,borderRadius:14,padding:14,
                border:`1px solid ${T.border}`,boxShadow:T.shadow,flexShrink:0,
              }}>
                <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:4 }}>{r.name}</div>
                <div style={{ fontSize:10,color:T.textMuted,marginBottom:10 }}>
                  {r.exercises.length} esercizi
                </div>
                <div style={{ display:"flex",gap:6 }}>
                  <button onClick={() => onStartFromRoutine(r)} style={{
                    flex:1,padding:"6px",borderRadius:8,border:"none",background:T.teal,
                    color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer",
                  }}>Avvia</button>
                  <button onClick={() => onEditRoutine(r)} style={{
                    padding:"6px 8px",borderRadius:8,border:`1px solid ${T.border}`,background:T.card,
                    cursor:"pointer",
                  }}><Edit3 size={12} color={T.textMuted}/></button>
                  <button onClick={() => onDeleteRoutine(r.id)} style={{
                    padding:"6px 8px",borderRadius:8,border:`1px solid ${T.border}`,background:T.card,
                    cursor:"pointer",
                  }}><Trash2 size={12} color={T.textMuted}/></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Muscle distribution */}
        {muscleData.length > 0 && (
          <div style={{
            background:T.card,borderRadius:16,padding:16,marginBottom:16,
            border:`1px solid ${T.border}`,boxShadow:T.shadow,
          }}>
            <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:12 }}>💪 Distribuzione Muscolare (4 sett.)</div>
            <div style={{ display:"flex",alignItems:"center",gap:16 }}>
              <div style={{ width:100,height:100,flexShrink:0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={muscleData} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={46} paddingAngle={2}>
                      {muscleData.map((d, i) => <Cell key={i} fill={d.fill}/>)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex:1,display:"flex",flexDirection:"column",gap:4 }}>
                {muscleData.map((d, i) => (
                  <div key={i} style={{ display:"flex",alignItems:"center",gap:6 }}>
                    <div style={{ width:8,height:8,borderRadius:4,background:d.fill,flexShrink:0 }}/>
                    <span style={{ fontSize:11,fontWeight:600,color:T.text,flex:1 }}>{d.name}</span>
                    <span style={{ fontSize:10,color:T.textMuted }}>{totalMuscleVol > 0 ? Math.round(d.value / totalMuscleVol * 100) : 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Workout history */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
          <div style={{ fontSize:13,fontWeight:700,color:T.text }}>🏋️ Allenamenti recenti</div>
        </div>

        {workouts.length === 0 ? (
          <div style={{
            background:T.card,borderRadius:14,padding:24,textAlign:"center",
            border:`1px dashed ${T.border}`,
          }}>
            <div style={{ fontSize:32,marginBottom:8 }}>🏋️</div>
            <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:4 }}>Nessun allenamento</div>
            <div style={{ fontSize:11,color:T.textMuted }}>Inizia il tuo primo allenamento!</div>
          </div>
        ) : (
          <>
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

      <GymBottomNav onAdd={onAdd} onNavigate={onNavigate}/>
    </div>
  );
};

/* ═══════════════════════════════════════════
   WORKOUT DETAIL SCREEN
   ═══════════════════════════════════════════ */
const WorkoutDetailScreen = ({ workout, sets, customExercises, onBack, onExerciseDetail, onDelete }) => {
  const exerciseGroups = useMemo(() => {
    const byEx = {};
    sets.forEach(s => {
      if (!byEx[s.exerciseId]) byEx[s.exerciseId] = [];
      byEx[s.exerciseId].push(s);
    });
    return Object.entries(byEx).map(([exId, exSets]) => ({
      exerciseId: exId,
      info: getExerciseById(exId, customExercises),
      sets: exSets.sort((a, b) => a.order - b.order),
    }));
  }, [sets, customExercises]);

  const volume = calcVolume(sets);

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:100 }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"16px 16px 12px" }}>
        <button onClick={onBack} style={{
          width:36,height:36,borderRadius:12,background:T.tealLight,border:"none",
          display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
        }}><ChevronLeft size={18} color={T.teal}/></button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18,fontWeight:800,color:T.text }}>{workout.name}</div>
          <div style={{ fontSize:11,color:T.textMuted }}>
            {formatDateFull(workout.date)} • {formatDuration(workout.durationMin)} • {volume.toLocaleString()} kg
          </div>
        </div>
        <button onClick={() => onDelete(workout.id)} style={{
          width:36,height:36,borderRadius:12,background:"#FEE2E2",border:"none",
          display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
        }}><Trash2 size={16} color={T.red}/></button>
      </div>

      <div style={{ padding:"0 16px" }}>
        {exerciseGroups.map((g, i) => (
          <button key={i} onClick={() => onExerciseDetail(g.exerciseId)} style={{
            width:"100%",background:T.card,borderRadius:14,padding:14,marginBottom:10,
            border:`1px solid ${T.border}`,boxShadow:T.shadow,cursor:"pointer",textAlign:"left",
          }}>
            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:8 }}>
              <div style={{ fontSize:14,fontWeight:700,color:MUSCLE_COLORS[g.info.muscle]||T.teal }}>{g.info.name}</div>
              <ChevronRight size={16} color={T.textMuted}/>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"40px 60px 60px",gap:4,fontSize:9,fontWeight:700,color:T.textMuted,marginBottom:4 }}>
              <span>Serie</span><span>Kg</span><span>Reps</span>
            </div>
            {g.sets.map((s, j) => (
              <div key={j} style={{ display:"grid",gridTemplateColumns:"40px 60px 60px",gap:4,fontSize:12,fontWeight:600,color:T.text }}>
                <span style={{ color:T.textMuted }}>{j + 1}</span>
                <span>{s.weight}</span>
                <span>{s.reps}</span>
              </div>
            ))}
          </button>
        ))}
      </div>

      <GymBottomNav onAdd={() => {}} onNavigate={onBack}/>
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
  const [restTimerDefault, setRestTimerDefault] = useState(90);
  const [toast, setToast] = useState(null);
  const [activeRoutine, setActiveRoutine] = useState(null);
  const [editRoutine, setEditRoutine] = useState(null);
  const [detailExerciseId, setDetailExerciseId] = useState(null);
  const [detailWorkout, setDetailWorkout] = useState(null);

  const showToast = useCallback((msg, icon) => {
    setToast({ msg, icon });
  }, []);

  // Load data
  const loadData = useCallback(async () => {
    const [w, r, ce, rt] = await Promise.all([
      getAllGymWorkouts(),
      getAllGymRoutines(),
      getAllGymCustomExercises(),
      getGymRestTimer(),
    ]);
    setWorkouts(w);
    setRoutines(r);
    setCustomExercises(ce);
    setRestTimerDefault(rt);
    // Load all sets for all workouts
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
      date: data.date,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      durationMin: data.durationMin,
      routineId: activeRoutine?.id || null,
    });
    const setsToAdd = [];
    data.exercises.forEach(ex => {
      ex.sets.forEach(s => {
        setsToAdd.push({
          workoutId,
          exerciseId: ex.exerciseId,
          order: s.order,
          weight: s.weight,
          reps: s.reps,
          type: s.type,
        });
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

  const handleStartEmpty = useCallback(() => {
    setActiveRoutine(null);
    setSubScreen("workout");
  }, []);

  const handleStartFromRoutine = useCallback((routine) => {
    setActiveRoutine(routine);
    setSubScreen("workout");
  }, []);

  const handleSaveRoutine = useCallback(async (data) => {
    if (editRoutine?.id) {
      await updateGymRoutine(editRoutine.id, data);
    } else {
      await addGymRoutine(data);
    }
    await loadData();
    setSubScreen("main");
    setEditRoutine(null);
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

  // Prepare initial exercises from routine
  const routineExercises = useMemo(() => {
    if (!activeRoutine) return null;
    return activeRoutine.exercises.map(ex => ({
      exerciseId: ex.exerciseId,
      sets: Array.from({ length: ex.targetSets || 3 }, () => ({
        weight: ex.targetWeight || 0,
        reps: ex.targetReps || 0,
        type: "N",
        completed: false,
      })),
    }));
  }, [activeRoutine]);

  // Routing
  if (subScreen === "workout") {
    return (
      <ActiveWorkoutScreen
        initialExercises={routineExercises}
        routineName={activeRoutine?.name || ""}
        onFinish={handleFinishWorkout}
        onDiscard={handleDiscardWorkout}
        onNavigate={onNavigate}
        allWorkouts={workouts}
        allSets={allSets}
        customExercises={customExercises}
        onAddCustomExercise={handleAddCustomExercise}
        restTimerDefault={restTimerDefault}
      />
    );
  }

  if (subScreen === "routineEditor") {
    return (
      <RoutineEditor
        routine={editRoutine}
        onSave={handleSaveRoutine}
        onClose={() => { setSubScreen("main"); setEditRoutine(null); }}
        customExercises={customExercises}
        onAddCustomExercise={handleAddCustomExercise}
      />
    );
  }

  if (subScreen === "exerciseDetail" && detailExerciseId) {
    return (
      <ExerciseDetailScreen
        exerciseId={detailExerciseId}
        allWorkouts={workouts}
        allSets={allSets}
        customExercises={customExercises}
        onBack={() => { setSubScreen(detailWorkout ? "workoutDetail" : "main"); setDetailExerciseId(null); }}
      />
    );
  }

  if (subScreen === "workoutDetail" && detailWorkout) {
    const wSets = allSets.filter(s => s.workoutId === detailWorkout.id);
    return (
      <WorkoutDetailScreen
        workout={detailWorkout}
        sets={wSets}
        customExercises={customExercises}
        onBack={() => { setSubScreen("main"); setDetailWorkout(null); }}
        onExerciseDetail={(exId) => { setDetailExerciseId(exId); setSubScreen("exerciseDetail"); }}
        onDelete={handleDeleteWorkout}
      />
    );
  }

  // Main screen
  return (
    <>
      <MainScreen
        workouts={workouts}
        allSets={allSets}
        routines={routines}
        customExercises={customExercises}
        onStartWorkout={handleStartEmpty}
        onStartFromRoutine={handleStartFromRoutine}
        onEditRoutine={(r) => { setEditRoutine(r); setSubScreen("routineEditor"); }}
        onNewRoutine={() => { setEditRoutine(null); setSubScreen("routineEditor"); }}
        onDeleteRoutine={handleDeleteRoutine}
        onExerciseDetail={(exId) => { setDetailExerciseId(exId); setSubScreen("exerciseDetail"); }}
        onWorkoutDetail={(w) => { setDetailWorkout(w); setSubScreen("workoutDetail"); }}
        onNavigate={onNavigate}
        onAdd={handleStartEmpty}
      />
      {toast && <Toast message={toast.msg} icon={toast.icon} onDismiss={() => setToast(null)}/>}
    </>
  );
}
