"use client";
// GymSection.jsx — Gym workout tracker (Hevy-style)
// v5 — Polished NumpadOverlay, DrumPicker, RoutineEditor, RoutineSummary

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
  getGymSetsByWorkout, addGymSets, getGymSetsByExercise, getAllGymSets,
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
  { id: "tricep_dip",        name: "Dip Parallele",        muscle: "Tricipiti",secondary: "Petto",      equipment: "Corpo libero", uni: false },
  { id: "db_tricep_ext",     name: "Estensioni Manubri",   muscle: "Tricipiti",secondary: "",           equipment: "Manubri", uni: true },
  { id: "tricep_machine",    name: "Tricep Machine",       muscle: "Tricipiti",secondary: "",           equipment: "Macchina", uni: false },
  // Gambe
  { id: "squat",             name: "Squat",                muscle: "Gambe",    secondary: "Core",       equipment: "Bilanciere", uni: false },
  { id: "leg_press",         name: "Leg Press",            muscle: "Gambe",    secondary: "Core",       equipment: "Macchina", uni: false },
  { id: "leg_extension",     name: "Leg Extension",        muscle: "Gambe",    secondary: "",           equipment: "Macchina", uni: false },
  { id: "leg_curl",          name: "Leg Curl",             muscle: "Gambe",    secondary: "",           equipment: "Macchina", uni: false },
  { id: "dumbbell_squat",    name: "Squat Manubri",        muscle: "Gambe",    secondary: "Core",       equipment: "Manubri", uni: false },
  { id: "bulgarian_split",   name: "Bulgarian Split Squat",muscle: "Gambe",    secondary: "Core",       equipment: "Manubri", uni: true },
  { id: "lunges",            name: "Affondi",              muscle: "Gambe",    secondary: "",           equipment: "Manubri", uni: true },
  { id: "calf_raise",        name: "Sollevamento Polpacci",muscle: "Gambe",    secondary: "",           equipment: "Bilanciere", uni: false },
  { id: "leg_press_single",  name: "Leg Press Unilaterale",muscle: "Gambe",    secondary: "Core",       equipment: "Macchina", uni: true },
  // Core
  { id: "crunch",            name: "Addominali",           muscle: "Core",     secondary: "",           equipment: "Corpo libero", uni: false },
  { id: "plank",             name: "Plank",                muscle: "Core",     secondary: "",           equipment: "Corpo libero", uni: false },
  { id: "ab_wheel",          name: "Ab Wheel",             muscle: "Core",     secondary: "",           equipment: "Corpo libero", uni: false },
  { id: "leg_raise",         name: "Sollevamento Gambe",   muscle: "Core",     secondary: "",           equipment: "Corpo libero", uni: false },
  { id: "cable_crunch",      name: "Crunch ai Cavi",       muscle: "Core",     secondary: "",           equipment: "Cavi", uni: false },
];

const MUSCLE_COLORS = {
  "Petto": "#FF6B6B", "Schiena": "#4ECDC4", "Spalle": "#FFD93D",
  "Bicipiti": "#6BCB77", "Tricipiti": "#A78BFA", "Gambe": "#FF8C42", "Core": "#FF6B9D",
};

const SET_TYPES = [
  { id: "N", label: "N", color: T.text, name: "Normale" },
  { id: "W", label: "W", color: "#EAB308", name: "Warmup" },
];

const getExerciseById = (id, customExercises = []) => {
  const found = EXERCISES.find(e => e.id === id);
  if (found) return found;
  return customExercises.find(e => e.id === id);
};

const getRestForSet = (ex, setType) => {
  if (setType === "W" && ex.warmupTimer > 0) return ex.warmupTimer;
  if (ex.restTimer > 0) return ex.restTimer;
  return setType === "W" ? 60 : 90;
};

const estimateRoutineDuration = (exercises) => {
  if (!exercises || exercises.length === 0) return 0;
  return Math.round(exercises.reduce((total, ex) => {
    const nSets = ex.sets ? ex.sets.length : 3;
    const rest = ex.restTimer || 90;
    const uniExtra = ex.unilateral ? nSets * (ex.sideTimer || 15) : 0;
    return total + nSets * (40 + rest) + uniExtra;
  }, 0) / 60);
};

const estimateWithHistory = (exerciseId, allSets = [], customExercises = []) => {
  const sets = allSets.filter(s => s.exerciseId === exerciseId).slice(-20);
  if (sets.length === 0) return { duration: 1.5, avgReps: 10 };
  const avgTime = sets.reduce((sum, s) => sum + (s.duration || 1.5), 0) / sets.length;
  const avgReps = Math.round(sets.reduce((sum, s) => sum + (s.reps || 0), 0) / sets.length);
  return { duration: avgTime, avgReps };
};

/* GymBottomNav removed — the main app (WeightTrackerApp) already provides a BottomNav */

/* ═══════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════ */
const Toast = ({ message, icon, action, onAction, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);
  return (
    <div style={{
      position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
      background: T.card, padding: "12px 16px", borderRadius: 8,
      boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 8,
      zIndex: 100, maxWidth: "90%",
    }}>
      {icon && icon}
      <span style={{ color: T.text, fontSize: 14, flex: 1 }}>{message}</span>
      {action && <button onClick={onAction} style={{
        background: T.teal, color: "white", border: "none", padding: "6px 12px",
        borderRadius: 4, cursor: "pointer", fontSize: 12,
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
    if (remaining <= 0) {
      onSkip();
      return;
    }
    const interval = setInterval(() => setRemaining(r => r - 1), 1000);
    return () => clearInterval(interval);
  }, [remaining, onSkip]);
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90,
    }}>
      <div style={{
        background: T.card, borderRadius: 12, padding: 24, textAlign: "center",
        maxWidth: "90%",
      }}>
        <p style={{ color: T.textSec, fontSize: 14, marginBottom: 8 }}>
          {isSideTimer ? "CAMBIA LATO" : "RIPOSO"} • {exerciseName}
        </p>
        <p style={{
          fontSize: 48, fontWeight: "bold", color: remaining <= 10 ? T.red : T.teal,
          margin: "16px 0",
        }}>{formatTimer(remaining)}</p>
        <button onClick={onSkip} style={{
          background: T.teal, color: "white", border: "none", padding: "12px 24px",
          borderRadius: 6, cursor: "pointer", fontSize: 16,
        }}>Salta</button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   NUMPAD OVERLAY (POLISHED)
   ═══════════════════════════════════════════ */
const NumpadOverlay = ({ label, value, decimal, onConfirm, onClose }) => {
  const [val, setVal] = useState(String(value || ""));
  const tap = (key) => {
    if (key === "DEL") setVal(v => v.slice(0, -1));
    else if (key === ".") { if (!val.includes(".") && decimal) setVal(v => v + "."); }
    else setVal(v => (v === "0" ? key : v + key));
  };
  const keys = ["1","2","3","4","5","6","7","8","9", decimal ? "." : "", "0", "DEL"];
  return (
    <div style={{
      position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.5)",
      display:"flex",alignItems:"flex-end",justifyContent:"center",
      animation:"fadeIn .15s ease-out",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:T.card,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:430,
        paddingBottom:34,
      }}>
        <div style={{ padding:"18px 20px 8px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <span style={{ fontSize:14,fontWeight:700,color:T.textSec }}>{label}</span>
          <button onClick={() => { onConfirm(parseFloat(val) || 0); onClose(); }} style={{
            background:T.gradient,border:"none",borderRadius:12,padding:"8px 20px",
            color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",
          }}>OK</button>
        </div>
        <div style={{
          textAlign:"center",fontSize:40,fontWeight:900,color:T.text,
          padding:"8px 20px 20px",minHeight:56,
        }}>
          {val || <span style={{ color:T.textMuted }}>0</span>}
        </div>
        <div style={{
          display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,padding:"0 20px",
        }}>
          {keys.map((k,i) => (
            <button key={i} onClick={() => k && tap(k)} style={{
              height:56,borderRadius:16,border:"none",fontSize:22,fontWeight:700,
              cursor:k?"pointer":"default",
              background:k === "DEL" ? "#FEE2E2" : k ? T.bg : "transparent",
              color:k === "DEL" ? T.red : T.text,
              opacity:k?1:0,
            }}>{k === "DEL" ? "⌫" : k}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   DRUM PICKER (POLISHED)
   ═══════════════════════════════════════════ */
const TIMER_OPTIONS = [];
for (let s = 0; s <= 300; s += 15) TIMER_OPTIONS.push(s);

const fmtTimer = (s) => {
  if (!s || s === 0) return "Off";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `${s}s`;
};

const DrumPicker = ({ value, title, onChange, onClose }) => {
  const containerRef = useRef(null);
  const ITEM_H = 48;
  const idx = TIMER_OPTIONS.indexOf(value) >= 0 ? TIMER_OPTIONS.indexOf(value) : 6;
  const [scrollIdx, setScrollIdx] = useState(idx);
  const scrollTimeout = useRef(null);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = idx * ITEM_H;
  }, []);

  const handleScroll = () => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      if (!containerRef.current) return;
      const newIdx = Math.round(containerRef.current.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(newIdx, TIMER_OPTIONS.length - 1));
      setScrollIdx(clamped);
      containerRef.current.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
    }, 80);
  };

  return (
    <div style={{
      position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.5)",
      display:"flex",alignItems:"flex-end",justifyContent:"center",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:T.card,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:430,
        paddingBottom:34,
      }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 20px 10px" }}>
          <span style={{ fontSize:15,fontWeight:800,color:T.text }}>{title || "Timer"}</span>
          <button onClick={() => { onChange(TIMER_OPTIONS[scrollIdx]); onClose(); }} style={{
            background:T.gradient,border:"none",borderRadius:12,padding:"8px 20px",
            color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",
          }}>Conferma</button>
        </div>
        <div style={{ position:"relative",height:ITEM_H * 5,overflow:"hidden" }}>
          <div style={{
            position:"absolute",top:ITEM_H * 2,left:20,right:20,height:ITEM_H,
            background:T.tealLight,borderRadius:14,border:`2px solid ${T.teal}`,
            zIndex:1,pointerEvents:"none",
          }}/>
          <div style={{
            position:"absolute",top:0,left:0,right:0,height:ITEM_H*2,
            background:"linear-gradient(to bottom,rgba(255,255,255,0.92),rgba(255,255,255,0))",
            zIndex:2,pointerEvents:"none",
          }}/>
          <div style={{
            position:"absolute",bottom:0,left:0,right:0,height:ITEM_H*2,
            background:"linear-gradient(to top,rgba(255,255,255,0.92),rgba(255,255,255,0))",
            zIndex:2,pointerEvents:"none",
          }}/>
          <div ref={containerRef} onScroll={handleScroll} style={{
            height:"100%",overflowY:"auto",scrollSnapType:"y mandatory",
            WebkitOverflowScrolling:"touch",position:"relative",zIndex:0,
          }}>
            <div style={{ height:ITEM_H*2 }}/>
            {TIMER_OPTIONS.map((opt,i) => (
              <div key={i} style={{
                height:ITEM_H,display:"flex",alignItems:"center",justifyContent:"center",
                scrollSnapAlign:"start",fontSize:22,fontWeight:800,
                color:i === scrollIdx ? T.teal : T.textMuted,transition:"color .15s",
              }}>
                {fmtTimer(opt)}
              </div>
            ))}
            <div style={{ height:ITEM_H*2 }}/>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   EXERCISE PICKER
   ═══════════════════════════════════════════ */
const ExercisePicker = ({ onSelect, onClose, customExercises, onAddCustom, multiSelect = false, onMultiSelect }) => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(multiSelect ? [] : null);
  const filtered = useMemo(() => {
    const all = [...EXERCISES, ...(customExercises || [])];
    if (!search) return all;
    return all.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
  }, [search, customExercises]);
  const handleSelect = (ex) => {
    if (multiSelect) {
      const ids = selected.map(s => s.id || s.exerciseId);
      if (ids.includes(ex.id)) {
        setSelected(selected.filter(s => (s.id || s.exerciseId) !== ex.id));
      } else {
        setSelected([...selected, ex]);
      }
    } else {
      onSelect(ex);
    }
  };
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "flex-end", zIndex: 80,
    }}>
      <div style={{
        width: "100%", maxWidth: "430px", marginLeft: "auto", marginRight: "auto",
        background: T.card, borderRadius: "12px 12px 0 0", maxHeight: "80vh",
        overflow: "auto", padding: 16,
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 12,
        }}>
          <h2 style={{ color: T.text, margin: 0 }}>Esercizio</h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
          }}>
            <X size={24} color={T.text} />
          </button>
        </div>
        <input
          type="text"
          placeholder="Cerca esercizio..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: "100%", padding: 10, marginBottom: 12, borderRadius: 6,
            border: `1px solid ${T.border}`, fontSize: 14,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(ex => (
            <div
              key={ex.id}
              onClick={() => handleSelect(ex)}
              style={{
                padding: 12, background: selected && (Array.isArray(selected) ? selected.map(s => s.id || s.exerciseId).includes(ex.id) : selected.id === ex.id) ? T.tealLight : T.bg,
                borderRadius: 6, cursor: "pointer", border: `1px solid ${T.border}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 12, height: 12, borderRadius: "50%",
                  background: MUSCLE_COLORS[ex.muscle] || T.tealLight,
                }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, color: T.text, fontSize: 14, fontWeight: "bold" }}>{ex.name}</p>
                  <p style={{ margin: 0, color: T.textSec, fontSize: 12 }}>
                    {ex.muscle} · {ex.equipment}{ex.uni ? " · Unilaterale" : ""}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        {multiSelect && (
          <button onClick={() => {
            onMultiSelect(selected);
            onClose();
          }} style={{
            width: "100%", marginTop: 12, padding: 12,
            background: T.teal, color: "white", border: "none",
            borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: "bold",
          }}>Aggiungi ({selected.length})</button>
        )}
        <button onClick={onAddCustom} style={{
          width: "100%", marginTop: 8, padding: 12,
          background: T.purple, color: "white", border: "none",
          borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: "bold",
        }}>+ Esercizio Personalizzato</button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   EXERCISE MENU (3-DOT DROPDOWN)
   ═══════════════════════════════════════════ */
const ExerciseMenu = ({
  onUnilateral, onSuperset, onMove, onDelete, isUnilateral, isSupersetted,
  isLastExercise, isActive,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{
        background: "none", border: "none", cursor: "pointer", padding: 4,
      }}>
        <MoreVertical size={20} color={T.textSec} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, background: T.card,
          border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: T.shadow,
          minWidth: 160, zIndex: 40,
        }}>
          <button onClick={() => {
            onUnilateral();
            setOpen(false);
          }} style={{
            width: "100%", padding: "10px 12px", background: "none", border: "none",
            textAlign: "left", cursor: "pointer", color: T.text, fontSize: 13,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {isUnilateral && <Check size={16} color={T.teal} />}
            <span style={{ flex: 1 }}>Unilaterale</span>
          </button>
          {!isLastExercise && (
            <button onClick={() => {
              onSuperset();
              setOpen(false);
            }} style={{
              width: "100%", padding: "10px 12px", background: "none", border: "none",
              textAlign: "left", cursor: "pointer", color: T.text, fontSize: 13,
              display: "flex", alignItems: "center", gap: 8,
              borderTop: `1px solid ${T.border}`,
            }}>
              {isSupersetted && <Check size={16} color={T.teal} />}
              <span style={{ flex: 1 }}>Superset</span>
            </button>
          )}
          <button onClick={() => {
            onMove();
            setOpen(false);
          }} style={{
            width: "100%", padding: "10px 12px", background: "none", border: "none",
            textAlign: "left", cursor: "pointer", color: T.text, fontSize: 13,
            borderTop: `1px solid ${T.border}`,
          }}>
            Sposta
          </button>
          <button onClick={() => {
            onDelete();
            setOpen(false);
          }} style={{
            width: "100%", padding: "10px 12px", background: "none", border: "none",
            textAlign: "left", cursor: "pointer", color: T.red, fontSize: 13,
            borderTop: `1px solid ${T.border}`,
          }}>
            Elimina
          </button>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   NAME MODAL
   ═══════════════════════════════════════════ */
const NameModal = ({ onContinue, onClose, title = "Nome Routine" }) => {
  const [name, setName] = useState("");
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{
        background: T.card, borderRadius: 12, padding: 24, maxWidth: "90%",
        width: 300,
      }}>
        <h2 style={{ color: T.text, margin: "0 0 16px 0" }}>{title}</h2>
        <input
          type="text"
          placeholder="Inserisci nome..."
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          style={{
            width: "100%", padding: 10, marginBottom: 16, borderRadius: 6,
            border: `1px solid ${T.border}`, fontSize: 14,
          }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 10, background: T.bg, border: `1px solid ${T.border}`,
            borderRadius: 6, cursor: "pointer", color: T.text,
          }}>Annulla</button>
          <button onClick={() => {
            if (name.trim()) onContinue(name);
          }} style={{
            flex: 1, padding: 10, background: T.teal, border: "none",
            borderRadius: 6, cursor: "pointer", color: "white", fontWeight: "bold",
          }}>Continua</button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   ROUTINE EDITOR (POLISHED VERSION)
   ═══════════════════════════════════════════ */
const RoutineEditor = ({ routine, exercises, onSave, onClose, customExercises, onAddCustomExercise, onAddExercises }) => {
  const [exs, setExs] = useState(exercises || []);
  const [showPicker, setShowPicker] = useState(false);
  const [reorderIdx, setReorderIdx] = useState(null);
  const [numpad, setNumpad] = useState(null);
  const [drumPicker, setDrumPicker] = useState(null);

  const addExercises = (newExs) => {
    setExs(prev => [...prev, ...newExs.map(e => ({
      exerciseId: e.id,
      sets: [{ weight: 0, reps: 0, type: "N" }],
      restTimer: 90, warmupTimer: 60, sideTimer: 15,
      unilateral: e.uni || false, supersetWith: null, note: "",
    }))]);
    setShowPicker(false);
  };

  const updateExercise = (idx, updates) => {
    setExs(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...updates };
      return next;
    });
  };

  const deleteExercise = (idx) => setExs(prev => prev.filter((_, i) => i !== idx));

  const moveExercise = (idx, direction) => {
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= exs.length) return;
    setExs(prev => {
      const moved = [...prev];
      [moved[idx], moved[newIdx]] = [moved[newIdx], moved[idx]];
      return moved;
    });
    setReorderIdx(newIdx);
  };

  const addSet = (exIdx) => {
    setExs(prev => {
      const next = [...prev];
      const ex = next[exIdx];
      const last = ex.sets[ex.sets.length - 1];
      next[exIdx] = { ...ex, sets: [...ex.sets, { weight: last?.weight || 0, reps: last?.reps || 0, type: "N" }] };
      return next;
    });
  };

  const removeSet = (exIdx, setIdx) => {
    setExs(prev => {
      const next = [...prev];
      if (next[exIdx].sets.length <= 1) return prev;
      next[exIdx] = { ...next[exIdx], sets: next[exIdx].sets.filter((_, i) => i !== setIdx) };
      return next;
    });
  };

  const updateSet = (exIdx, setIdx, field, value) => {
    setExs(prev => {
      const next = [...prev];
      next[exIdx] = { ...next[exIdx], sets: [...next[exIdx].sets] };
      next[exIdx].sets[setIdx] = { ...next[exIdx].sets[setIdx], [field]: value };
      return next;
    });
  };

  const cycleType = (exIdx, setIdx) => {
    const types = ["N", "W"];
    const cur = exs[exIdx].sets[setIdx].type;
    updateSet(exIdx, setIdx, "type", types[(types.indexOf(cur) + 1) % types.length]);
  };

  const hasWarmup = (ex) => ex.sets && ex.sets.some(s => s.type === "W");

  const totalSets = exs.reduce((s, ex) => s + (ex.sets?.length || 0), 0);
  const estDuration = estimateRoutineDuration(exs);

  return (
    <div style={{ minHeight:"100vh",background:T.bg,paddingBottom:120 }}>
      {/* Sticky Header */}
      <div style={{
        position:"sticky",top:0,zIndex:10,background:T.bg,
        padding:"14px 16px",display:"flex",alignItems:"center",gap:12,
        borderBottom:`1px solid ${T.border}`,
      }}>
        <button onClick={onClose} style={{
          width:36,height:36,borderRadius:12,background:T.tealLight,border:"none",
          display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
        }}><ChevronLeft size={18} color={T.teal} /></button>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:17,fontWeight:900,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
            {routine?.name || "Nuova Routine"}
          </div>
          <div style={{ fontSize:10,color:T.textMuted,fontWeight:600 }}>
            {exs.length} esercizi · {totalSets} serie · ~{estDuration}min
          </div>
        </div>
        <button onClick={() => onSave(exs)} style={{
          background:T.gradient,border:"none",borderRadius:12,padding:"9px 20px",
          color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",
          boxShadow:"0 2px 10px rgba(2,128,144,0.25)",
        }}>Avanti</button>
      </div>

      {/* Exercise Cards */}
      <div style={{ padding:"14px 16px 0" }}>
        {exs.map((ex, exIdx) => {
          const info = getExerciseById(ex.exerciseId, customExercises);
          const isSuperset = ex.supersetWith === exIdx + 1;
          const isPrevSuperset = exIdx > 0 && exs[exIdx-1].supersetWith === exIdx;
          const muscleColor = MUSCLE_COLORS[info?.muscle] || T.teal;

          return (
            <div key={exIdx} style={{ position:"relative" }}>
              {/* Superset connector line */}
              {isSuperset && (
                <div style={{
                  position:"absolute",left:7,top:"50%",bottom:-14,width:3,
                  background:`linear-gradient(to bottom, ${T.orange}, ${T.orange}88)`,
                  borderRadius:2,zIndex:1,
                }}/>
              )}
              {isPrevSuperset && (
                <div style={{
                  position:"absolute",left:7,top:-14,height:14,width:3,
                  background:`${T.orange}88`,borderRadius:2,zIndex:1,
                }}/>
              )}

              <div style={{
                background:T.card,borderRadius:16,marginBottom:isSuperset ? 6 : 14,
                border: reorderIdx === exIdx ? `2px solid ${T.teal}` : `1px solid ${T.border}`,
                boxShadow:T.shadow,overflow:"hidden",
              }}>
                {/* Exercise Header */}
                <div style={{
                  display:"flex",alignItems:"center",gap:8,
                  padding:"12px 10px 10px 12px",
                  borderBottom:`1px solid ${T.border}`,
                  background:isPrevSuperset ? `${T.orange}08` : "transparent",
                }}>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:14,fontWeight:800,color:muscleColor }}>{info?.name || "Esercizio"}</div>
                    <div style={{ fontSize:10,color:T.textMuted,fontWeight:500 }}>
                      {info?.muscle} · {info?.equipment}
                    </div>
                  </div>

                  {/* Timer pills inline */}
                  <div style={{ display:"flex",gap:4,flexWrap:"wrap",flexShrink:0 }}>
                    <button onClick={() => setDrumPicker({ exIdx, field:"restTimer", title:"Riposo" })} style={{
                      display:"flex",alignItems:"center",gap:3,
                      background:`${T.teal}12`,border:"none",borderRadius:8,
                      padding:"4px 8px",cursor:"pointer",
                    }}>
                      <Timer size={10} color={T.teal} />
                      <span style={{ fontSize:9,fontWeight:700,color:T.teal }}>{fmtTimer(ex.restTimer)}</span>
                    </button>
                    {hasWarmup(ex) && (
                      <button onClick={() => setDrumPicker({ exIdx, field:"warmupTimer", title:"Warmup" })} style={{
                        display:"flex",alignItems:"center",gap:3,
                        background:"#EAB30815",border:"none",borderRadius:8,
                        padding:"4px 8px",cursor:"pointer",
                      }}>
                        <Flame size={10} color="#EAB308" />
                        <span style={{ fontSize:9,fontWeight:700,color:"#EAB308" }}>{fmtTimer(ex.warmupTimer)}</span>
                      </button>
                    )}
                    {ex.unilateral && (
                      <button onClick={() => setDrumPicker({ exIdx, field:"sideTimer", title:"Timer lati" })} style={{
                        display:"flex",alignItems:"center",gap:3,
                        background:`${T.purple}12`,border:"none",borderRadius:8,
                        padding:"4px 8px",cursor:"pointer",
                      }}>
                        <ArrowLeftRight size={10} color={T.purple} />
                        <span style={{ fontSize:9,fontWeight:700,color:T.purple }}>{fmtTimer(ex.sideTimer)}</span>
                      </button>
                    )}
                  </div>

                  {/* 3-dot menu */}
                  <ExerciseMenu
                    isUnilateral={ex.unilateral}
                    isSupersetted={ex.supersetWith !== null}
                    isLastExercise={exIdx === exs.length - 1}
                    onUnilateral={() => updateExercise(exIdx, { unilateral: !ex.unilateral })}
                    onSuperset={() => updateExercise(exIdx, { supersetWith: ex.supersetWith !== null ? null : exIdx + 1 })}
                    onMove={() => setReorderIdx(reorderIdx === exIdx ? null : exIdx)}
                    onDelete={() => deleteExercise(exIdx)}
                  />
                </div>

                {/* Note - always visible inline input */}
                <div style={{ padding:"0 12px" }}>
                  <input
                    type="text"
                    placeholder="Aggiungi nota..."
                    value={ex.note || ""}
                    onChange={e => updateExercise(exIdx, { note: e.target.value })}
                    style={{
                      width:"100%",padding:"8px 0",border:"none",borderBottom:`1px solid ${T.border}`,
                      fontSize:12,color:T.text,background:"transparent",outline:"none",
                      fontFamily:"inherit",
                    }}
                  />
                </div>

                {/* Sets Table */}
                <div style={{ padding:"8px 12px 12px" }}>
                  {/* Header */}
                  <div style={{
                    display:"grid",gridTemplateColumns:"48px 1fr 1fr 32px",gap:8,
                    padding:"4px 0 6px",fontSize:9,fontWeight:800,color:T.textMuted,
                    textTransform:"uppercase",letterSpacing:0.5,
                  }}>
                    <span style={{ textAlign:"center" }}>Tipo</span>
                    <span style={{ textAlign:"center" }}>Kg</span>
                    <span style={{ textAlign:"center" }}>Reps</span>
                    <span></span>
                  </div>

                  {/* Set rows */}
                  {ex.sets.map((set, setIdx) => {
                    const typeColor = set.type === "W" ? "#EAB308" : T.text;
                    const typeBg = set.type === "W" ? "#EAB30815" : `${T.text}08`;
                    return (
                      <div key={setIdx} style={{
                        display:"grid",gridTemplateColumns:"48px 1fr 1fr 32px",gap:8,
                        alignItems:"center",marginBottom:6,
                      }}>
                        {/* Type badge - tap to cycle */}
                        <button onClick={() => cycleType(exIdx, setIdx)} style={{
                          height:36,borderRadius:10,border:"none",cursor:"pointer",
                          background:typeBg,color:typeColor,
                          fontSize:13,fontWeight:800,
                          display:"flex",alignItems:"center",justifyContent:"center",
                        }}>{set.type}</button>

                        {/* Kg button - opens NumpadOverlay */}
                        <button onClick={() => setNumpad({ exIdx, setIdx, field:"weight", label:"Peso (kg)", decimal:true })} style={{
                          height:40,borderRadius:12,cursor:"pointer",
                          border:`1.5px solid ${T.border}`,background:"#fff",
                          fontSize:16,fontWeight:800,color:set.weight ? T.text : T.textMuted,
                          display:"flex",alignItems:"center",justifyContent:"center",
                        }}>
                          {set.weight || "—"}
                        </button>

                        {/* Reps button - opens NumpadOverlay */}
                        <button onClick={() => setNumpad({ exIdx, setIdx, field:"reps", label:"Ripetizioni", decimal:false })} style={{
                          height:40,borderRadius:12,cursor:"pointer",
                          border:`1.5px solid ${T.border}`,background:"#fff",
                          fontSize:16,fontWeight:800,color:set.reps ? T.text : T.textMuted,
                          display:"flex",alignItems:"center",justifyContent:"center",
                        }}>
                          {set.reps || "—"}
                        </button>

                        {/* Remove set */}
                        <button onClick={() => removeSet(exIdx, setIdx)} style={{
                          width:32,height:32,borderRadius:10,border:"none",
                          background:ex.sets.length > 1 ? "#FEE2E250" : "transparent",
                          cursor:ex.sets.length > 1 ? "pointer" : "default",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          opacity:ex.sets.length > 1 ? 1 : 0.2,
                        }}>
                          <Minus size={13} color={ex.sets.length > 1 ? T.red : T.textMuted} />
                        </button>
                      </div>
                    );
                  })}

                  {/* Add set */}
                  <button onClick={() => addSet(exIdx)} style={{
                    width:"100%",padding:"10px",borderRadius:12,
                    border:`1.5px dashed ${T.teal}40`,background:`${T.tealLight}50`,
                    cursor:"pointer",fontSize:12,fontWeight:700,color:T.teal,
                    display:"flex",alignItems:"center",justifyContent:"center",gap:5,
                    marginTop:4,
                  }}>
                    <Plus size={13} color={T.teal} /> Aggiungi serie
                  </button>
                </div>

                {/* Superset badge */}
                {isSuperset && (
                  <div style={{
                    padding:"6px 12px 8px",background:`${T.orange}08`,
                    borderTop:`1px solid ${T.orange}20`,
                    display:"flex",alignItems:"center",gap:6,
                  }}>
                    <Link2 size={12} color={T.orange} />
                    <span style={{ fontSize:10,fontWeight:700,color:T.orange }}>
                      Superset con {getExerciseById(exs[exIdx+1]?.exerciseId, customExercises)?.name}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Add exercises button */}
        <button onClick={() => setShowPicker(true)} style={{
          width:"100%",padding:"14px",background:T.tealLight,
          border:`1.5px dashed ${T.teal}`,borderRadius:16,cursor:"pointer",
          fontSize:13,fontWeight:700,color:T.teal,
          display:"flex",alignItems:"center",justifyContent:"center",gap:6,
          marginBottom:20,
        }}>
          <Plus size={16} color={T.teal} /> Aggiungi Esercizi
        </button>
      </div>

      {/* Bottom fixed bar */}
      <div style={{
        position:"fixed",bottom:0,left:0,right:0,maxWidth:"430px",
        marginLeft:"auto",marginRight:"auto",
        display:"flex",gap:8,padding:"12px 16px 28px",background:T.bg,
        borderTop:`1px solid ${T.border}`,zIndex:10,
      }}>
        <button onClick={() => setShowPicker(true)} style={{
          flex:1,padding:12,background:T.card,
          border:`1.5px solid ${T.teal}`,color:T.teal,
          borderRadius:14,cursor:"pointer",fontWeight:700,fontSize:14,
          display:"flex",alignItems:"center",justifyContent:"center",gap:6,
        }}>
          <Plus size={16} /> Esercizio
        </button>
        <button onClick={() => onSave(exs)} style={{
          flex:1,padding:12,background:T.gradient,color:"white",border:"none",
          borderRadius:14,cursor:"pointer",fontWeight:800,fontSize:14,
          boxShadow:"0 2px 10px rgba(2,128,144,0.25)",
        }}>Avanti</button>
      </div>

      {/* Reorder floating toolbar */}
      {reorderIdx !== null && (
        <div style={{
          position:"fixed",bottom:80,left:16,right:16,maxWidth:"398px",
          marginLeft:"auto",marginRight:"auto",
          display:"flex",gap:8,zIndex:50,background:T.card,
          padding:12,borderRadius:16,boxShadow:"0 4px 20px rgba(0,0,0,0.15)",
        }}>
          <button onClick={() => moveExercise(reorderIdx, "up")} disabled={reorderIdx === 0} style={{
            flex:1,padding:10,background:T.teal,color:"white",border:"none",
            borderRadius:12,cursor:reorderIdx === 0 ? "default" : "pointer",fontWeight:700,
            opacity:reorderIdx === 0 ? 0.4 : 1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,
          }}><ChevronUp size={16} /> Su</button>
          <button onClick={() => moveExercise(reorderIdx, "down")} disabled={reorderIdx === exs.length - 1} style={{
            flex:1,padding:10,background:T.teal,color:"white",border:"none",
            borderRadius:12,cursor:reorderIdx === exs.length - 1 ? "default" : "pointer",fontWeight:700,
            opacity:reorderIdx === exs.length - 1 ? 0.4 : 1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,
          }}><ChevronDown size={16} /> Giù</button>
          <button onClick={() => setReorderIdx(null)} style={{
            flex:1,padding:10,background:T.green,color:"white",border:"none",
            borderRadius:12,cursor:"pointer",fontWeight:700,
          }}>Fatto</button>
        </div>
      )}

      {/* Exercise picker */}
      {showPicker && (
        <ExercisePicker
          onSelect={() => {}}
          onClose={() => setShowPicker(false)}
          customExercises={customExercises}
          onAddCustom={() => onAddCustomExercise && onAddCustomExercise()}
          multiSelect={true}
          onMultiSelect={addExercises}
        />
      )}

      {/* NumpadOverlay */}
      {numpad && (
        <NumpadOverlay
          label={numpad.label}
          value={exs[numpad.exIdx].sets[numpad.setIdx][numpad.field]}
          decimal={numpad.decimal}
          onConfirm={(v) => updateSet(numpad.exIdx, numpad.setIdx, numpad.field, v)}
          onClose={() => setNumpad(null)}
        />
      )}

      {/* DrumPicker */}
      {drumPicker && (
        <DrumPicker
          value={exs[drumPicker.exIdx][drumPicker.field] || 90}
          title={drumPicker.title}
          onChange={(v) => updateExercise(drumPicker.exIdx, { [drumPicker.field]: v })}
          onClose={() => setDrumPicker(null)}
        />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   ROUTINE SUMMARY (POLISHED VERSION)
   ═══════════════════════════════════════════ */
const RoutineSummary = ({ name, exercises, onSave, onBack, customExercises }) => {
  const duration = estimateRoutineDuration(exercises);
  const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets || []).length, 0);

  const muscleBreakdown = useMemo(() => {
    const counts = {};
    exercises.forEach(ex => {
      const info = getExerciseById(ex.exerciseId, customExercises);
      const sets = ex.sets?.length || 0;
      counts[info?.muscle || "Altro"] = (counts[info?.muscle || "Altro"] || 0) + sets;
    });
    return Object.entries(counts)
      .map(([muscle, sets]) => ({ muscle, sets, color: MUSCLE_COLORS[muscle] || T.teal }))
      .sort((a, b) => b.sets - a.sets);
  }, [exercises, customExercises]);

  const maxSets = Math.max(...muscleBreakdown.map(m => m.sets), 1);

  return (
    <div style={{ minHeight:"100vh",background:T.bg,paddingBottom:100 }}>
      {/* Header card */}
      <div style={{
        background:T.gradient,padding:"24px 20px 20px",
        borderRadius:"0 0 28px 28px",marginBottom:20,
      }}>
        <button onClick={onBack} style={{
          background:"rgba(255,255,255,0.15)",border:"none",borderRadius:12,
          width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",
          cursor:"pointer",marginBottom:16,
        }}><ChevronLeft size={18} color="#fff" /></button>
        <div style={{ fontSize:22,fontWeight:900,color:"#fff",marginBottom:4 }}>{name}</div>
        <div style={{ display:"flex",gap:16,marginTop:12 }}>
          {[
            { label:"Esercizi", value:exercises.length },
            { label:"Serie totali", value:totalSets },
            { label:"Durata stimata", value:`~${duration}min` },
          ].map((s,i) => (
            <div key={i}>
              <div style={{ fontSize:20,fontWeight:900,color:"#fff" }}>{s.value}</div>
              <div style={{ fontSize:10,color:"rgba(255,255,255,0.7)",fontWeight:600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding:"0 16px" }}>
        {/* Muscle breakdown */}
        <div style={{
          background:T.card,borderRadius:16,padding:16,marginBottom:16,
          border:`1px solid ${T.border}`,boxShadow:T.shadow,
        }}>
          <div style={{ fontSize:14,fontWeight:800,color:T.text,marginBottom:14 }}>Serie per gruppo muscolare</div>
          {muscleBreakdown.map((m,i) => (
            <div key={i} style={{ marginBottom:10 }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                <span style={{ fontSize:12,fontWeight:700,color:T.text }}>{m.muscle}</span>
                <span style={{ fontSize:12,fontWeight:800,color:m.color }}>{m.sets} serie</span>
              </div>
              <div style={{ height:8,background:T.bg,borderRadius:4,overflow:"hidden" }}>
                <div style={{
                  height:"100%",width:`${(m.sets / maxSets) * 100}%`,
                  background:m.color,borderRadius:4,
                }}/>
              </div>
            </div>
          ))}
        </div>

        {/* Exercise list */}
        <div style={{
          background:T.card,borderRadius:16,padding:16,marginBottom:20,
          border:`1px solid ${T.border}`,boxShadow:T.shadow,
        }}>
          <div style={{ fontSize:14,fontWeight:800,color:T.text,marginBottom:12 }}>Esercizi</div>
          {exercises.map((ex, i) => {
            const info = getExerciseById(ex.exerciseId, customExercises);
            return (
              <div key={i} style={{
                display:"flex",alignItems:"center",gap:10,padding:"10px 0",
                borderBottom:i < exercises.length - 1 ? `1px solid ${T.border}` : "none",
              }}>
                <div style={{
                  width:32,height:32,borderRadius:10,
                  background:`${MUSCLE_COLORS[info?.muscle] || T.teal}15`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,
                  color:MUSCLE_COLORS[info?.muscle] || T.teal,
                }}>{i + 1}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13,fontWeight:700,color:T.text }}>{info?.name}</div>
                  <div style={{ fontSize:10,color:T.textMuted }}>{ex.sets?.length} serie · {info?.muscle}</div>
                </div>
                <div style={{ display:"flex",gap:4 }}>
                  {ex.unilateral && (
                    <span style={{ fontSize:8,fontWeight:800,color:T.purple,background:`${T.purple}15`,padding:"3px 6px",borderRadius:6 }}>UNI</span>
                  )}
                  {ex.supersetWith != null && (
                    <span style={{ fontSize:8,fontWeight:800,color:T.orange,background:`${T.orange}15`,padding:"3px 6px",borderRadius:6 }}>SS</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={onSave} style={{
          width:"100%",padding:"16px",borderRadius:16,border:"none",
          background:T.gradient,color:"#fff",fontSize:16,fontWeight:800,
          cursor:"pointer",boxShadow:"0 4px 20px rgba(2,128,144,0.3)",
          marginBottom:12,
        }}>Salva Routine</button>

        <button onClick={onBack} style={{
          width:"100%",padding:"14px",borderRadius:14,
          border:`1.5px solid ${T.border}`,background:T.card,
          color:T.textSec,fontSize:14,fontWeight:700,cursor:"pointer",
        }}>Torna a modificare</button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   ACTIVE WORKOUT SCREEN
   ═══════════════════════════════════════════ */
const ActiveWorkoutScreen = ({
  workout, exercises: initialExercises, customExercises, onComplete, onCancel, allSets, onExerciseDetail,
}) => {
  const [exs, setExs] = useState(() => JSON.parse(JSON.stringify(initialExercises)));
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [currentSetIdx, setCurrentSetIdx] = useState(0);
  const [workoutSets, setWorkoutSets] = useState([]);
  const [restTimer, setRestTimer] = useState(null);
  const [numpad, setNumpad] = useState(null);

  const currentEx = exs[currentExIdx];
  const currentSet = currentEx?.sets[currentSetIdx];
  const exInfo = getExerciseById(currentEx?.exerciseId, customExercises);

  const updateCurrentSet = (field, value) => {
    setExs(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[currentExIdx].sets[currentSetIdx][field] = value;
      return next;
    });
  };

  const handleCompleteSet = async () => {
    const w = currentSet?.weight || 0;
    const r = currentSet?.reps || 0;
    const setData = {
      workoutId: workout.id,
      exerciseId: currentEx.exerciseId,
      setNumber: currentSetIdx + 1,
      weight: w, reps: r, type: currentSet.type,
      duration: 1.5, timestamp: new Date().toISOString(),
    };
    setWorkoutSets(prev => [...prev, setData]);

    if (currentEx.unilateral && !currentSet.sideCompleted && !currentSet.completed) {
      updateCurrentSet("sideCompleted", true);
      if (currentEx.sideTimer > 0) {
        setRestTimer({ seconds: currentEx.sideTimer, exerciseName: exInfo?.name, isSideTimer: true });
      }
      return;
    }
    if (currentEx.unilateral && currentSet.sideCompleted && !currentSet.completed) {
      updateCurrentSet("completed", true);
    }

    if (currentSetIdx < currentEx.sets.length - 1) {
      setCurrentSetIdx(prev => prev + 1);
      const rest = getRestForSet(currentEx, currentSet.type);
      setRestTimer({ seconds: rest, exerciseName: exInfo?.name, isSideTimer: false });
    } else if (currentExIdx < exs.length - 1) {
      setCurrentExIdx(prev => prev + 1);
      setCurrentSetIdx(0);
      setRestTimer({ seconds: 60, exerciseName: exInfo?.name, isSideTimer: false });
    } else {
      await saveWorkout();
    }
  };

  const saveWorkout = async () => {
    try {
      const wk = {
        ...workout,
        endTime: new Date().toISOString(),
        completed: true,
      };
      await addGymWorkout(wk);
      if (workoutSets.length > 0) {
        await addGymSets(workoutSets);
      }
      onComplete();
    } catch (err) {
      console.error("Error saving workout:", err);
    }
  };

  if (restTimer) {
    return (
      <RestTimerOverlay
        seconds={restTimer.seconds}
        exerciseName={restTimer.exerciseName || "Esercizio"}
        isSideTimer={restTimer.isSideTimer}
        onSkip={() => setRestTimer(null)}
      />
    );
  }

  if (!currentEx) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: T.bg }}>
        <CheckCircle2 size={48} color={T.green} />
        <p style={{ fontSize: 18, fontWeight: "bold", color: T.text, marginTop: 16 }}>Allenamento Completato!</p>
        <button onClick={onComplete} style={{
          marginTop: 16, padding: "12px 24px", background: T.teal, color: "white",
          border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold",
        }}>Chiudi</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{
        background: T.card, padding: "12px 16px", borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <button onClick={onCancel} style={{
          background: "none", border: "none", cursor: "pointer", padding: 4,
        }}>
          <ChevronLeft size={22} color={T.text} />
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, color: T.text, fontSize: 15, fontWeight: "bold" }}>
            {exInfo?.name}
          </p>
          <p style={{ margin: "2px 0 0", color: T.textSec, fontSize: 11 }}>
            Esercizio {currentExIdx + 1} di {exs.length} · {exInfo?.muscle}
          </p>
        </div>
        <button onClick={onCancel} style={{
          background: T.red + "15", border: "none", borderRadius: 8,
          padding: "6px 12px", cursor: "pointer",
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.red }}>Annulla</span>
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: T.border }}>
        <div style={{
          height: "100%", background: T.teal,
          width: `${((currentExIdx * 10 + currentSetIdx) / (exs.length * 3)) * 100}%`,
          transition: "width 0.3s",
        }}/>
      </div>

      <div style={{ padding: 16 }}>
        {/* Current set card */}
        <div style={{
          background: T.card, borderRadius: 12, padding: 20,
          border: `1px solid ${T.border}`, boxShadow: T.shadow,
        }}>
          <div style={{ marginBottom: 16, textAlign: "center" }}>
            <p style={{ margin: 0, color: T.textSec, fontSize: 12, fontWeight: 600 }}>
              Serie {currentSetIdx + 1} di {currentEx.sets.length}
              {currentSet?.type === "W" && <span style={{ color: "#EAB308", marginLeft: 8 }}>Warmup</span>}
            </p>
          </div>

          {/* Kg / Reps buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <button onClick={() => setNumpad({ type: "weight" })} style={{
              padding: "16px 12px", background: T.bg, border: `1.5px solid ${T.border}`,
              borderRadius: 12, cursor: "pointer", textAlign: "center",
            }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: "uppercase" }}>Peso</p>
              <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800, color: T.text }}>
                {currentSet?.weight || 0}<span style={{ fontSize: 13, color: T.textSec }}>kg</span>
              </p>
            </button>
            <button onClick={() => setNumpad({ type: "reps" })} style={{
              padding: "16px 12px", background: T.bg, border: `1.5px solid ${T.border}`,
              borderRadius: 12, cursor: "pointer", textAlign: "center",
            }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: "uppercase" }}>Ripetizioni</p>
              <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800, color: T.text }}>
                {currentSet?.reps || 0}
              </p>
            </button>
          </div>

          {/* Complete set button */}
          <button onClick={handleCompleteSet} style={{
            width: "100%", padding: 14, background: T.teal, color: "white",
            border: "none", borderRadius: 10, cursor: "pointer", fontWeight: "bold", fontSize: 14,
          }}>
            {currentEx.unilateral && !currentSet?.sideCompleted ? "Completa Lato 1" :
             currentEx.unilateral && currentSet?.sideCompleted ? "Completa Lato 2" :
             "Completa Serie"}
          </button>
        </div>

        {/* All sets overview */}
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: "0 0 8px", color: T.textSec, fontSize: 12, fontWeight: 600 }}>Tutte le serie</p>
          {currentEx.sets.map((set, idx) => (
            <div key={idx} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
              background: idx === currentSetIdx ? T.tealLight : T.card,
              borderRadius: 8, marginBottom: 4,
              border: idx === currentSetIdx ? `1px solid ${T.teal}40` : `1px solid ${T.border}`,
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: 6, fontSize: 11, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: set.type === "W" ? "#EAB30815" : T.bg,
                color: set.type === "W" ? "#EAB308" : T.textSec,
              }}>{set.type}</span>
              <span style={{ flex: 1, fontSize: 13, color: T.text }}>
                {set.weight || "—"}kg × {set.reps || "—"}
              </span>
              {idx < currentSetIdx && <Check size={14} color={T.green} />}
              {idx === currentSetIdx && <span style={{ fontSize: 10, fontWeight: 700, color: T.teal }}>ORA</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom: navigation between exercises */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: "430px",
        marginLeft: "auto", marginRight: "auto",
        display: "flex", gap: 8, padding: "12px 16px 28px", background: T.bg,
        borderTop: `1px solid ${T.border}`,
      }}>
        <button onClick={() => { setCurrentExIdx(Math.max(0, currentExIdx - 1)); setCurrentSetIdx(0); }} disabled={currentExIdx === 0} style={{
          flex: 1, padding: 10, background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 8, cursor: currentExIdx === 0 ? "default" : "pointer",
          color: T.text, fontWeight: 600, fontSize: 13, opacity: currentExIdx === 0 ? 0.4 : 1,
        }}>← Precedente</button>
        <button onClick={async () => { if (currentExIdx === exs.length - 1) { await saveWorkout(); } else { setCurrentExIdx(prev => prev + 1); setCurrentSetIdx(0); }}} style={{
          flex: 1, padding: 10,
          background: currentExIdx === exs.length - 1 ? T.green : T.teal,
          color: "white", border: "none", borderRadius: 8, cursor: "pointer",
          fontWeight: "bold", fontSize: 13,
        }}>{currentExIdx === exs.length - 1 ? "Fine Allenamento" : "Prossimo →"}</button>
      </div>

      {numpad && (
        <NumpadOverlay
          label={numpad.type === "weight" ? "Peso (kg)" : "Ripetizioni"}
          value={numpad.type === "weight" ? currentSet?.weight : currentSet?.reps}
          decimal={numpad.type === "weight"}
          onConfirm={(v) => {
            updateCurrentSet(numpad.type === "weight" ? "weight" : "reps", v);
            setNumpad(null);
          }}
          onClose={() => setNumpad(null)}
        />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   EXERCISE DETAIL SCREEN (UNCHANGED)
   ═══════════════════════════════════════════ */
const ExerciseDetailScreen = ({ exerciseId, allWorkouts, allSets, customExercises, onBack }) => {
  const info = getExerciseById(exerciseId, customExercises);
  const sets = allSets.filter(s => s.exerciseId === exerciseId).slice(-50);
  const totalVolume = sets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
  const avgWeight = sets.length > 0 ? Math.round(sets.reduce((sum, s) => sum + (s.weight || 0), 0) / sets.length) : 0;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, paddingBottom: 80 }}>
      <div style={{
        background: T.card, padding: 16, borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", cursor: "pointer",
        }}>
          <ChevronLeft size={24} color={T.text} />
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, color: T.text, fontSize: 16, fontWeight: "bold" }}>
            {info?.name || "Esercizio"}
          </p>
          <p style={{ margin: "4px 0 0 0", color: T.textSec, fontSize: 12 }}>
            {info?.muscle} · {info?.equipment}
          </p>
        </div>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{
          background: T.card, borderRadius: 8, padding: 16,
          border: `1px solid ${T.border}`,
        }}>
          <p style={{ margin: "0 0 12px 0", color: T.textSec, fontSize: 12, fontWeight: 600 }}>Statistiche</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: T.bg, padding: 12, borderRadius: 6, textAlign: "center" }}>
              <p style={{ margin: 0, color: T.textSec, fontSize: 11 }}>Volume Totale</p>
              <p style={{ margin: "4px 0 0 0", color: T.text, fontSize: 16, fontWeight: "bold" }}>
                {totalVolume.toFixed(0)}kg
              </p>
            </div>
            <div style={{ background: T.bg, padding: 12, borderRadius: 6, textAlign: "center" }}>
              <p style={{ margin: 0, color: T.textSec, fontSize: 11 }}>Peso Medio</p>
              <p style={{ margin: "4px 0 0 0", color: T.text, fontSize: 16, fontWeight: "bold" }}>
                {avgWeight}kg
              </p>
            </div>
          </div>
        </div>

        <div style={{
          background: T.card, borderRadius: 8, padding: 16,
          border: `1px solid ${T.border}`,
        }}>
          <p style={{ margin: "0 0 12px 0", color: T.textSec, fontSize: 12, fontWeight: 600 }}>Ultimi Set</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sets.slice(0, 10).map((s, i) => (
              <div key={i} style={{
                background: T.bg, padding: 8, borderRadius: 6,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ color: T.text, fontSize: 12, fontWeight: "bold" }}>
                  {s.weight}kg × {s.reps}
                </span>
                <span style={{ color: T.textSec, fontSize: 10 }}>
                  {formatDate(s.timestamp || new Date())}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   WORKOUT CARD (UNCHANGED)
   ═══════════════════════════════════════════ */
const WorkoutCard = ({ workout, sets, customExercises, onTap }) => {
  const date = formatDate(workout.startTime);
  const duration = workout.endTime ? Math.round((new Date(workout.endTime) - new Date(workout.startTime)) / 60000) : 0;
  const uniqueExercises = [...new Set(sets.map(s => s.exerciseId))].length;

  return (
    <div onClick={onTap} style={{
      background: T.card, borderRadius: 8, padding: 12, border: `1px solid ${T.border}`,
      cursor: "pointer", marginBottom: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, color: T.text, fontSize: 13, fontWeight: "bold" }}>
            {date}
          </p>
          <p style={{ margin: "4px 0 0 0", color: T.textSec, fontSize: 11 }}>
            {uniqueExercises} esercizi · {sets.length} set · {duration}min
          </p>
        </div>
        <ChevronRight size={20} color={T.textSec} />
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   WORKOUT DETAIL SCREEN (UNCHANGED)
   ═══════════════════════════════════════════ */
const WorkoutDetailScreen = ({ workout, sets, customExercises, onBack, onExerciseDetail, onDelete }) => {
  const duration = workout.endTime ? Math.round((new Date(workout.endTime) - new Date(workout.startTime)) / 60000) : 0;
  const groupedByExercise = useMemo(() => {
    const grouped = {};
    sets.forEach(s => {
      if (!grouped[s.exerciseId]) {
        grouped[s.exerciseId] = [];
      }
      grouped[s.exerciseId].push(s);
    });
    return Object.entries(grouped).map(([exId, exSets]) => ({
      exerciseId: exId,
      name: getExerciseById(exId, customExercises)?.name || exId,
      sets: exSets,
    }));
  }, [sets, customExercises]);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, paddingBottom: 80 }}>
      <div style={{
        background: T.card, padding: 16, borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between",
      }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", cursor: "pointer",
        }}>
          <ChevronLeft size={24} color={T.text} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, color: T.text, fontSize: 14, fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis" }}>
            {formatDateFull(workout.startTime)}
          </p>
          <p style={{ margin: "4px 0 0 0", color: T.textSec, fontSize: 11 }}>
            {sets.length} set · {duration}min
          </p>
        </div>
        <button onClick={() => onDelete(workout.id)} style={{
          background: "none", border: "none", cursor: "pointer",
        }}>
          <Trash2 size={20} color={T.red} />
        </button>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {groupedByExercise.map((ex, idx) => (
          <div key={idx} onClick={() => onExerciseDetail(ex.exerciseId)} style={{
            background: T.card, borderRadius: 8, padding: 12, border: `1px solid ${T.border}`,
            cursor: "pointer",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, color: T.text, fontSize: 13, fontWeight: "bold" }}>
                  {ex.name}
                </p>
                <p style={{ margin: "4px 0 0 0", color: T.textSec, fontSize: 11 }}>
                  {ex.sets.length} set
                </p>
              </div>
              <ChevronRight size={20} color={T.textSec} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   TAB: ALLENAMENTO
   ═══════════════════════════════════════════ */
const TabAllenamento = ({ workouts, allSets, customExercises, routines, onStartRoutine, onSelectWorkout }) => {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      {routines.length > 0 && (
        <div style={{ background: T.card, borderRadius: 8, padding: 12, border: `1px solid ${T.border}` }}>
          <p style={{ margin: "0 0 12px 0", color: T.text, fontSize: 13, fontWeight: "bold" }}>Routine Salvate</p>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
            {routines.map(r => (
              <button key={r.id} onClick={() => onStartRoutine(r.id)} style={{
                padding: "8px 14px", background: T.tealLight, border: "none",
                borderRadius: 6, cursor: "pointer", color: T.teal, fontWeight: "bold",
                fontSize: 11, whiteSpace: "nowrap", flexShrink: 0,
              }}>
                {r.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: T.card, borderRadius: 8, padding: 12, border: `1px solid ${T.border}` }}>
        <p style={{ margin: "0 0 12px 0", color: T.text, fontSize: 13, fontWeight: "bold" }}>Allenamenti Recenti</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {workouts.slice(0, 10).map((w, idx) => {
            const sets = allSets.filter(s => s.workoutId === w.id);
            return (
              <WorkoutCard key={idx} workout={w} sets={sets} customExercises={customExercises} onTap={() => onSelectWorkout(w.id)} />
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   TAB: ROUTINE
   ═══════════════════════════════════════════ */
const TabRoutine = ({ routines, customExercises, onCreateRoutine, onEditRoutine, onDeleteRoutine, onStartRoutine }) => {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <button onClick={onCreateRoutine} style={{
        width: "100%", padding: 12, background: T.teal, color: "white", border: "none",
        borderRadius: 8, cursor: "pointer", fontWeight: "bold", fontSize: 14,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}>
        <Plus size={18} /> Nuova Routine
      </button>

      {routines.map(r => (
        <div key={r.id} style={{
          background: T.card, borderRadius: 8, padding: 12, border: `1px solid ${T.border}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, color: T.text, fontSize: 13, fontWeight: "bold" }}>{r.name}</p>
              <p style={{ margin: "4px 0 0 0", color: T.textSec, fontSize: 11 }}>
                {r.exercises?.length || 0} esercizi
              </p>
            </div>
            <button onClick={() => onStartRoutine(r.id)} style={{
              padding: "6px 12px", background: T.tealLight, border: "none",
              borderRadius: 6, cursor: "pointer", color: T.teal, fontWeight: "bold",
              fontSize: 11, marginRight: 8,
            }}>
              Inizia
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════
   TAB: STATISTICHE
   ═══════════════════════════════════════════ */
const TabStatistiche = ({ workouts, allSets, customExercises }) => {
  const totalWorkouts = workouts.length;
  const totalSets = allSets.length;
  const totalVolume = allSets.reduce((sum, s) => sum + ((s.weight || 0) * (s.reps || 0)), 0);

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
      }}>
        <div style={{
          background: T.card, borderRadius: 8, padding: 12, border: `1px solid ${T.border}`,
          textAlign: "center",
        }}>
          <p style={{ margin: 0, color: T.textSec, fontSize: 11, fontWeight: 600 }}>Allenamenti</p>
          <p style={{ margin: "8px 0 0 0", color: T.text, fontSize: 18, fontWeight: "bold" }}>
            {totalWorkouts}
          </p>
        </div>
        <div style={{
          background: T.card, borderRadius: 8, padding: 12, border: `1px solid ${T.border}`,
          textAlign: "center",
        }}>
          <p style={{ margin: 0, color: T.textSec, fontSize: 11, fontWeight: 600 }}>Set Totali</p>
          <p style={{ margin: "8px 0 0 0", color: T.text, fontSize: 18, fontWeight: "bold" }}>
            {totalSets}
          </p>
        </div>
        <div style={{
          background: T.card, borderRadius: 8, padding: 12, border: `1px solid ${T.border}`,
          textAlign: "center",
        }}>
          <p style={{ margin: 0, color: T.textSec, fontSize: 11, fontWeight: 600 }}>Volume</p>
          <p style={{ margin: "8px 0 0 0", color: T.text, fontSize: 18, fontWeight: "bold" }}>
            {(totalVolume / 1000).toFixed(1)}K
          </p>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   TABS & MAIN SCREEN
   ═══════════════════════════════════════════ */
const TABS = [
  { id: "allenamento", label: "Allenamento", icon: Dumbbell },
  { id: "routine", label: "Routine", icon: Bookmark },
  { id: "statistiche", label: "Statistiche", icon: BarChart3 },
];

const MainScreenWithTabs = (props) => {
  const {
    activeTab, setActiveTab, workouts, routines, customExercises,
    allSets, onStartRoutine, onSelectWorkout, onCreateRoutine,
    onEditRoutine, onDeleteRoutine,
  } = props;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{
        background: T.card, borderBottom: `1px solid ${T.border}`,
        display: "flex", gap: 0,
      }}>
        {TABS.map(tab => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: 12, background: "none", border: "none",
                cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 4,
                borderBottom: activeTab === tab.id ? `3px solid ${T.teal}` : "none",
                color: activeTab === tab.id ? T.teal : T.textSec,
              }}
            >
              <TabIcon size={20} />
              <span style={{ fontSize: 11 }}>{tab.label}</span>
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {activeTab === "allenamento" && (
          <TabAllenamento
            workouts={workouts}
            allSets={allSets}
            customExercises={customExercises}
            routines={routines}
            onStartRoutine={onStartRoutine}
            onSelectWorkout={onSelectWorkout}
          />
        )}
        {activeTab === "routine" && (
          <TabRoutine
            routines={routines}
            customExercises={customExercises}
            onCreateRoutine={onCreateRoutine}
            onEditRoutine={onEditRoutine}
            onDeleteRoutine={onDeleteRoutine}
            onStartRoutine={onStartRoutine}
          />
        )}
        {activeTab === "statistiche" && (
          <TabStatistiche
            workouts={workouts}
            allSets={allSets}
            customExercises={customExercises}
          />
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   GYM SECTION (ROOT COMPONENT)
   ═══════════════════════════════════════════ */
export default function GymSection({ onNavigate }) {
  const [subScreen, setSubScreen] = useState("main");
  const [activeTab, setActiveTab] = useState("allenamento");
  const [workouts, setWorkouts] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [customExercises, setCustomExercises] = useState([]);
  const [allSets, setAllSets] = useState([]);
  const [toast, setToast] = useState(null);
  const [selectedRoutine, setSelectedRoutine] = useState(null);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState(null);
  const [editingRoutineId, setEditingRoutineId] = useState(null);
  const [newRoutineName, setNewRoutineName] = useState(null);
  const [newRoutineExercises, setNewRoutineExercises] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [wks, routs, customs, sets] = await Promise.all([
        getAllGymWorkouts(),
        getAllGymRoutines(),
        getAllGymCustomExercises(),
        getAllGymSets(),
      ]);
      setWorkouts(wks || []);
      setRoutines(routs || []);
      setCustomExercises(customs || []);
      setAllSets(sets || []);
    } catch (err) {
      console.error("Error loading gym data:", err);
    }
  };

  const handleStartRoutine = (routineId) => {
    const routine = routines.find(r => r.id === routineId);
    if (routine) {
      setSelectedRoutine(routine);
      setSubScreen("workout");
    }
  };

  const handleCreateRoutine = () => {
    setSubScreen("nameModal");
    setEditingRoutineId(null);
    setNewRoutineName(null);
    setNewRoutineExercises([]);
  };

  const handleEditRoutine = (routineId) => {
    const routine = routines.find(r => r.id === routineId);
    if (routine) {
      setEditingRoutineId(routineId);
      setNewRoutineName(routine.name);
      setNewRoutineExercises(routine.exercises || []);
      setSubScreen("routineEditor");
    }
  };

  const handleSaveRoutine = async (exercises) => {
    try {
      if (!newRoutineName) {
        setToast({ message: "Nome routine richiesto", icon: <AlertTriangle size={16} color={T.red} /> });
        return;
      }
      if (editingRoutineId) {
        await updateGymRoutine(editingRoutineId, { name: newRoutineName, exercises });
      } else {
        await addGymRoutine({ name: newRoutineName, exercises });
      }

      await loadData();
      setSubScreen("main");
      setNewRoutineName(null);
      setNewRoutineExercises([]);
      setEditingRoutineId(null);
      setToast({ message: "Routine salvata!", icon: <Check size={16} color={T.green} /> });
    } catch (err) {
      console.error("Error saving routine:", err);
      setToast({ message: "Errore salvataggio", icon: <AlertTriangle size={16} color={T.red} /> });
    }
  };

  const handleDeleteRoutine = async (routineId) => {
    try {
      await deleteGymRoutine(routineId);
      await loadData();
      setToast({ message: "Routine eliminata", icon: <Check size={16} color={T.green} /> });
    } catch (err) {
      console.error("Error deleting routine:", err);
    }
  };

  const handleCompleteWorkout = async () => {
    await loadData();
    setSubScreen("main");
    setSelectedRoutine(null);
    setToast({ message: "Allenamento completato!", icon: <Check size={16} color={T.green} /> });
  };

  const handleSelectWorkout = (workoutId) => {
    const workout = workouts.find(w => w.id === workoutId);
    if (workout) {
      setSelectedWorkout(workout);
      setSubScreen("workoutDetail");
    }
  };

  const handleExerciseDetail = (exerciseId) => {
    setSelectedExerciseId(exerciseId);
    setSubScreen("exerciseDetail");
  };

  const handleDeleteWorkout = async (workoutId) => {
    try {
      await deleteGymWorkout(workoutId);
      await loadData();
      setSubScreen("main");
      setToast({ message: "Allenamento eliminato", icon: <Check size={16} color={T.green} /> });
    } catch (err) {
      console.error("Error deleting workout:", err);
    }
  };

  if (subScreen === "nameModal") {
    return (
      <NameModal
        onContinue={(name) => {
          setNewRoutineName(name);
          setSubScreen("pickExercises");
        }}
        onClose={() => setSubScreen("main")}
        title="Nome Routine"
      />
    );
  }

  if (subScreen === "pickExercises") {
    return (
      <ExercisePicker
        onSelect={() => {}}
        onClose={() => setSubScreen("main")}
        customExercises={customExercises}
        onAddCustom={() => {}}
        multiSelect={true}
        onMultiSelect={(selected) => {
          setNewRoutineExercises(selected.map(e => ({
            exerciseId: e.id,
            sets: [{ weight: 0, reps: 0, type: "N" }],
            restTimer: 90, warmupTimer: 60, sideTimer: 15,
            unilateral: e.uni || false, supersetWith: null, note: "",
          })));
          setSubScreen("routineEditor");
        }}
      />
    );
  }

  if (subScreen === "routineEditor") {
    return (
      <RoutineEditor
        routine={{ name: newRoutineName, exercises: newRoutineExercises, id: editingRoutineId }}
        exercises={newRoutineExercises}
        onSave={(exs) => {
          setNewRoutineExercises(exs);
          setSubScreen("routineSummary");
        }}
        onClose={() => setSubScreen("main")}
        customExercises={customExercises}
        onAddCustomExercise={() => {}}
        onAddExercises={() => {}}
      />
    );
  }

  if (subScreen === "routineSummary") {
    return (
      <RoutineSummary
        name={newRoutineName}
        exercises={newRoutineExercises}
        onSave={() => handleSaveRoutine(newRoutineExercises)}
        onBack={() => setSubScreen("routineEditor")}
        customExercises={customExercises}
      />
    );
  }

  if (subScreen === "workoutDetail") {
    const workout = selectedWorkout;
    const sets = allSets.filter(s => s.workoutId === workout?.id);
    return (
      <WorkoutDetailScreen
        workout={workout}
        sets={sets}
        customExercises={customExercises}
        onBack={() => setSubScreen("main")}
        onExerciseDetail={handleExerciseDetail}
        onDelete={handleDeleteWorkout}
      />
    );
  }

  if (subScreen === "exerciseDetail") {
    return (
      <ExerciseDetailScreen
        exerciseId={selectedExerciseId}
        allWorkouts={workouts}
        allSets={allSets}
        customExercises={customExercises}
        onBack={() => setSubScreen(selectedWorkout ? "workoutDetail" : "main")}
      />
    );
  }

  if (subScreen === "workout" && selectedRoutine) {
    return (
      <ActiveWorkoutScreen
        workout={{
          id: Date.now().toString(),
          routineId: selectedRoutine.id,
          startTime: new Date().toISOString(),
          endTime: null,
          completed: false,
        }}
        exercises={selectedRoutine.exercises}
        customExercises={customExercises}
        onComplete={handleCompleteWorkout}
        onCancel={() => setSubScreen("main")}
        allSets={allSets}
        onExerciseDetail={handleExerciseDetail}
      />
    );
  }

  return (
    <div style={{
      width: "100%", minHeight: "100vh", background: T.bg,
      display: "flex", flexDirection: "column", position: "relative",
    }}>
      <MainScreenWithTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        workouts={workouts}
        routines={routines}
        customExercises={customExercises}
        allSets={allSets}
        onStartRoutine={handleStartRoutine}
        onSelectWorkout={handleSelectWorkout}
        onCreateRoutine={handleCreateRoutine}
        onEditRoutine={handleEditRoutine}
        onDeleteRoutine={handleDeleteRoutine}
      />
      {toast && (
        <Toast
          message={toast.message}
          icon={toast.icon}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
