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
            zIndex:3,pointerEvents:"none",
          }}/>
          <div style={{
            position:"absolute",bottom:0,left:0,right:0,height:ITEM_H*2,
            background:"linear-gradient(to top,rgba(255,255,255,0.92),rgba(255,255,255,0))",
            zIndex:3,pointerEvents:"none",
          }}/>
          <div ref={containerRef} onScroll={handleScroll} style={{
            height:"100%",overflowY:"auto",scrollSnapType:"y mandatory",
            WebkitOverflowScrolling:"touch",position:"relative",zIndex:2,
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
const EMPTY_CUSTOM_FORM = { name: "", muscle: "Petto", equipment: "Bilanciere", uni: false };

const ExercisePicker = ({ onSelect, onClose, customExercises: initCustom, onAddCustom, multiSelect = false, onMultiSelect }) => {
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState(null);
  const [selected, setSelected] = useState(multiSelect ? [] : null);
  const [localCustom, setLocalCustom] = useState(initCustom || []);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customForm, setCustomForm] = useState(EMPTY_CUSTOM_FORM);
  const [saving, setSaving] = useState(false);

  const allExercises = useMemo(() => [...EXERCISES, ...localCustom], [localCustom]);

  const filtered = useMemo(() => {
    return allExercises.filter(e => {
      const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
      const matchMuscle = !muscleFilter || e.muscle === muscleFilter;
      return matchSearch && matchMuscle;
    });
  }, [search, muscleFilter, allExercises]);

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

  const isSelected = (ex) => {
    if (!selected) return false;
    if (Array.isArray(selected)) return selected.map(s => s.id || s.exerciseId).includes(ex.id);
    return selected.id === ex.id;
  };

  const handleSaveCustom = async () => {
    if (!customForm.name.trim() || saving) return;
    setSaving(true);
    const newEx = {
      id: `custom_${Date.now()}`,
      name: customForm.name.trim(),
      muscle: customForm.muscle,
      secondary: "",
      equipment: customForm.equipment,
      uni: customForm.uni,
      isCustom: true,
    };
    try {
      await addGymCustomExercise(newEx);
      setLocalCustom(prev => [...prev, newEx]);
      onAddCustom?.(newEx);
      setShowCustomForm(false);
      setCustomForm(EMPTY_CUSTOM_FORM);
    } catch (e) {
      console.error("Error saving custom exercise:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "flex-end", zIndex: 80,
    }}>
      <div style={{
        width: "100%", maxWidth: "430px", marginLeft: "auto", marginRight: "auto",
        background: T.card, borderRadius: "20px 20px 0 0", maxHeight: "88vh",
        display: "flex", flexDirection: "column",
      }}>
        {/* Handle */}
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 0" }}>
          <div style={{ width:36, height:4, borderRadius:2, background:T.border }} />
        </div>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 16px 8px",
        }}>
          <div style={{ fontSize:18, fontWeight:900, color:T.text }}>Scegli Esercizio</div>
          <button onClick={onClose} style={{
            width:32, height:32, borderRadius:10, background:T.bg, border:"none",
            display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
          }}>
            <X size={18} color={T.textSec} />
          </button>
        </div>
        {/* Search */}
        <div style={{ padding:"0 16px 8px" }}>
          <div style={{
            display:"flex", alignItems:"center", gap:8, background:T.bg,
            borderRadius:12, padding:"10px 14px", border:`1.5px solid ${T.border}`,
          }}>
            <Search size={16} color={T.textMuted} />
            <input
              type="text"
              placeholder="Cerca esercizio..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex:1, border:"none", background:"transparent", fontSize:14,
                color:T.text, outline:"none", fontFamily:"inherit",
              }}
            />
          </div>
        </div>
        {/* Muscle filter chips */}
        <div style={{ display:"flex", gap:6, overflowX:"auto", padding:"0 16px 10px", flexShrink:0 }}>
          <button onClick={() => setMuscleFilter(null)} style={{
            padding:"5px 12px", borderRadius:20, border:"none", cursor:"pointer",
            background: muscleFilter === null ? T.teal : T.bg,
            color: muscleFilter === null ? "#fff" : T.textSec,
            fontSize:12, fontWeight:700, whiteSpace:"nowrap", flexShrink:0,
          }}>Tutti</button>
          {MUSCLE_GROUPS.map(mg => (
            <button key={mg} onClick={() => setMuscleFilter(muscleFilter === mg ? null : mg)} style={{
              padding:"5px 12px", borderRadius:20, border:"none", cursor:"pointer",
              background: muscleFilter === mg ? (MUSCLE_COLORS[mg] || T.teal) : `${MUSCLE_COLORS[mg] || T.teal}15`,
              color: muscleFilter === mg ? "#fff" : (MUSCLE_COLORS[mg] || T.teal),
              fontSize:12, fontWeight:700, whiteSpace:"nowrap", flexShrink:0,
            }}>{mg}</button>
          ))}
        </div>
        {/* List */}
        <div style={{ flex:1, overflowY:"auto", padding:"0 16px 8px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map(ex => {
              const sel = isSelected(ex);
              return (
                <div
                  key={ex.id}
                  onClick={() => handleSelect(ex)}
                  style={{
                    padding: "12px 14px",
                    background: sel ? T.tealLight : T.bg,
                    borderRadius: 14, cursor: "pointer",
                    border: sel ? `1.5px solid ${T.teal}40` : `1.5px solid transparent`,
                    display:"flex", alignItems:"center", gap:10,
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink:0,
                    background: `${MUSCLE_COLORS[ex.muscle] || T.teal}20`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background: MUSCLE_COLORS[ex.muscle] || T.teal }} />
                  </div>
                  <div style={{ flex: 1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color: sel ? T.teal : T.text }}>
                      {ex.name}{ex.isCustom ? " ✦" : ""}
                    </div>
                    <div style={{ fontSize:11, color: T.textSec, marginTop:1 }}>
                      {ex.muscle} · {ex.equipment}{ex.uni ? " · Unilat." : ""}
                    </div>
                  </div>
                  {sel && <Check size={18} color={T.teal} />}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ textAlign:"center", padding:"32px 0 20px", color:T.textMuted }}>
                <Search size={32} color={T.border} style={{marginBottom:8}} />
                <div style={{fontSize:13}}>Nessun esercizio trovato</div>
              </div>
            )}
            {/* Create custom — always at bottom of list */}
            <div style={{ paddingTop:6, paddingBottom:4 }}>
              <button onClick={() => setShowCustomForm(true)} style={{
                width:"100%", padding:"12px 14px",
                background:`${T.purple}10`, border:`1.5px dashed ${T.purple}50`,
                borderRadius:14, cursor:"pointer",
                display:"flex", alignItems:"center", gap:10,
              }}>
                <div style={{
                  width:36, height:36, borderRadius:10, background:`${T.purple}20`,
                  display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                }}>
                  <Plus size={18} color={T.purple} />
                </div>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontSize:14, fontWeight:700, color:T.purple }}>Crea esercizio personalizzato</div>
                  <div style={{ fontSize:11, color:`${T.purple}80` }}>Aggiungilo al tuo database</div>
                </div>
              </button>
            </div>
          </div>
        </div>
        {/* Footer */}
        {multiSelect && (
          <div style={{ padding:"12px 16px 28px", borderTop:`1px solid ${T.border}` }}>
            <button onClick={() => onMultiSelect(selected)} style={{
              width:"100%", padding: "14px 0",
              background: selected.length > 0 ? T.gradient : T.bg,
              color: selected.length > 0 ? "white" : T.textMuted,
              border: "none", borderRadius: 14, cursor: "pointer",
              fontSize: 14, fontWeight: 800,
              boxShadow: selected.length > 0 ? "0 2px 10px rgba(2,128,144,0.25)" : "none",
            }}>Aggiungi {selected.length > 0 ? `(${selected.length})` : ""}</button>
          </div>
        )}
      </div>

      {/* Custom Exercise Form — fixed overlay on top */}
      {showCustomForm && (
        <div style={{
          position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.6)",
          display:"flex", alignItems:"flex-end", justifyContent:"center",
        }} onClick={() => setShowCustomForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background:T.card, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:430,
            padding:"20px 20px 40px", maxHeight:"85vh", overflowY:"auto",
          }}>
            {/* Handle */}
            <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
              <div style={{ width:36, height:4, borderRadius:2, background:T.border }} />
            </div>
            {/* Title */}
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
              <div style={{
                width:44, height:44, borderRadius:14, background:`${T.purple}20`,
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <Plus size={22} color={T.purple} />
              </div>
              <div>
                <div style={{ fontSize:17, fontWeight:900, color:T.text }}>Nuovo esercizio</div>
                <div style={{ fontSize:12, color:T.textSec }}>Verrà salvato nel tuo database</div>
              </div>
            </div>
            {/* Name */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:T.textSec, marginBottom:6, textTransform:"uppercase", letterSpacing:0.5 }}>Nome</div>
              <div style={{
                display:"flex", alignItems:"center", background:T.bg,
                borderRadius:12, padding:"12px 14px", border:`1.5px solid ${T.border}`,
              }}>
                <input
                  type="text"
                  placeholder="Es. Curl cavi bassa carrucola..."
                  value={customForm.name}
                  onChange={e => setCustomForm(f => ({...f, name: e.target.value}))}
                  autoFocus
                  style={{
                    flex:1, border:"none", background:"transparent", fontSize:14,
                    color:T.text, outline:"none", fontFamily:"inherit", fontWeight:600,
                  }}
                />
              </div>
            </div>
            {/* Muscle group */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:T.textSec, marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>Gruppo muscolare</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {MUSCLE_GROUPS.map(mg => {
                  const active = customForm.muscle === mg;
                  return (
                    <button key={mg} onClick={() => setCustomForm(f => ({...f, muscle: mg}))} style={{
                      padding:"7px 14px", borderRadius:20, border:"none", cursor:"pointer",
                      background: active ? (MUSCLE_COLORS[mg] || T.teal) : `${MUSCLE_COLORS[mg] || T.teal}15`,
                      color: active ? "#fff" : (MUSCLE_COLORS[mg] || T.teal),
                      fontSize:13, fontWeight:700,
                    }}>{mg}</button>
                  );
                })}
              </div>
            </div>
            {/* Equipment */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:T.textSec, marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>Attrezzatura</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {EQUIPMENT.map(eq => {
                  const active = customForm.equipment === eq;
                  return (
                    <button key={eq} onClick={() => setCustomForm(f => ({...f, equipment: eq}))} style={{
                      padding:"7px 14px", borderRadius:20, border:"none", cursor:"pointer",
                      background: active ? T.teal : T.bg,
                      color: active ? "#fff" : T.textSec,
                      fontSize:13, fontWeight:700,
                      border: active ? "none" : `1px solid ${T.border}`,
                    }}>{eq}</button>
                  );
                })}
              </div>
            </div>
            {/* Save */}
            <button
              onClick={handleSaveCustom}
              disabled={!customForm.name.trim() || saving}
              style={{
                width:"100%", padding:"15px 0",
                background: customForm.name.trim() ? T.gradient : T.bg,
                color: customForm.name.trim() ? "#fff" : T.textMuted,
                border:"none", borderRadius:14, cursor: customForm.name.trim() ? "pointer" : "default",
                fontSize:15, fontWeight:800,
                boxShadow: customForm.name.trim() ? "0 2px 12px rgba(2,128,144,0.3)" : "none",
              }}
            >
              {saving ? "Salvataggio..." : "Salva esercizio"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   EXERCISE MENU (BOTTOM SHEET)
   ═══════════════════════════════════════════ */
const ExerciseMenu = ({
  onUnilateral, onSuperset, onMove, onDelete, isUnilateral, isSupersetted,
  isLastExercise, exerciseName,
}) => {
  const [open, setOpen] = useState(false);
  const menuItem = (icon, label, sublabel, onClick, color = T.text, bg = `${T.border}50`, active = false) => (
    <button onClick={() => { onClick(); setOpen(false); }} style={{
      width:"100%", padding:"13px 16px", background: active ? `${color}15` : "transparent",
      border:"none", borderRadius:14, cursor:"pointer",
      display:"flex", alignItems:"center", gap:12, marginBottom:6,
    }}>
      <div style={{
        width:40, height:40, borderRadius:12, background: bg,
        display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
      }}>
        {icon}
      </div>
      <div style={{ flex:1, textAlign:"left" }}>
        <div style={{ fontSize:14, fontWeight:700, color }}>{label}</div>
        {sublabel && <div style={{ fontSize:11, color:`${color}99`, marginTop:1 }}>{sublabel}</div>}
      </div>
      {active && <Check size={18} color={color} />}
    </button>
  );
  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        background:"none", border:"none", cursor:"pointer", padding:6,
        borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        <MoreVertical size={20} color={T.textSec} />
      </button>

      {open && (
        <div style={{
          position:"fixed", inset:0, zIndex:500, background:"rgba(0,0,0,0.45)",
          display:"flex", alignItems:"flex-end", justifyContent:"center",
        }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background:T.card, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:430,
            paddingBottom:34,
          }}>
            {/* Handle */}
            <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
              <div style={{ width:36, height:4, borderRadius:2, background:T.border }} />
            </div>
            {/* Title */}
            {exerciseName && (
              <div style={{
                fontSize:13, fontWeight:700, color:T.textMuted,
                padding:"6px 20px 12px", textAlign:"center",
              }}>{exerciseName}</div>
            )}
            <div style={{ padding:"0 12px" }}>
              {menuItem(
                <ArrowLeftRight size={19} color={T.teal} />,
                "Unilaterale",
                isUnilateral ? "Attivo — tocca per disattivare" : "Esercizio su un lato alla volta",
                onUnilateral, T.teal, `${T.teal}18`, isUnilateral,
              )}
              {!isLastExercise && menuItem(
                <Link2 size={19} color={T.orange} />,
                "Superset",
                isSupersetted ? "Attivo — tocca per rimuovere" : "Collega col prossimo esercizio",
                onSuperset, T.orange, `${T.orange}18`, isSupersetted,
              )}
              {menuItem(
                <GripVertical size={19} color={T.purple} />,
                "Sposta",
                "Cambia posizione nella lista",
                onMove, T.purple, `${T.purple}18`, false,
              )}
              {menuItem(
                <Trash2 size={19} color={T.red} />,
                "Elimina esercizio",
                "Rimuovi dalla routine",
                onDelete, T.red, `${T.red}18`, false,
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/* ═══════════════════════════════════════════
   NAME MODAL
   ═══════════════════════════════════════════ */
const NameModal = ({ onContinue, onClose, title = "Nome Routine" }) => {
  const [name, setName] = useState("");
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
      padding: 20,
    }}>
      <div style={{
        background: T.card, borderRadius: 20, padding: "24px 20px 20px", width: "100%", maxWidth: 340,
        boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
      }}>
        {/* Icon */}
        <div style={{
          width:56, height:56, borderRadius:18, background:T.gradient,
          display:"flex", alignItems:"center", justifyContent:"center",
          marginBottom:16, boxShadow:"0 4px 16px rgba(2,128,144,0.3)",
        }}>
          <Dumbbell size={26} color="#fff" />
        </div>
        <div style={{ fontSize:18, fontWeight:900, color:T.text, marginBottom:4 }}>{title}</div>
        <div style={{ fontSize:13, color:T.textSec, marginBottom:18 }}>Dai un nome alla tua routine 💪</div>
        <div style={{
          display:"flex", alignItems:"center", gap:8, background:T.bg,
          borderRadius:12, padding:"12px 14px", border:`1.5px solid ${T.border}`,
          marginBottom:20,
        }}>
          <input
            type="text"
            placeholder="Es. Push Day, Gambe..."
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            style={{
              flex:1, border:"none", background:"transparent", fontSize:15,
              color:T.text, outline:"none", fontFamily:"inherit", fontWeight:600,
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 13, background: T.bg, border: `1.5px solid ${T.border}`,
            borderRadius: 12, cursor: "pointer", color: T.textSec, fontSize:14, fontWeight:700,
          }}>Annulla</button>
          <button onClick={() => {
            if (name.trim()) onContinue(name.trim());
          }} style={{
            flex: 1, padding: 13, background: name.trim() ? T.gradient : T.bg,
            border: "none", borderRadius: 12, cursor: name.trim() ? "pointer" : "default",
            color: name.trim() ? "white" : T.textMuted, fontSize:14, fontWeight:800,
            boxShadow: name.trim() ? "0 2px 10px rgba(2,128,144,0.25)" : "none",
          }}>Continua</button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   ROUTINE EDITOR (POLISHED VERSION)
   ═══════════════════════════════════════════ */
const RoutineEditor = ({ routine, exercises, onSave, onClose, customExercises, defaultTimers, onAddCustomExercise, onAddExercises }) => {
  const [exs, setExs] = useState(exercises || []);
  const [showPicker, setShowPicker] = useState(false);
  const [reorderIdx, setReorderIdx] = useState(null);
  const [numpad, setNumpad] = useState(null);
  const [drumPicker, setDrumPicker] = useState(null);

  const dt = defaultTimers || { rest: 90, warmup: 60, side: 15 };

  const addExercises = (newExs) => {
    setExs(prev => [...prev, ...newExs.map(e => ({
      exerciseId: e.id,
      sets: [{ weight: 0, reps: 0, type: "N" }],
      restTimer: dt.rest, warmupTimer: dt.warmup, sideTimer: dt.side,
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
              {/* Superset connector bar (between cards) */}
              {isSuperset && (
                <div style={{
                  position:"absolute",left:16,right:16,bottom:-7,height:14,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  zIndex:2,pointerEvents:"none",
                }}>
                  <div style={{ flex:1,height:2,background:`${T.orange}50` }} />
                  <div style={{
                    padding:"2px 8px",background:T.orange,borderRadius:20,
                    fontSize:9,fontWeight:900,color:"#fff",letterSpacing:0.5,
                    margin:"0 6px",
                  }}>SUPERSET</div>
                  <div style={{ flex:1,height:2,background:`${T.orange}50` }} />
                </div>
              )}

              <div style={{
                background:T.card,borderRadius:16,marginBottom:isSuperset ? 20 : 14,
                border: reorderIdx === exIdx
                  ? `2px solid ${T.teal}`
                  : (isSuperset || isPrevSuperset)
                    ? `2px solid ${T.orange}60`
                    : `1px solid ${T.border}`,
                boxShadow: (isSuperset || isPrevSuperset)
                  ? `0 2px 12px ${T.orange}20`
                  : T.shadow,
                overflow:"hidden",
              }}>
                {/* Exercise Header */}
                <div style={{
                  display:"flex",alignItems:"center",gap:8,
                  padding:"12px 10px 10px 12px",
                  borderBottom:`1px solid ${T.border}`,
                  background: isSuperset
                    ? `${T.orange}08`
                    : isPrevSuperset
                      ? `${T.orange}08`
                      : "transparent",
                }}>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <div style={{ fontSize:14,fontWeight:800,color:muscleColor }}>{info?.name || "Esercizio"}</div>
                      {(isSuperset || isPrevSuperset) && (
                        <div style={{
                          padding:"1px 6px",background:`${T.orange}20`,borderRadius:6,
                          fontSize:9,fontWeight:900,color:T.orange,letterSpacing:0.3,
                        }}>SS</div>
                      )}
                    </div>
                    <div style={{ fontSize:10,color:T.textMuted,fontWeight:500 }}>
                      {info?.muscle} · {info?.equipment}
                    </div>
                  </div>

                  {/* Timer pills inline */}
                  <div style={{ display:"flex",gap:4,flexWrap:"wrap",flexShrink:0 }}>
                    <button onClick={() => setDrumPicker({ exIdx, field:"restTimer", title:"Riposo" })} style={{
                      display:"flex",alignItems:"center",gap:5,
                      background:`${T.teal}12`,border:"none",borderRadius:10,
                      padding:"6px 10px",cursor:"pointer",
                    }}>
                      <Timer size={13} color={T.teal} />
                      <span style={{ fontSize:12,fontWeight:700,color:T.teal }}>{fmtTimer(ex.restTimer)}</span>
                    </button>
                    {hasWarmup(ex) && (
                      <button onClick={() => setDrumPicker({ exIdx, field:"warmupTimer", title:"Warmup" })} style={{
                        display:"flex",alignItems:"center",gap:5,
                        background:"#EAB30815",border:"none",borderRadius:10,
                        padding:"6px 10px",cursor:"pointer",
                      }}>
                        <Flame size={13} color="#EAB308" />
                        <span style={{ fontSize:12,fontWeight:700,color:"#EAB308" }}>{fmtTimer(ex.warmupTimer)}</span>
                      </button>
                    )}
                    {ex.unilateral && (
                      <button onClick={() => setDrumPicker({ exIdx, field:"sideTimer", title:"Timer lati" })} style={{
                        display:"flex",alignItems:"center",gap:5,
                        background:`${T.purple}12`,border:"none",borderRadius:10,
                        padding:"6px 10px",cursor:"pointer",
                      }}>
                        <ArrowLeftRight size={13} color={T.purple} />
                        <span style={{ fontSize:12,fontWeight:700,color:T.purple }}>{fmtTimer(ex.sideTimer)}</span>
                      </button>
                    )}
                  </div>

                  {/* 3-dot menu */}
                  <ExerciseMenu
                    isUnilateral={ex.unilateral}
                    isSupersetted={ex.supersetWith !== null}
                    isLastExercise={exIdx === exs.length - 1}
                    exerciseName={info?.name}
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
  const pageRef = useRef(null);
  const duration = estimateRoutineDuration(exercises);
  const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets || []).length, 0);

  // Always start at top regardless of previous scroll position
  useEffect(() => {
    if (pageRef.current) pageRef.current.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

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
  const totalMuscSets = muscleBreakdown.reduce((s, m) => s + m.sets, 0);

  return (
    <div ref={pageRef} style={{ minHeight:"100vh", background:T.bg, paddingBottom:100, overflowY:"auto" }}>
      {/* Hero header */}
      <div style={{
        background:T.gradient, padding:"56px 24px 32px",
        borderRadius:"0 0 32px 32px", marginBottom:24,
        position:"relative", overflow:"hidden",
      }}>
        {/* Decorative circles */}
        <div style={{
          position:"absolute", top:-40, right:-40, width:160, height:160,
          borderRadius:"50%", background:"rgba(255,255,255,0.08)",
        }}/>
        <div style={{
          position:"absolute", bottom:-20, left:-20, width:100, height:100,
          borderRadius:"50%", background:"rgba(255,255,255,0.06)",
        }}/>

        <button onClick={onBack} style={{
          background:"rgba(255,255,255,0.18)", border:"none", borderRadius:12,
          width:38, height:38, display:"flex", alignItems:"center", justifyContent:"center",
          cursor:"pointer", marginBottom:24, position:"relative",
        }}><ChevronLeft size={18} color="#fff" /></button>

        {/* Check icon */}
        <div style={{
          width:56, height:56, borderRadius:18,
          background:"rgba(255,255,255,0.2)",
          border:"2px solid rgba(255,255,255,0.4)",
          display:"flex", alignItems:"center", justifyContent:"center",
          marginBottom:14,
        }}>
          <Check size={28} color="#fff" strokeWidth={3} />
        </div>

        {/* Label */}
        <div style={{
          fontSize:11, fontWeight:800, color:"rgba(255,255,255,0.65)",
          letterSpacing:1.2, textTransform:"uppercase", marginBottom:6,
        }}>Routine pronta</div>

        {/* Name — large, bold */}
        <div style={{
          fontSize:28, fontWeight:900, color:"#fff", lineHeight:1.15,
          letterSpacing:-0.5, marginBottom:20,
          textShadow:"0 2px 12px rgba(0,0,0,0.15)",
        }}>{name}</div>

        {/* Stats row */}
        <div style={{ display:"flex", gap:0 }}>
          {[
            { label:"Esercizi", value:exercises.length, icon:"🏋️" },
            { label:"Serie totali", value:totalSets, icon:"🔢" },
            { label:"Durata", value:`~${duration}min`, icon:"⏱️" },
          ].map((s, i) => (
            <div key={i} style={{
              flex:1, textAlign:"center",
              borderRight: i < 2 ? "1px solid rgba(255,255,255,0.2)" : "none",
              padding:"0 8px",
            }}>
              <div style={{ fontSize:11, marginBottom:3 }}>{s.icon}</div>
              <div style={{ fontSize:20, fontWeight:900, color:"#fff", lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.65)", fontWeight:600, marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding:"0 16px" }}>
        {/* Muscle breakdown — visual grid */}
        <div style={{ fontSize:12, fontWeight:800, color:T.textMuted, textTransform:"uppercase", letterSpacing:0.6, marginBottom:12 }}>
          Gruppi muscolari
        </div>
        <div style={{
          background:T.card, borderRadius:18, padding:20, marginBottom:20,
          border:`1px solid ${T.border}`, boxShadow:T.shadow,
        }}>
          {/* Stacked horizontal bar showing distribution */}
          <div style={{ display:"flex", height:12, borderRadius:8, overflow:"hidden", marginBottom:18, gap:2 }}>
            {muscleBreakdown.map((m, i) => (
              <div key={i} style={{
                flex: m.sets,
                background: m.color,
                borderRadius: i === 0 ? "6px 0 0 6px" : i === muscleBreakdown.length - 1 ? "0 6px 6px 0" : 0,
                transition:"flex 0.4s",
              }} title={`${m.muscle}: ${m.sets} serie`} />
            ))}
          </div>

          {/* Per-muscle rows */}
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {muscleBreakdown.map((m, i) => {
              const pct = Math.round((m.sets / totalMuscSets) * 100);
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12 }}>
                  {/* Color dot */}
                  <div style={{
                    width:10, height:10, borderRadius:"50%", background:m.color, flexShrink:0,
                  }}/>
                  {/* Name */}
                  <div style={{ fontSize:13, fontWeight:700, color:T.text, flex:1 }}>{m.muscle}</div>
                  {/* Progress bar */}
                  <div style={{ flex:2, height:6, background:T.bg, borderRadius:4, overflow:"hidden" }}>
                    <div style={{
                      height:"100%", width:`${pct}%`,
                      background:m.color, borderRadius:4,
                    }}/>
                  </div>
                  {/* Sets count */}
                  <div style={{
                    fontSize:12, fontWeight:800, color:m.color,
                    minWidth:50, textAlign:"right",
                  }}>{m.sets} {m.sets === 1 ? "serie" : "serie"} · {pct}%</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action buttons */}
        <button onClick={() => onSave(name, exercises)} style={{
          width:"100%", padding:"17px", borderRadius:16, border:"none",
          background:T.gradient, color:"#fff", fontSize:16, fontWeight:800,
          cursor:"pointer", boxShadow:"0 4px 20px rgba(2,128,144,0.35)",
          marginBottom:10, display:"flex", alignItems:"center", justifyContent:"center", gap:8,
        }}>
          <Check size={20} color="#fff" strokeWidth={3} /> Salva Routine
        </button>

        <button onClick={onBack} style={{
          width:"100%", padding:"14px", borderRadius:14,
          border:`1.5px solid ${T.border}`, background:T.card,
          color:T.textSec, fontSize:14, fontWeight:700, cursor:"pointer",
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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: T.bg, padding: 24 }}>
        <div style={{
          width:80, height:80, borderRadius:24, background:`${T.green}15`,
          display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20,
        }}>
          <CheckCircle2 size={44} color={T.green} />
        </div>
        <div style={{ fontSize:22, fontWeight:900, color:T.text, marginBottom:6 }}>Allenamento Completato!</div>
        <div style={{ fontSize:13, color:T.textSec, marginBottom:32, textAlign:"center" }}>Ottimo lavoro, continua così 💪</div>
        <button onClick={onComplete} style={{
          padding: "16px 40px", background: T.gradient, color: "white",
          border: "none", borderRadius: 14, cursor: "pointer", fontWeight: 800, fontSize:15,
          boxShadow:"0 4px 20px rgba(2,128,144,0.3)",
        }}>Chiudi</button>
      </div>
    );
  }

  const progressPct = Math.round(((currentExIdx * (currentEx?.sets?.length || 3) + currentSetIdx) / (exs.reduce((t,e) => t + (e.sets?.length||3), 0))) * 100);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, paddingBottom: 120 }}>
      {/* Header */}
      <div style={{
        background: T.card, padding: "14px 16px", borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <button onClick={onCancel} style={{
          width:36, height:36, borderRadius:12, background:T.tealLight, border:"none",
          display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0,
        }}>
          <ChevronLeft size={18} color={T.teal} />
        </button>
        <div style={{ flex: 1, minWidth:0 }}>
          <div style={{ fontSize:15, fontWeight:900, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {exInfo?.name}
          </div>
          <div style={{ fontSize:11, color:T.textSec, marginTop:1 }}>
            Esercizio {currentExIdx + 1}/{exs.length} · <span style={{ color:MUSCLE_COLORS[exInfo?.muscle]||T.teal, fontWeight:700 }}>{exInfo?.muscle}</span>
          </div>
        </div>
        <button onClick={onCancel} style={{
          width:36, height:36, borderRadius:12, background:`${T.red}12`, border:"none",
          display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
        }}>
          <X size={16} color={T.red} />
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: T.border, position:"relative" }}>
        <div style={{
          height: "100%", background: T.gradient,
          width: `${progressPct}%`,
          transition: "width 0.4s ease",
          borderRadius:"0 3px 3px 0",
        }}/>
      </div>

      <div style={{ padding: 16 }}>
        {/* Current set card */}
        <div style={{
          background: T.card, borderRadius: 16, padding: "20px 20px",
          boxShadow: T.shadow, border: `1px solid ${T.border}`,
        }}>
          <div style={{ marginBottom: 16, textAlign: "center" }}>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:8,
              background:T.bg, borderRadius:20, padding:"6px 16px",
            }}>
              <span style={{ fontSize:13, fontWeight:700, color:T.text }}>
                Serie {currentSetIdx + 1} di {currentEx.sets.length}
              </span>
              {currentSet?.type === "W" && (
                <span style={{ fontSize:11, fontWeight:800, color:"#EAB308", background:"#EAB30815", padding:"2px 8px", borderRadius:10 }}>WARMUP</span>
              )}
            </div>
          </div>

          {/* Kg / Reps buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <button onClick={() => setNumpad({ type: "weight" })} style={{
              padding: "18px 12px", background: T.bg, border: `1.5px solid ${T.border}`,
              borderRadius: 14, cursor: "pointer", textAlign: "center",
            }}>
              <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>Peso</div>
              <div style={{ fontSize:28, fontWeight:900, color:T.text, lineHeight:1 }}>
                {currentSet?.weight || 0}<span style={{ fontSize:14, color:T.textSec, fontWeight:600 }}>kg</span>
              </div>
            </button>
            <button onClick={() => setNumpad({ type: "reps" })} style={{
              padding: "18px 12px", background: T.bg, border: `1.5px solid ${T.border}`,
              borderRadius: 14, cursor: "pointer", textAlign: "center",
            }}>
              <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>Ripetizioni</div>
              <div style={{ fontSize:28, fontWeight:900, color:T.text, lineHeight:1 }}>
                {currentSet?.reps || 0}
              </div>
            </button>
          </div>

          {/* Complete set button */}
          <button onClick={handleCompleteSet} style={{
            width: "100%", padding: "16px", background: T.gradient, color: "white",
            border: "none", borderRadius: 14, cursor: "pointer", fontWeight: 800, fontSize: 15,
            boxShadow: "0 4px 16px rgba(2,128,144,0.3)",
          }}>
            {currentEx.unilateral && !currentSet?.sideCompleted ? "Completa Lato 1 →" :
             currentEx.unilateral && currentSet?.sideCompleted ? "Completa Lato 2 →" :
             "✓ Completa Serie"}
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
        display: "flex", gap: 8, padding: "12px 16px 32px", background: T.card,
        borderTop: `1px solid ${T.border}`,
      }}>
        <button
          onClick={() => { setCurrentExIdx(Math.max(0, currentExIdx - 1)); setCurrentSetIdx(0); }}
          disabled={currentExIdx === 0}
          style={{
            flex: 1, padding: 13, background: T.bg, border: `1.5px solid ${T.border}`,
            borderRadius: 12, cursor: currentExIdx === 0 ? "default" : "pointer",
            color: T.textSec, fontWeight: 700, fontSize: 13, opacity: currentExIdx === 0 ? 0.35 : 1,
            display:"flex", alignItems:"center", justifyContent:"center", gap:4,
          }}>
          <ChevronLeft size={16} /> Prec.
        </button>
        <button
          onClick={async () => { if (currentExIdx === exs.length - 1) { await saveWorkout(); } else { setCurrentExIdx(prev => prev + 1); setCurrentSetIdx(0); }}}
          style={{
            flex: 2, padding: 13,
            background: currentExIdx === exs.length - 1
              ? `linear-gradient(135deg, ${T.green}, #22c55e)`
              : T.gradient,
            color: "white", border: "none", borderRadius: 12, cursor: "pointer",
            fontWeight: 800, fontSize: 13,
            boxShadow: "0 2px 12px rgba(2,128,144,0.25)",
            display:"flex", alignItems:"center", justifyContent:"center", gap:4,
          }}>
          {currentExIdx === exs.length - 1 ? "Fine Allenamento ✓" : "Prossimo →"}
        </button>
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

  const mColor = MUSCLE_COLORS[info?.muscle] || T.teal;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{
        background: T.card, padding: "14px 16px", borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <button onClick={onBack} style={{
          width:36, height:36, borderRadius:12, background:T.tealLight, border:"none",
          display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0,
        }}>
          <ChevronLeft size={18} color={T.teal} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize:16, fontWeight:900, color:T.text }}>{info?.name || "Esercizio"}</div>
          <div style={{ fontSize:11, color:T.textSec, marginTop:2 }}>
            <span style={{ color:mColor, fontWeight:700 }}>{info?.muscle}</span> · {info?.equipment}
          </div>
        </div>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Stat cards */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[
            { label:"Volume Totale", value:`${totalVolume.toFixed(0)}kg`, color:T.teal },
            { label:"Peso Medio", value:`${avgWeight}kg`, color:T.purple },
            { label:"Set Totali", value:sets.length, color:T.orange },
            { label:"Allenamenti", value:[...new Set(sets.map(s=>s.workoutId))].length, color:T.green },
          ].map((stat,i) => (
            <div key={i} style={{
              background:T.card, borderRadius:14, padding:"14px 12px",
              boxShadow:T.shadow, border:`1px solid ${T.border}`, textAlign:"center",
            }}>
              <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>{stat.label}</div>
              <div style={{ fontSize:22, fontWeight:900, color:stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Last sets */}
        <div style={{
          background: T.card, borderRadius: 14, padding: 16,
          boxShadow: T.shadow, border: `1px solid ${T.border}`,
        }}>
          <div style={{ fontSize:13, fontWeight:800, color:T.text, marginBottom:12 }}>Ultimi Set</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sets.slice(0, 10).map((s, i) => (
              <div key={i} style={{
                background: T.bg, padding: "10px 12px", borderRadius: 10,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>
                  {s.weight}kg × {s.reps} rep
                </span>
                <span style={{ color: T.textMuted, fontSize: 11 }}>
                  {formatDate(s.timestamp || new Date())}
                </span>
              </div>
            ))}
            {sets.length === 0 && (
              <div style={{ textAlign:"center", padding:"20px 0", color:T.textMuted, fontSize:13 }}>Nessun dato disponibile</div>
            )}
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
  const date = formatDateFull(workout.startTime);
  const dayName = new Date(workout.startTime).toLocaleDateString("it-IT", { weekday: "long" });
  const duration = workout.endTime ? Math.round((new Date(workout.endTime) - new Date(workout.startTime)) / 60000) : 0;
  const uniqueExIds = [...new Set(sets.map(s => s.exerciseId))];
  const muscles = [...new Set(uniqueExIds.map(id => getExerciseById(id, customExercises)?.muscle).filter(Boolean))];

  return (
    <div onClick={onTap} style={{
      background: T.card, borderRadius: 14, padding: "14px 16px",
      boxShadow: T.shadow, cursor: "pointer",
      border: `1px solid ${T.border}`,
      display:"flex", alignItems:"center", gap:12,
    }}>
      {/* Date badge */}
      <div style={{
        width:44, height:44, borderRadius:12, background:T.tealLight,
        display:"flex", flexDirection:"column", alignItems:"center",
        justifyContent:"center", flexShrink:0,
      }}>
        <Dumbbell size={18} color={T.teal} />
      </div>
      <div style={{ flex: 1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.text, textTransform:"capitalize" }}>
          {dayName} — {date}
        </div>
        <div style={{ fontSize:11, color:T.textSec, marginTop:3 }}>
          {uniqueExIds.length} esercizi · {sets.length} set{duration > 0 ? ` · ${duration}min` : ""}
        </div>
        {muscles.length > 0 && (
          <div style={{ display:"flex", gap:4, marginTop:6, flexWrap:"wrap" }}>
            {muscles.slice(0,4).map(m => (
              <span key={m} style={{
                fontSize:9, fontWeight:800, padding:"2px 7px", borderRadius:20,
                background:`${MUSCLE_COLORS[m] || T.teal}18`,
                color:MUSCLE_COLORS[m] || T.teal,
              }}>{m}</span>
            ))}
          </div>
        )}
      </div>
      <ChevronRight size={18} color={T.textMuted} />
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

  const muscleColor = (exId) => MUSCLE_COLORS[getExerciseById(exId, customExercises)?.muscle] || T.teal;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{
        background: T.card, padding: "14px 16px", borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <button onClick={onBack} style={{
          width:36, height:36, borderRadius:12, background:T.tealLight, border:"none",
          display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0,
        }}>
          <ChevronLeft size={18} color={T.teal} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize:16, fontWeight:900, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {formatDateFull(workout.startTime)}
          </div>
          <div style={{ fontSize:11, color:T.textSec, marginTop:2 }}>
            {sets.length} set{duration > 0 ? ` · ${duration}min` : ""}
          </div>
        </div>
        <button onClick={() => onDelete(workout.id)} style={{
          width:36, height:36, borderRadius:12, background:`${T.red}12`, border:"none",
          display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
        }}>
          <Trash2 size={16} color={T.red} />
        </button>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {groupedByExercise.map((ex, idx) => (
          <div key={idx} onClick={() => onExerciseDetail(ex.exerciseId)} style={{
            background: T.card, borderRadius: 14, padding: "14px 16px",
            boxShadow: T.shadow, cursor: "pointer",
            border: `1px solid ${T.border}`,
            display:"flex", alignItems:"center", gap:12,
          }}>
            <div style={{
              width:36, height:36, borderRadius:10, flexShrink:0,
              background:`${muscleColor(ex.exerciseId)}20`,
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:muscleColor(ex.exerciseId) }} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:800, color:T.text }}>{ex.name}</div>
              <div style={{ fontSize:11, color:T.textSec, marginTop:2 }}>{ex.sets.length} serie</div>
            </div>
            <ChevronRight size={18} color={T.textMuted} />
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
  const [showRoutinePicker, setShowRoutinePicker] = useState(false);

  return (
    <div style={{ padding: "16px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Big CTA */}
      <button
        onClick={() => routines.length > 0 ? setShowRoutinePicker(true) : null}
        style={{
          width:"100%", padding:"18px 20px",
          background: routines.length > 0 ? T.gradient : T.bg,
          border: routines.length > 0 ? "none" : `1.5px dashed ${T.border}`,
          borderRadius:18, cursor: routines.length > 0 ? "pointer" : "default",
          display:"flex", alignItems:"center", justifyContent:"center", gap:12,
          boxShadow: routines.length > 0 ? "0 4px 20px rgba(2,128,144,0.35)" : "none",
        }}
      >
        <div style={{
          width:44, height:44, borderRadius:14,
          background: routines.length > 0 ? "rgba(255,255,255,0.2)" : T.border,
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <Play size={22} color={routines.length > 0 ? "#fff" : T.textMuted} fill={routines.length > 0 ? "#fff" : "none"} />
        </div>
        <div style={{ textAlign:"left" }}>
          <div style={{ fontSize:17, fontWeight:900, color: routines.length > 0 ? "#fff" : T.textMuted }}>
            {routines.length > 0 ? "Inizia Allenamento" : "Nessuna routine salvata"}
          </div>
          <div style={{ fontSize:12, color: routines.length > 0 ? "rgba(255,255,255,0.75)" : T.textMuted, marginTop:2 }}>
            {routines.length > 0
              ? `${routines.length} routine disponibil${routines.length === 1 ? "e" : "i"}`
              : "Crea prima una routine nella tab Routine"}
          </div>
        </div>
      </button>

      {/* Allenamenti recenti */}
      <div>
        <div style={{ fontSize:12, fontWeight:800, color:T.textMuted, textTransform:"uppercase", letterSpacing:0.6, marginBottom:10 }}>
          Ultimi allenamenti
        </div>
        {workouts.length === 0 ? (
          <div style={{
            background:T.card, borderRadius:16, padding:"36px 20px",
            boxShadow:T.shadow, border:`1px solid ${T.border}`, textAlign:"center",
          }}>
            <div style={{
              width:56, height:56, borderRadius:18, background:T.tealLight,
              display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px",
            }}>
              <Dumbbell size={24} color={T.teal} />
            </div>
            <div style={{ fontSize:15, fontWeight:800, color:T.text, marginBottom:5 }}>Nessun allenamento ancora</div>
            <div style={{ fontSize:12, color:T.textSec, lineHeight:1.5 }}>
              Completa il tuo primo allenamento per vederlo qui
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {workouts.slice(0, 3).map((w, idx) => {
              const sets = allSets.filter(s => s.workoutId === w.id);
              return (
                <WorkoutCard key={idx} workout={w} sets={sets} customExercises={customExercises} onTap={() => onSelectWorkout(w.id)} />
              );
            })}
          </div>
        )}
      </div>

      {/* Routine picker bottom sheet */}
      {showRoutinePicker && (
        <div style={{
          position:"fixed", inset:0, zIndex:400, background:"rgba(0,0,0,0.5)",
          display:"flex", alignItems:"flex-end", justifyContent:"center",
        }} onClick={() => setShowRoutinePicker(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background:T.card, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:430,
            paddingBottom:34, maxHeight:"70vh",
          }}>
            <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
              <div style={{ width:36, height:4, borderRadius:2, background:T.border }} />
            </div>
            <div style={{ padding:"8px 20px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontSize:17, fontWeight:900, color:T.text }}>Scegli Routine</div>
              <button onClick={() => setShowRoutinePicker(false)} style={{
                width:32, height:32, borderRadius:10, background:T.bg, border:"none",
                display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
              }}><X size={16} color={T.textSec} /></button>
            </div>
            <div style={{ overflowY:"auto", padding:"0 16px" }}>
              {routines.map(r => {
                const muscles = [...new Set((r.exercises||[]).map(e => getExerciseById(e.exerciseId, customExercises)?.muscle).filter(Boolean))];
                const estDur = estimateRoutineDuration(r.exercises || []);
                return (
                  <button key={r.id} onClick={() => { onStartRoutine(r.id); setShowRoutinePicker(false); }} style={{
                    width:"100%", padding:"14px 16px", marginBottom:8,
                    background:T.bg, border:`1.5px solid ${T.border}`,
                    borderRadius:14, cursor:"pointer", display:"flex", alignItems:"center", gap:12, textAlign:"left",
                  }}>
                    <div style={{
                      width:42, height:42, borderRadius:12, background:T.tealLight,
                      display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                    }}>
                      <Play size={18} color={T.teal} fill={T.teal} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:800, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</div>
                      <div style={{ fontSize:11, color:T.textSec, marginTop:2 }}>
                        {(r.exercises||[]).length} esercizi · ~{estDur}min
                      </div>
                      {muscles.length > 0 && (
                        <div style={{ display:"flex", gap:4, marginTop:5 }}>
                          {muscles.slice(0,4).map(m => (
                            <div key={m} style={{
                              padding:"2px 7px", borderRadius:10, fontSize:9, fontWeight:700,
                              background:`${MUSCLE_COLORS[m]||T.teal}20`,
                              color: MUSCLE_COLORS[m]||T.teal,
                            }}>{m}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={16} color={T.textMuted} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   TAB: ROUTINE
   ═══════════════════════════════════════════ */
const TabRoutine = ({ routines, customExercises, onCreateRoutine, onEditRoutine, onDeleteRoutine, onStartRoutine }) => {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* CTA crea routine */}
      <button onClick={onCreateRoutine} style={{
        width: "100%", padding: "15px", background: T.gradient, color: "white", border: "none",
        borderRadius: 14, cursor: "pointer", fontWeight: 800, fontSize: 15,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        boxShadow: "0 4px 16px rgba(2,128,144,0.3)",
      }}>
        <Plus size={20} /> Crea Nuova Routine
      </button>

      {routines.length === 0 && (
        <div style={{
          background:T.card, borderRadius:16, padding:"40px 20px",
          boxShadow:T.shadow, border:`1px solid ${T.border}`, textAlign:"center", marginTop:8,
        }}>
          <div style={{
            width:64, height:64, borderRadius:20, background:T.purpleLight,
            display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px",
          }}>
            <Bookmark size={28} color={T.purple} />
          </div>
          <div style={{ fontSize:15, fontWeight:800, color:T.text, marginBottom:6 }}>Nessuna routine</div>
          <div style={{ fontSize:13, color:T.textSec, lineHeight:1.5 }}>
            Crea la tua prima routine per iniziare ad allenarti con un programma strutturato
          </div>
        </div>
      )}

      {routines.map(r => {
        const estDur = estimateRoutineDuration(r.exercises || []);
        const muscles = [...new Set((r.exercises || []).map(e => getExerciseById(e.exerciseId, customExercises)?.muscle).filter(Boolean))];
        const totalSets = (r.exercises || []).reduce((sum, e) => sum + (e.sets?.length || 0), 0);
        return (
          <div key={r.id} style={{
            background: T.card, borderRadius: 16, padding: "16px",
            boxShadow: T.shadow, border: `1px solid ${T.border}`,
          }}>
            {/* Top row */}
            <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:12 }}>
              <div style={{
                width:44, height:44, borderRadius:12, background:T.purpleLight,
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
              }}>
                <Bookmark size={20} color={T.purple} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:900, color:T.text, marginBottom:2 }}>{r.name}</div>
                <div style={{ fontSize:12, color:T.textSec }}>
                  {(r.exercises||[]).length} esercizi · {totalSets} serie · ~{estDur}min
                </div>
              </div>
            </div>

            {/* Muscle dots */}
            {muscles.length > 0 && (
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
                {muscles.map(m => (
                  <span key={m} style={{
                    fontSize:10, fontWeight:800, padding:"3px 9px", borderRadius:20,
                    background:`${MUSCLE_COLORS[m]||T.teal}15`,
                    color:MUSCLE_COLORS[m]||T.teal,
                  }}>{m}</span>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => onStartRoutine(r.id)} style={{
                flex:2, padding:"11px 0", background:T.gradient, border:"none",
                borderRadius:12, cursor:"pointer", color:"white", fontWeight:800, fontSize:13,
                boxShadow:"0 2px 10px rgba(2,128,144,0.2)",
                display:"flex", alignItems:"center", justifyContent:"center", gap:5,
              }}>
                <Play size={14} /> Inizia
              </button>
              {onEditRoutine && (
                <button onClick={() => onEditRoutine(r.id)} style={{
                  flex:1, padding:"11px 0", background:T.bg, border:`1.5px solid ${T.border}`,
                  borderRadius:12, cursor:"pointer", color:T.textSec, fontWeight:700, fontSize:13,
                  display:"flex", alignItems:"center", justifyContent:"center", gap:4,
                }}>
                  <Edit3 size={13} /> Modifica
                </button>
              )}
              {onDeleteRoutine && (
                <button onClick={() => onDeleteRoutine(r.id)} style={{
                  width:40, height:40, background:`${T.red}10`, border:"none",
                  borderRadius:12, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  <Trash2 size={15} color={T.red} />
                </button>
              )}
            </div>
          </div>
        );
      })}
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

  // Weekly volume for last 8 weeks
  const weeklyVolume = useMemo(() => {
    const weeks = [];
    const now = new Date();
    for (let w = 7; w >= 0; w--) {
      const start = new Date(now); start.setDate(now.getDate() - w * 7 - 6);
      const end = new Date(now); end.setDate(now.getDate() - w * 7);
      const wSets = allSets.filter(s => {
        const d = new Date(s.timestamp || 0);
        return d >= start && d <= end;
      });
      const vol = wSets.reduce((sum, s) => sum + (s.weight||0)*(s.reps||0), 0);
      const label = `S${8-w}`;
      weeks.push({ week: label, volume: Math.round(vol / 1000 * 10) / 10 });
    }
    return weeks;
  }, [allSets]);

  // Top exercises by total volume
  const topExercises = useMemo(() => {
    const byEx = {};
    allSets.forEach(s => {
      if (!byEx[s.exerciseId]) byEx[s.exerciseId] = { volume:0, sets:0 };
      byEx[s.exerciseId].volume += (s.weight||0)*(s.reps||0);
      byEx[s.exerciseId].sets += 1;
    });
    return Object.entries(byEx)
      .map(([id, data]) => ({ id, name: getExerciseById(id, customExercises)?.name || id, ...data }))
      .sort((a,b) => b.volume - a.volume)
      .slice(0, 6);
  }, [allSets, customExercises]);

  const maxVol = Math.max(...topExercises.map(e => e.volume), 1);
  const maxWeekly = Math.max(...weeklyVolume.map(w => w.volume), 0.1);

  // Streak
  const streak = useMemo(() => {
    const dates = [...new Set(workouts.map(w => toISO(w.startTime)))].sort((a,b) => b.localeCompare(a));
    if (dates.length === 0) return 0;
    let s = 1;
    for (let i = 0; i < dates.length - 1; i++) {
      const d1 = new Date(dates[i]);
      const d2 = new Date(dates[i+1]);
      const diff = (d1 - d2) / (1000*60*60*24);
      if (diff <= 7) s++; else break;
    }
    return s;
  }, [workouts]);

  const statCards = [
    { label:"Allenamenti", value:totalWorkouts, color:T.teal, icon:Dumbbell },
    { label:"Set Totali", value:totalSets.toLocaleString(), color:T.purple, icon:BarChart3 },
    { label:"Volume (ton)", value:(totalVolume/1000).toFixed(1), color:T.orange, icon:TrendingUp },
    { label:"Streak sett.", value:streak, color:T.green, icon:Flame },
  ];

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Stat card grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {statCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} style={{
              background: T.card, borderRadius: 14, padding: "14px 14px",
              boxShadow: T.shadow, border:`1px solid ${T.border}`,
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <div style={{ width:28, height:28, borderRadius:8, background:`${s.color}15`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Icon size={14} color={s.color} />
                </div>
                <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:0.5 }}>{s.label}</div>
              </div>
              <div style={{ fontSize:26, fontWeight:900, color:s.color }}>{s.value}</div>
            </div>
          );
        })}
      </div>

      {/* Weekly volume chart */}
      {totalWorkouts > 0 && (
        <div style={{ background:T.card, borderRadius:16, padding:16, boxShadow:T.shadow, border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:13, fontWeight:800, color:T.text, marginBottom:14 }}>Volume settimanale (ton)</div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:80 }}>
            {weeklyVolume.map((w, i) => (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <div style={{
                  width:"100%", borderRadius:"4px 4px 0 0",
                  height: w.volume > 0 ? `${Math.max(8, (w.volume / maxWeekly) * 72)}px` : 4,
                  background: i === 7 ? T.gradient : `${T.teal}40`,
                  transition:"height 0.3s",
                }} />
                <div style={{ fontSize:8, fontWeight:700, color:T.textMuted }}>{w.week}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top exercises */}
      {topExercises.length > 0 && (
        <div style={{ background:T.card, borderRadius:16, padding:16, boxShadow:T.shadow, border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:13, fontWeight:800, color:T.text, marginBottom:14 }}>Esercizi più frequenti</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {topExercises.map((ex, i) => (
              <div key={i}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:T.text, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginRight:8 }}>
                    {i+1}. {ex.name}
                  </div>
                  <div style={{ fontSize:11, fontWeight:800, color:T.teal, flexShrink:0 }}>
                    {(ex.volume/1000).toFixed(1)}t
                  </div>
                </div>
                <div style={{ height:5, background:T.bg, borderRadius:3, overflow:"hidden" }}>
                  <div style={{
                    height:"100%", width:`${(ex.volume/maxVol)*100}%`,
                    background:T.gradient, borderRadius:3,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalWorkouts === 0 && (
        <div style={{
          background:T.card, borderRadius:16, padding:"40px 20px",
          boxShadow:T.shadow, border:`1px solid ${T.border}`, textAlign:"center",
        }}>
          <BarChart3 size={40} color={T.border} style={{ marginBottom:12 }} />
          <div style={{ fontSize:15, fontWeight:800, color:T.text, marginBottom:6 }}>Nessun dato ancora</div>
          <div style={{ fontSize:13, color:T.textSec }}>Le statistiche appariranno dopo il primo allenamento</div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   SETTINGS SCREEN
   ═══════════════════════════════════════════ */
const SettingsScreen = ({ defaultTimers, onSave, onBack }) => {
  const [timers, setTimers] = useState(defaultTimers);
  const [drumPicker, setDrumPicker] = useState(null);

  const timerRow = (label, sublabel, field, color, icon) => (
    <div style={{
      background:T.card, borderRadius:16, padding:"16px",
      border:`1px solid ${T.border}`, boxShadow:T.shadow,
      display:"flex", alignItems:"center", gap:14, marginBottom:10,
    }}>
      <div style={{
        width:44, height:44, borderRadius:13, background:`${color}18`,
        display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
      }}>
        {icon}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.text }}>{label}</div>
        <div style={{ fontSize:11, color:T.textSec, marginTop:2 }}>{sublabel}</div>
      </div>
      <button onClick={() => setDrumPicker({ field, title:label })} style={{
        display:"flex", alignItems:"center", gap:6,
        background:`${color}15`, border:`1.5px solid ${color}30`,
        borderRadius:12, padding:"8px 14px", cursor:"pointer",
      }}>
        <Timer size={14} color={color} />
        <span style={{ fontSize:15, fontWeight:900, color }}>{fmtTimer(timers[field])}</span>
      </button>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:T.bg }}>
      {/* Header */}
      <div style={{
        background:T.card, padding:"16px 20px",
        borderBottom:`1px solid ${T.border}`,
        display:"flex", alignItems:"center", gap:12,
      }}>
        <button onClick={onBack} style={{
          width:36, height:36, borderRadius:12, background:T.tealLight, border:"none",
          display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0,
        }}><ChevronLeft size={18} color={T.teal} /></button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:17, fontWeight:900, color:T.text }}>Impostazioni</div>
          <div style={{ fontSize:11, color:T.textSec }}>Timer predefiniti per gli esercizi</div>
        </div>
        <button onClick={() => onSave(timers)} style={{
          background:T.gradient, border:"none", borderRadius:12, padding:"9px 20px",
          color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer",
          boxShadow:"0 2px 10px rgba(2,128,144,0.25)",
        }}>Salva</button>
      </div>

      <div style={{ padding:20 }}>
        <div style={{
          fontSize:11, fontWeight:700, color:T.textMuted, textTransform:"uppercase",
          letterSpacing:0.6, marginBottom:14,
        }}>Timer di default per nuovi esercizi</div>

        {timerRow(
          "Timer riposo",
          "Pausa tra una serie e l'altra",
          "rest", T.teal,
          <Timer size={20} color={T.teal} />,
        )}
        {timerRow(
          "Timer warmup",
          "Pausa dopo le serie di riscaldamento",
          "warmup", "#EAB308",
          <Flame size={20} color="#EAB308" />,
        )}
        {timerRow(
          "Timer unilaterale",
          "Pausa tra lato destro e sinistro",
          "side", T.purple,
          <ArrowLeftRight size={20} color={T.purple} />,
        )}

        <div style={{
          background:T.tealLight, borderRadius:14, padding:"14px 16px", marginTop:6,
          border:`1px solid ${T.teal}30`,
        }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.teal, marginBottom:3 }}>💡 Come funziona</div>
          <div style={{ fontSize:12, color:T.textSec, lineHeight:1.6 }}>
            Questi timer vengono applicati automaticamente quando aggiungi esercizi a una nuova routine. Puoi sempre cambiarli singolarmente nell'editor della routine.
          </div>
        </div>
      </div>

      {drumPicker && (
        <DrumPicker
          value={timers[drumPicker.field]}
          title={drumPicker.title}
          onChange={(v) => setTimers(t => ({ ...t, [drumPicker.field]: v }))}
          onClose={() => setDrumPicker(null)}
        />
      )}
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
    onEditRoutine, onDeleteRoutine, onOpenSettings,
  } = props;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: T.bg }}>
      {/* Section header */}
      <div style={{
        background: T.card, padding: "16px 20px 12px",
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:22, fontWeight:900, color:T.text, lineHeight:1.1 }}>Palestra</div>
          <button onClick={onOpenSettings} style={{
            width:42, height:42, borderRadius:14, background:T.bg,
            border:`1.5px solid ${T.border}`,
            display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer", boxShadow:"none",
          }}>
            <Settings size={20} color={T.textSec} />
          </button>
        </div>

        {/* Tab bar */}
        <div style={{
          display:"flex", gap:6, marginTop:14,
          background:T.bg, borderRadius:12, padding:4,
        }}>
          {TABS.map(tab => {
            const TabIcon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex:1, padding:"8px 4px",
                  background: active ? T.card : "transparent",
                  border: "none", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  borderRadius: 10,
                  boxShadow: active ? "0 1px 6px rgba(0,0,0,0.08)" : "none",
                  color: active ? T.teal : T.textSec,
                  transition: "all 0.15s",
                }}
              >
                <TabIcon size={18} />
                <span style={{ fontSize: 10, fontWeight: active ? 800 : 600 }}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", paddingBottom: 80 }}>
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
const DEFAULT_TIMERS = { rest: 90, warmup: 60, side: 15 };

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
  const [defaultTimers, setDefaultTimers] = useState(DEFAULT_TIMERS);

  useEffect(() => {
    loadData();
    loadTimers();
  }, []);

  const loadTimers = async () => {
    try {
      const saved = await getGymRestTimer();
      if (saved && typeof saved === "object" && "rest" in saved) {
        setDefaultTimers(saved);
      }
    } catch (e) { /* use defaults */ }
  };

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

  const handleSaveSettings = async (timers) => {
    try {
      await saveGymRestTimer(timers);
      setDefaultTimers(timers);
    } catch (e) { console.error("Error saving timers:", e); }
    setSubScreen("main");
    setToast({ message: "Timer aggiornati!", icon: <Check size={16} color={T.green} /> });
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

  const handleSaveRoutine = async (routineName, exercises) => {
    try {
      const nameToUse = routineName || newRoutineName;
      if (!nameToUse) {
        setToast({ message: "Nome routine richiesto", icon: <AlertTriangle size={16} color={T.red} /> });
        return;
      }
      if (editingRoutineId) {
        await updateGymRoutine(editingRoutineId, { name: nameToUse, exercises });
      } else {
        await addGymRoutine({ name: nameToUse, exercises });
      }

      await loadData();
      setSubScreen("main");
      setActiveTab("routine");
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

  if (subScreen === "settings") {
    return (
      <SettingsScreen
        defaultTimers={defaultTimers}
        onSave={handleSaveSettings}
        onBack={() => setSubScreen("main")}
      />
    );
  }

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
        onAddCustom={(ex) => setCustomExercises(prev => [...prev, ex])}
        multiSelect={true}
        onMultiSelect={(selected) => {
          setNewRoutineExercises(selected.map(e => ({
            exerciseId: e.id,
            sets: [{ weight: 0, reps: 0, type: "N" }],
            restTimer: defaultTimers.rest, warmupTimer: defaultTimers.warmup, sideTimer: defaultTimers.side,
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
        defaultTimers={defaultTimers}
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
        onSave={(routineName, exs) => handleSaveRoutine(routineName, exs)}
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
        onOpenSettings={() => setSubScreen("settings")}
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
