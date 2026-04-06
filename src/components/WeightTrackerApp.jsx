"use client";
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import FoodSection from "./FoodSection";
import FitnessSection from "./FitnessSection";
import GymSection from "./GymSection";
import {
  getNutritionGoals, saveNutritionGoals, clearAllFoodData, populateDemoData,
  getSheetsUrl, saveSheetsUrl, pingSheets, fullSyncToSheets, restoreFromSheets,
  getLastSyncTime, getAutoSync, saveAutoSync, syncResetToSheets,
  getGoalHistory, saveGoalHistory,
} from "../lib/food-db";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart, ReferenceArea
} from "recharts";
import {
  Scale, Target, TrendingDown, TrendingUp, Calendar, Plus,
  ChevronLeft, Settings, Trash2, Award, Flame, ArrowDown,
  ArrowUp, Minus, Edit3, Check, X, Home, Utensils, Dumbbell,
  User, ChevronRight, Clock, Droplets, Zap, Activity,
  Sun, Moon, Sunrise, Star, Heart, BarChart3, AlertCircle,
  Sparkles, Trophy, CheckCircle2, Info, Copy, Footprints
} from "lucide-react";

/* ═══════════════════════════════════════════
   UTILITIES & ALGORITHMS
   ═══════════════════════════════════════════ */

const formatDate = (d) => new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
const formatDateFull = (d) => new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
const toISO = (d) => new Date(d).toISOString().split("T")[0];
const today = () => toISO(new Date());

// Google Apps Script code for sync (embedded for copy button)
const APPS_SCRIPT_CODE = `// Google Apps Script — Weight Tracker Sync
// Deploy: App Web → Esegui come: Me, Accesso: Chiunque

const SHEET_DIARIO = "Diario";
const SHEET_RIEPILOGO = "Riepilogo";
const SHEET_DATABASE = "Database Alimenti";
const HEADERS_DIARIO = ["data","pasto","cibo","brand","grammi","kcal","proteine","carbo","grassi","categoria","sgarro"];
const HEADERS_RIEPILOGO = ["data","kcal","proteine","carbo","grassi","obiettivo_kcal","obiettivo_P","obiettivo_C","obiettivo_G","delta_kcal"];
const HEADERS_DATABASE = ["nome","brand","barcode","kcalPer100","proteinePer100","carboPer100","grassiPer100","categoria","fonte"];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === "sync") return handleSync(data);
    if (data.action === "clear") return handleClear(data);
    return jsonRes({ success: false, error: "Azione non riconosciuta" });
  } catch (err) { return jsonRes({ success: false, error: err.message }); }
}

function doGet(e) {
  try {
    const a = e.parameter.action;
    if (a === "ping") return jsonRes({ success: true, message: "Connesso!" });
    if (a === "export") return handleExport(e.parameter.sheet);
    return jsonRes({ success: false, error: "Parametro action mancante" });
  } catch (err) { return jsonRes({ success: false, error: err.message }); }
}

function handleSync(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let counts = {};
  if (data.diario) {
    const sheet = getOrCreate(ss, SHEET_DIARIO, HEADERS_DIARIO);
    if (data.fullSync) {
      if (sheet.getLastRow()>1) sheet.getRange(2,1,sheet.getLastRow()-1,HEADERS_DIARIO.length).clearContent();
      const rows = data.diario.map(e => [e.date,e.mealType,e.foodName,e.brand||"",e.grams,e.kcal,rnd(e.protein),rnd(e.carbs),rnd(e.fat),e.category||"",e.isCheat?"SI":""]);
      if (rows.length>0) sheet.getRange(2,1,rows.length,HEADERS_DIARIO.length).setValues(rows);
    } else if (data.diario.length>0) {
      const rows = data.diario.map(e => [e.date,e.mealType,e.foodName,e.brand||"",e.grams,e.kcal,rnd(e.protein),rnd(e.carbs),rnd(e.fat),e.category||"",e.isCheat?"SI":""]);
      sheet.getRange(sheet.getLastRow()+1,1,rows.length,HEADERS_DIARIO.length).setValues(rows);
    }
    counts.diario = data.diario.length;
  }
  if (data.riepilogo) {
    const sheet = getOrCreate(ss, SHEET_RIEPILOGO, HEADERS_RIEPILOGO);
    if (sheet.getLastRow()>1) sheet.getRange(2,1,sheet.getLastRow()-1,HEADERS_RIEPILOGO.length).clearContent();
    const rows = data.riepilogo.map(r => [r.date,rnd(r.kcal),rnd(r.protein),rnd(r.carbs),rnd(r.fat),r.targetKcal,rnd(r.targetP),rnd(r.targetC),rnd(r.targetG),rnd(r.kcal-r.targetKcal)]);
    if (rows.length>0) sheet.getRange(2,1,rows.length,HEADERS_RIEPILOGO.length).setValues(rows);
    counts.riepilogo = data.riepilogo.length;
  }
  if (data.database && data.database.length > 0) {
    const sheet = getOrCreate(ss, SHEET_DATABASE, HEADERS_DATABASE);
    const existing = getExisting(sheet);
    const keys = new Set(existing.map(r => (r[0]+"||"+r[1]).toLowerCase()));
    const newRows = data.database.filter(f => !keys.has((f.name+"||"+(f.brand||"")).toLowerCase())).map(f => [f.name,f.brand||"",f.barcode||"",f.kcalPer100||0,rnd(f.proteinPer100||0),rnd(f.carbsPer100||0),rnd(f.fatPer100||0),f.category||"",f.source||""]);
    if (newRows.length > 0) sheet.getRange(sheet.getLastRow()+1,1,newRows.length,HEADERS_DATABASE.length).setValues(newRows);
    counts.database = newRows.length;
  }
  return jsonRes({ success: true, counts, timestamp: new Date().toISOString() });
}

function handleExport(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (sheetName) {
    const s = ss.getSheetByName(sheetName);
    if (!s) return jsonRes({ success: false, error: "Foglio non trovato: "+sheetName });
    return jsonRes({ success: true, sheet: sheetName, data: toJson(s) });
  }
  const result = {};
  [SHEET_DIARIO,SHEET_RIEPILOGO,SHEET_DATABASE].forEach(n => { const s = ss.getSheetByName(n); if (s) result[n] = toJson(s); });
  return jsonRes({ success: true, data: result });
}

function handleClear(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const s = ss.getSheetByName(data.sheet||SHEET_DIARIO);
  if (!s) return jsonRes({ success: false, error: "Foglio non trovato" });
  if (s.getLastRow() > 1) s.getRange(2,1,s.getLastRow()-1,s.getLastColumn()).clearContent();
  return jsonRes({ success: true, cleared: data.sheet||SHEET_DIARIO });
}

function getOrCreate(ss, name, headers) {
  let s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name); s.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight("bold"); s.setFrozenRows(1); }
  return s;
}
function getExisting(s) { const lr = s.getLastRow(); return lr <= 1 ? [] : s.getRange(2,1,lr-1,s.getLastColumn()).getValues(); }
function toJson(s) { const d = s.getDataRange().getValues(); if (d.length<=1) return []; const h = d[0]; return d.slice(1).map(r => { const o = {}; h.forEach((k,i) => { o[k]=r[i]; }); return o; }); }
function rnd(v) { return Math.round((v||0)*10)/10; }
function jsonRes(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }`;

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

const bmiColor = (bmi) => {
  if (!bmi) return "#6B7B7B";
  if (bmi < 18.5) return "#3B82F6";
  if (bmi < 25) return "#02C39A";
  if (bmi < 30) return "#F0B429";
  return "#E85D4E";
};

// Time-based greeting
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 6) return { text: "Buonanotte", icon: Moon };
  if (h < 12) return { text: "Buongiorno", icon: Sunrise };
  if (h < 18) return { text: "Buon pomeriggio", icon: Sun };
  return { text: "Buonasera", icon: Moon };
};

const getDayName = (dateStr) => {
  return new Date(dateStr).toLocaleDateString("it-IT", { weekday: "short" });
};

// Get trend EMA value at a specific date with linear interpolation if missing
const getTrendAtDate = (smoothedEntries, dateStr) => {
  if (!smoothedEntries || smoothedEntries.length === 0) return null;
  const exact = smoothedEntries.find(e => e.date === dateStr);
  if (exact) return exact.trend;

  const target = new Date(dateStr).getTime();
  const sorted = [...smoothedEntries].sort((a, b) => a.date.localeCompare(b.date));

  let before = null, after = null;
  for (const e of sorted) {
    const t = new Date(e.date).getTime();
    if (t < target) before = e;
    if (t > target && !after) after = e;
  }

  if (!before || !after) return null;
  const bTime = new Date(before.date).getTime();
  const aTime = new Date(after.date).getTime();
  const ratio = (target - bTime) / (aTime - bTime);
  return Math.round((before.trend + ratio * (after.trend - before.trend)) * 100) / 100;
};

// Get ISO dates of last N Mondays (index 0 = most recent Monday)
const getMondays = (n = 4) => {
  const mondays = [];
  const d = new Date();
  const dayOfWeek = d.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  for (let i = 0; i < n; i++) {
    const monday = new Date(d);
    monday.setDate(d.getDate() - daysToMonday - i * 7);
    mondays.push(toISO(monday));
  }
  return mondays;
};

// Get ISO dates of 1st of last N months (index 0 = this month)
const getFirstOfMonths = (n = 4) => {
  const firsts = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const first = new Date(d.getFullYear(), d.getMonth() - i, 1);
    firsts.push(toISO(first));
  }
  return firsts;
};

/* ═══════════════════════════════════════════
   DEMO DATA
   ═══════════════════════════════════════════ */

const generateSampleData = () => {
  const data = [];
  const startWeight = 85.5;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 45);
  for (let i = 0; i <= 45; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    if (Math.random() > 0.2) {
      const trend = startWeight - (i * 0.07);
      const noise = (Math.random() - 0.5) * 1.2;
      data.push({
        id: Date.now() + i,
        date: toISO(d),
        weight: Math.round((trend + noise) * 10) / 10,
        note: i % 10 === 0 ? "Giornata buona" : "",
      });
    }
  }
  return data;
};

/* ═══════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════ */

const T = {
  bg: "#F5F7FA",
  card: "#FFFFFF",
  teal: "#028090",
  tealLight: "#E0F2F1",
  mint: "#02C39A",
  coral: "#E85D4E",
  gold: "#F0B429",
  purple: "#7C5CFC",
  text: "#1A2030",
  textSec: "#6B7280",
  textMuted: "#9CA3AF",
  border: "#F0F0F0",
  gradient: "linear-gradient(135deg, #028090, #02C39A)",
  gradientWarm: "linear-gradient(135deg, #F0B429, #E85D4E)",
  shadow: "0 2px 16px rgba(0,0,0,0.06)",
  shadowLg: "0 8px 32px rgba(0,0,0,0.08)",
};

/* ═══════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════ */

const Header = ({ title, subtitle, showBack, onBack, right }) => (
  <div style={{
    padding: "16px 20px 8px", background: T.bg,
    position: "sticky", top: 0, zIndex: 10,
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {showBack && (
          <button onClick={onBack} style={{
            background: T.card, border: "none", cursor: "pointer", padding: 8,
            borderRadius: 10, display: "flex", alignItems: "center",
            boxShadow: T.shadow,
          }}>
            <ChevronLeft size={20} color={T.teal} />
          </button>
        )}
        <div>
          {subtitle && <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>{subtitle}</div>}
          <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0, letterSpacing: -0.5 }}>{title}</h1>
        </div>
      </div>
      {right}
    </div>
  </div>
);

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{
      background: T.card, borderRadius: 12, padding: "10px 14px",
      boxShadow: T.shadowLg, border: `1px solid ${T.tealLight}`,
    }}>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>{formatDateFull(d.date)}</div>
      {d.weight != null && <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Peso: {d.weight} kg</div>}
      {d.trend != null && <div style={{ fontSize: 12, color: T.teal, fontWeight: 600 }}>Trend: {d.trend} kg</div>}
    </div>
  );
};

const ComingSoonScreen = ({ icon: Icon, title, description, features, color }) => (
  <div style={{ padding: "40px 20px", textAlign: "center" }}>
    <div style={{
      width: 80, height: 80, borderRadius: 24, background: `${color}12`,
      display: "flex", alignItems: "center", justifyContent: "center",
      margin: "0 auto 20px",
    }}>
      <Icon size={36} color={color} />
    </div>
    <h2 style={{ fontSize: 24, fontWeight: 800, color: T.text, marginBottom: 8 }}>{title}</h2>
    <p style={{ fontSize: 14, color: T.textSec, marginBottom: 32, lineHeight: 1.6, maxWidth: 300, margin: "0 auto 32px" }}>
      {description}
    </p>
    <div style={{ textAlign: "left", maxWidth: 320, margin: "0 auto" }}>
      {features.map((f, i) => (
        <div key={i} style={{
          background: T.card, borderRadius: 14, padding: "14px 16px", marginBottom: 10,
          boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: `${color}12`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <f.icon size={16} color={color} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{f.title}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>{f.desc}</div>
          </div>
        </div>
      ))}
    </div>
    <div style={{
      marginTop: 32, padding: "14px 24px", borderRadius: 14,
      background: `${color}10`, display: "inline-block",
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>In arrivo nella prossima versione</span>
    </div>
  </div>
);

// Info popup (centered modal)
const InfoPopup = ({ show, onClose, title, children }) => {
  if (!show) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.card, borderRadius: 20, padding: 24, width: "100%", maxWidth: 340,
          boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{title}</span>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 20, color: T.textMuted, lineHeight: 1, padding: 2,
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};

// Toggle switch component
const Toggle = ({ on, onToggle, label }) => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "9px 0", borderBottom: `1px solid ${T.border}`,
  }}>
    <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{label}</span>
    <button
      onClick={onToggle}
      style={{
        width: 40, height: 22, borderRadius: 11, border: "none",
        background: on ? T.teal : "#D1D5DB",
        position: "relative", cursor: "pointer",
        flexShrink: 0, transition: "background 0.2s",
      }}
    >
      <div style={{
        position: "absolute", top: 2,
        left: on ? 20 : 2,
        width: 18, height: 18, borderRadius: 9, background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        transition: "left 0.2s",
      }} />
    </button>
  </div>
);

/* ═══════════════════════════════════════════
   BOTTOM NAVIGATION
   ═══════════════════════════════════════════ */

const BottomNav = ({ active, onNavigate, onAdd }) => {
  const tabs = [
    { id: "dashboard", icon: Home, label: "Home" },
    { id: "food", icon: Utensils, label: "Cibo" },
    { id: "add", icon: Plus, label: "" },
    { id: "fitness", icon: Footprints, label: "Fitness" },
    { id: "gym", icon: Dumbbell, label: "Gym" },
  ];

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: T.card, borderTop: `1px solid ${T.border}`,
      display: "flex", justifyContent: "space-around", alignItems: "flex-end",
      padding: "6px 8px 22px", zIndex: 20,
      boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
    }}>
      {tabs.map(tab => {
        if (tab.id === "add") {
          return (
            <button key="add" onClick={onAdd} style={{
              width: 54, height: 54, borderRadius: "50%", border: "none",
              background: T.gradient, color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 24px rgba(2,128,144,0.35)",
              transform: "translateY(-14px)", transition: "transform 0.2s",
            }}>
              <Plus size={26} strokeWidth={2.5} />
            </button>
          );
        }
        const isActive = active === tab.id;
        return (
          <button key={tab.id} onClick={() => onNavigate(tab.id)} style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            padding: "6px 14px", opacity: isActive ? 1 : 0.5,
            transition: "opacity 0.2s",
          }}>
            <tab.icon size={21} color={isActive ? T.teal : T.textSec} strokeWidth={isActive ? 2.3 : 1.8} />
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.2,
              color: isActive ? T.teal : T.textSec,
            }}>{tab.label}</span>
            {isActive && <div style={{
              width: 4, height: 4, borderRadius: 2, background: T.teal, marginTop: -1,
            }} />}
          </button>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════
   CIRCULAR PROGRESS COMPONENT
   ═══════════════════════════════════════════ */

const CircularProgress = ({ percentage, size = 64, strokeWidth = 5, color = T.teal }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(percentage, 0), 100) / 100) * circumference;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={`${color}20`} strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease-in-out" }} />
    </svg>
  );
};

/* ═══════════════════════════════════════════
   NUTRITION GOALS PANEL (two cards)
   ═══════════════════════════════════════════ */

const roundTo50 = (n) => Math.floor(n / 50) * 50;
const computeBMR = ({ sex, weight, height, age }) => {
  const w = Number(weight) || 0, h = Number(height) || 0, a = Number(age) || 0;
  return sex === "F" ? (10 * w + 6.25 * h - 5 * a - 161) : (10 * w + 6.25 * h - 5 * a + 5);
};
const ACT_MULT = { sedentario: 1.2, leggero: 1.375, moderato: 1.55 };
const GOAL_ADJ = { cut: -500, maintain: 0, bulk: 300 };

const Stepper = ({ value, onChange, step = 1, min = 0, max = 9999, decimals = 0, suffix = "", width = 78 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <button onClick={() => onChange(Math.max(min, +(value - step).toFixed(decimals)))} style={{
      width: 28, height: 28, borderRadius: 8, border: "1.5px solid #E5E7EB", background: "#fff",
      fontSize: 16, fontWeight: 700, color: "#555", cursor: "pointer", fontFamily: "inherit",
    }}>−</button>
    <div style={{
      minWidth: width, textAlign: "center", padding: "6px 8px", borderRadius: 8,
      background: "#F9FAFB", border: "1.5px solid #E5E7EB", fontSize: 14, fontWeight: 700, color: "#1A1A1A",
    }}>{decimals > 0 ? value.toFixed(decimals) : value}{suffix}</div>
    <button onClick={() => onChange(Math.min(max, +(value + step).toFixed(decimals)))} style={{
      width: 28, height: 28, borderRadius: 8, border: "1.5px solid #E5E7EB", background: "#fff",
      fontSize: 16, fontWeight: 700, color: "#555", cursor: "pointer", fontFamily: "inherit",
    }}>+</button>
  </div>
);

const Segmented = ({ options, value, onChange }) => (
  <div style={{ display: "flex", gap: 6, background: "#F3F4F6", padding: 4, borderRadius: 10 }}>
    {options.map((o) => (
      <button key={o.value} onClick={() => onChange(o.value)} style={{
        flex: 1, padding: "8px 6px", borderRadius: 8, border: "none",
        background: value === o.value ? "#fff" : "transparent",
        boxShadow: value === o.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
        fontSize: 12, fontWeight: 700, color: value === o.value ? "#1A1A1A" : "#6B7280",
        cursor: "pointer", fontFamily: "inherit",
      }}>{o.label}</button>
    ))}
  </div>
);

const NutritionGoalsPanel = ({ nutritionGoals, onSave, goalEffectiveDate, setGoalEffectiveDate }) => {
  // Profile (stored inside nutritionGoals for persistence)
  const [age, setAge] = useState(nutritionGoals.age || 30);
  const [sex, setSex] = useState(nutritionGoals.sex || "M");
  const [height, setHeight] = useState(nutritionGoals.height || 175);
  const [weight, setWeight] = useState(nutritionGoals.weight || 80);
  const [activity, setActivity] = useState(nutritionGoals.activityLevel || "leggero");
  const [goal, setGoal] = useState(nutritionGoals.goal || "maintain");
  const [adj, setAdj] = useState(nutritionGoals.adj != null ? nutritionGoals.adj : (GOAL_ADJ[nutritionGoals.goal || "maintain"] || 0));
  const [showActHelp, setShowActHelp] = useState(false);

  const bmr = Math.round(computeBMR({ sex, weight, height, age }));
  const tdee = Math.round(bmr * (ACT_MULT[activity] || 1.2));
  const targetRaw = tdee + adj;
  const target = roundTo50(targetRaw);

  // Card 2 — macros
  const [kcalEdit, setKcalEdit] = useState(nutritionGoals.kcalTarget || target);
  const [pPerKg, setPPerKg] = useState(nutritionGoals.pPerKg || 2.0);
  const [fPerKg, setFPerKg] = useState(nutritionGoals.fPerKg || 1.0);

  // Sync card 2 kcal when card 1 target changes significantly
  useEffect(() => { setKcalEdit(target); }, [target]);

  const pGrams = Math.round(pPerKg * weight);
  const fGrams = Math.round(fPerKg * weight);
  const pKcal = pGrams * 4;
  const fKcal = fGrams * 9;
  const cKcal = Math.max(0, kcalEdit - pKcal - fKcal);
  const cGrams = Math.round(cKcal / 4);
  const totalKcal = pKcal + cKcal + fKcal;
  const pPct = totalKcal > 0 ? Math.round((pKcal / totalKcal) * 100) : 0;
  const cPct = totalKcal > 0 ? Math.round((cKcal / totalKcal) * 100) : 0;
  const fPct = totalKcal > 0 ? 100 - pPct - cPct : 0;

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleSave = () => {
    const goals = {
      // legacy fields
      kcalTarget: kcalEdit,
      proteinPct: pPct, carbsPct: cPct, fatPct: fPct,
      // new fields
      pGrams, cGrams, fGrams,
      // profile
      age, sex, height, weight, activityLevel: activity, goal, adj, pPerKg, fPerKg,
    };
    onSave(goals, goalEffectiveDate);
    setShowSaveModal(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2200);
  };

  const handleGoalChange = (v) => { setGoal(v); setAdj(GOAL_ADJ[v]); };

  const labelStyle = { fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 6 };
  const cardStyle = { background: T.card, borderRadius: 14, padding: 16, boxShadow: T.shadow, marginBottom: 12 };
  const rowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 };

  return (
    <>
      {/* ─── Card 1: Fabbisogno calorico ─── */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 14 }}>Fabbisogno calorico</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          {[
            { label: "Età", val: age, set: setAge, im: "numeric", suf: "" },
            { label: "Altezza", val: height, set: setHeight, im: "numeric", suf: " cm" },
            { label: "Peso", val: weight, set: setWeight, im: "decimal", suf: " kg" },
          ].map((f) => (
            <div key={f.label}>
              <div style={labelStyle}>{f.label}</div>
              <input type="text" inputMode={f.im} value={f.val}
                onChange={(e) => {
                  const v = e.target.value.replace(",", ".");
                  if (v === "" || /^\d*\.?\d*$/.test(v)) f.set(v === "" ? 0 : (f.im === "decimal" ? parseFloat(v) || 0 : parseInt(v) || 0));
                }}
                style={{
                  width: "100%", padding: "10px 10px", borderRadius: 10, border: "1.5px solid #E5E7EB",
                  fontSize: 15, fontWeight: 700, color: T.text, fontFamily: "inherit", background: "#F9FAFB", outline: "none",
                  textAlign: "center",
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={labelStyle}>Sesso</div>
          <Segmented options={[{ label: "Maschio", value: "M" }, { label: "Femmina", value: "F" }]} value={sex} onChange={setSex} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
            <span>Livello di attività</span>
            <button onClick={() => setShowActHelp(!showActHelp)} style={{
              width: 16, height: 16, borderRadius: "50%", border: "1.5px solid #6B7280",
              background: "transparent", color: "#6B7280", fontSize: 10, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", padding: 0, lineHeight: 1,
            }}>?</button>
          </div>
          <Segmented options={[
            { label: "Sedentario", value: "sedentario" },
            { label: "Leggero", value: "leggero" },
            { label: "Moderato", value: "moderato" },
          ]} value={activity} onChange={setActivity} />
          {showActHelp && (
            <div style={{ marginTop: 8, padding: 10, background: "#F3F4F6", borderRadius: 10, fontSize: 11, color: "#4B5563", lineHeight: 1.5 }}>
              <div style={{ marginBottom: 4 }}><b>Sedentario:</b> lavoro da ufficio/casa, poco o nessun esercizio, spostamenti in auto.</div>
              <div style={{ marginBottom: 4 }}><b>Leggero:</b> esercizio 1–3 volte/sett (camminate, palestra leggera) oppure lavoro attivo (cameriere, commesso).</div>
              <div><b>Moderato:</b> esercizio 3–5 volte/sett intenso, o lavoro fisico (operaio, corriere), oppure entrambi.</div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={labelStyle}>Obiettivo</div>
          <Segmented options={[
            { label: "Taglio", value: "cut" },
            { label: "Mantieni", value: "maintain" },
            { label: "Massa", value: "bulk" },
          ]} value={goal} onChange={handleGoalChange} />
        </div>

        <div style={{ ...rowStyle, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>Aggiustamento kcal</div>
          <Stepper value={adj} onChange={setAdj} step={50} min={-1500} max={1500} suffix=" kcal" width={70} />
        </div>

        <div style={{
          background: T.gradient, borderRadius: 12, padding: 14, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 10, opacity: 0.85, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Obiettivo calorico</div>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1 }}>{target}<span style={{ fontSize: 14, opacity: 0.85, marginLeft: 4 }}>kcal</span></div>
          </div>
          <div style={{ textAlign: "right", fontSize: 10, opacity: 0.85 }}>
            <div>BMR {bmr}</div>
            <div>TDEE {tdee}</div>
          </div>
        </div>
      </div>

      {/* ─── Card 2: Macronutrienti ─── */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 14 }}>Macronutrienti</div>

        <div style={rowStyle}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>Target calorico</div>
          <Stepper value={kcalEdit} onChange={setKcalEdit} step={50} min={500} max={6000} suffix=" kcal" width={84} />
        </div>

        <div style={rowStyle}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>Proteine / kg</div>
          <Stepper value={pPerKg} onChange={setPPerKg} step={0.1} min={0.5} max={4} decimals={1} suffix=" g/kg" width={84} />
        </div>

        <div style={{ ...rowStyle, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>Grassi / kg</div>
          <Stepper value={fPerKg} onChange={setFPerKg} step={0.1} min={0.3} max={2.5} decimals={1} suffix=" g/kg" width={84} />
        </div>

        {/* Macro rows */}
        {[
          { label: "Proteine", g: pGrams, kcal: pKcal, pct: pPct, color: "#3B82F6" },
          { label: "Carboidrati", g: cGrams, kcal: cKcal, pct: cPct, color: "#F0B429" },
          { label: "Grassi", g: fGrams, kcal: fKcal, pct: fPct, color: "#E85D4E" },
        ].map((m) => (
          <div key={m.label} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.label}</div>
              <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>
                <span style={{ color: T.text, fontWeight: 800, fontSize: 13 }}>{m.g}g</span> · {m.kcal} kcal · {m.pct}%
              </div>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: `${m.color}20`, overflow: "hidden" }}>
              <div style={{ width: `${m.pct}%`, height: "100%", background: m.color, borderRadius: 3 }} />
            </div>
          </div>
        ))}

        <button onClick={() => setShowSaveModal(true)} style={{
          marginTop: 14, width: "100%", padding: 14, borderRadius: 12, border: "none",
          background: T.gradient, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>Salva obiettivi</button>
      </div>

      {/* Save modal */}
      {showSaveModal && (
        <div onClick={() => setShowSaveModal(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 340,
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 6 }}>Salva obiettivi</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 14 }}>Da quale data vuoi applicare questi obiettivi?</div>
            <input type="date" value={goalEffectiveDate}
              onChange={(e) => setGoalEffectiveDate(e.target.value)}
              style={{
                width: "100%", padding: "12px", borderRadius: 10, border: "1.5px solid #E5E7EB",
                fontSize: 14, fontWeight: 600, color: T.text, fontFamily: "inherit", background: "#F9FAFB", outline: "none",
                marginBottom: 14,
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowSaveModal(false)} style={{
                flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E5E7EB", background: "#fff",
                fontSize: 13, fontWeight: 700, color: "#6B7280", cursor: "pointer", fontFamily: "inherit",
              }}>Annulla</button>
              <button onClick={handleSave} style={{
                flex: 1, padding: 12, borderRadius: 10, border: "none", background: T.gradient,
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}>Conferma</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {showToast && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: "#1A1A1A", color: "#fff", padding: "12px 18px", borderRadius: 12,
          fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.2)", zIndex: 110,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <CheckCircle2 size={16} color="#10B981" />
          Obiettivi salvati — attivi dal {new Date(goalEffectiveDate).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      )}
    </>
  );
};

/* ═══════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════ */

export default function WeightTrackerApp() {
  const [entries, setEntries] = useState(generateSampleData);
  const [screen, setScreen] = useState("dashboard");
  const foodSectionRef = useRef(null);
  const [settings, setSettings] = useState({
    height: 175, goalWeight: 78, startWeight: 85.5, name: "Davide",
  });
  const [nutritionGoals, setNutritionGoals] = useState({
    kcalTarget: 2000, proteinPct: 30, carbsPct: 40, fatPct: 30,
  });
  const [goalHistory, setGoalHistory] = useState([]);
  const [goalEffectiveDate, setGoalEffectiveDate] = useState(today());
  const [pendingGoals, setPendingGoals] = useState(null); // staged changes before save
  const [newWeight, setNewWeight] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newDate, setNewDate] = useState(today());
  const [chartRange, setChartRange] = useState("1M");
  const [editingEntry, setEditingEntry] = useState(null);
  const [editWeight, setEditWeight] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState(null);
  const [showResetSheet, setShowResetSheet] = useState(false);
  const [resetDeleteDb, setResetDeleteDb] = useState(false);
  const [resetInput, setResetInput] = useState("");
  const [resetting, setResetting] = useState(false);

  // Sync state
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [sheetsUrlInput, setSheetsUrlInput] = useState("");
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | success | error
  const [syncMessage, setSyncMessage] = useState("");
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [autoSyncToast, setAutoSyncToast] = useState(false);
  const [sheetsConnected, setSheetsConnected] = useState(false);
  const [showSyncGuide, setShowSyncGuide] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const autoSyncTimerRef = useRef(null);

  // Dashboard UI state
  const [compTab, setCompTab] = useState("week");
  const [showTrendInfo, setShowTrendInfo] = useState(false);
  const [showPredInfo, setShowPredInfo] = useState(false);
  const [showChartSettings, setShowChartSettings] = useState(false);
  const [chartSettings, setChartSettings] = useState({
    showObjective: true,
    showBMIZones: false,
    showScale: true,
    showTrend: true,
  });

  // Load nutrition goals + goal history from Dexie on mount
  useEffect(() => {
    getNutritionGoals().then((goals) => {
      if (goals) setNutritionGoals(goals);
    });
    getGoalHistory().then((h) => {
      if (h && h.length > 0) setGoalHistory(h);
    });
  }, []);

  // Load sync settings on mount
  useEffect(() => {
    const loadSync = async () => {
      const url = await getSheetsUrl();
      if (url) {
        setSheetsUrl(url);
        setSheetsUrlInput(url);
        const ok = await pingSheets(url);
        setSheetsConnected(ok);
      }
      const ts = await getLastSyncTime();
      if (ts) setLastSyncTime(ts);
      const as = await getAutoSync();
      setAutoSync(as);
    };
    loadSync();
  }, []);


  const handleSaveNutritionGoals = useCallback((goals, effectiveFrom) => {
    setNutritionGoals(goals);
    saveNutritionGoals(goals);
    // Update goal history
    if (effectiveFrom) {
      setGoalHistory((prev) => {
        const entry = { effectiveFrom, ...goals };
        // Remove any existing entry for the same date
        const filtered = prev.filter((g) => g.effectiveFrom !== effectiveFrom);
        const updated = [entry, ...filtered].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
        saveGoalHistory(updated);
        return updated;
      });
    }
  }, []);

  const handleSaveSheetsUrl = useCallback(async (url) => {
    const trimmed = url.trim();
    await saveSheetsUrl(trimmed);
    setSheetsUrl(trimmed);
    if (trimmed) {
      const ok = await pingSheets(trimmed);
      setSheetsConnected(ok);
      setSyncMessage(ok ? "Connesso a Google Sheets!" : "URL non valido o script non deployato");
    } else {
      setSheetsConnected(false);
    }
  }, []);

  const handleFullSync = useCallback(async () => {
    if (!sheetsUrl) return;
    setSyncStatus("syncing");
    setSyncMessage("Sincronizzazione in corso...");
    try {
      const result = await fullSyncToSheets(sheetsUrl, nutritionGoals);
      if (result.success) {
        setSyncStatus("success");
        const c = result.counts || {};
        setSyncMessage(`Sincronizzato! Diario: ${c.diario || 0} voci, Riepilogo: ${c.riepilogo || 0} giorni, DB: ${c.database || 0} nuovi alimenti`);
        setLastSyncTime(Date.now());
      } else {
        setSyncStatus("error");
        setSyncMessage("Errore: " + (result.error || "sconosciuto"));
      }
    } catch (err) {
      setSyncStatus("error");
      setSyncMessage("Errore di rete: " + err.message);
    }
    setTimeout(() => setSyncStatus("idle"), 5000);
  }, [sheetsUrl, nutritionGoals]);

  const handleRestore = useCallback(async () => {
    if (!sheetsUrl) return;
    setSyncStatus("syncing");
    setSyncMessage("Ripristino dati da Sheets...");
    try {
      const counts = await restoreFromSheets(sheetsUrl);
      setSyncStatus("success");
      setSyncMessage(`Ripristinato! ${counts.diario} voci diario, ${counts.database} alimenti nel DB`);
      setLastSyncTime(Date.now());
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      setSyncStatus("error");
      setSyncMessage("Errore: " + err.message);
    }
  }, [sheetsUrl]);

  // Auto-sync: debounced trigger (10s after last change)
  const triggerAutoSync = useCallback(() => {
    if (!autoSync || !sheetsUrl || !sheetsConnected) return;
    if (autoSyncTimerRef.current) clearTimeout(autoSyncTimerRef.current);
    autoSyncTimerRef.current = setTimeout(async () => {
      try {
        const result = await fullSyncToSheets(sheetsUrl, nutritionGoals);
        if (result.success) {
          setLastSyncTime(Date.now());
          setAutoSyncToast(true);
          setTimeout(() => setAutoSyncToast(false), 2500);
        }
      } catch { /* silent fail for auto-sync */ }
    }, 10000);
  }, [autoSync, sheetsUrl, sheetsConnected, nutritionGoals]);

  const handleToggleAutoSync = useCallback(async (enabled) => {
    setAutoSync(enabled);
    await saveAutoSync(enabled);
  }, []);

  // Derived data
  const sorted = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)), [entries]);
  const smoothed = useMemo(() => calcEMA(sorted), [sorted]);

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

  const metrics = useMemo(() => {
    if (sorted.length === 0) return {};
    const latest = sorted[sorted.length - 1];
    const latestSmoothed = smoothed[smoothed.length - 1];
    const bmi = calcBMI(latest.weight, settings.height);

    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      const check = toISO(d);
      if (sorted.some(e => e.date === check)) { streak++; d.setDate(d.getDate() - 1); }
      else if (i === 0) { d.setDate(d.getDate() - 1); }
      else break;
    }

    const recent = smoothed.slice(-14);
    const reg = linearRegression(recent);
    let predictedDate = null;
    let daysToGoal = null;
    if (reg && reg.slope < 0 && settings.goalWeight) {
      const currentTrendEnd = reg.intercept + reg.slope * (recent.length - 1);
      daysToGoal = (settings.goalWeight - currentTrendEnd) / reg.slope;
      if (daysToGoal > 0 && daysToGoal < 730) {
        const pd = new Date(); pd.setDate(pd.getDate() + Math.round(daysToGoal));
        predictedDate = formatDateFull(pd);
      }
    }
    const weeklyRate = reg ? Math.round(reg.slope * 7 * 100) / 100 : null;
    const weeksToGoal = daysToGoal ? Math.round(daysToGoal / 7) : null;

    const todayEntry = sorted.find(e => e.date === today());
    const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayEntry = sorted.find(e => e.date === toISO(yesterdayDate));
    const vsYesterday = (todayEntry != null && yesterdayEntry != null)
      ? Math.round((todayEntry.weight - yesterdayEntry.weight) * 100) / 100
      : null;

    const totalChange = Math.round((latest.weight - sorted[0].weight) * 100) / 100;

    return {
      current: latest.weight,
      trend: latestSmoothed != null ? latestSmoothed.trend : null,
      bmi,
      streak,
      predictedDate,
      weeklyRate,
      weeksToGoal,
      totalChange,
      totalEntries: sorted.length,
      todayLogged: todayEntry != null,
      vsYesterday,
    };
  }, [sorted, smoothed, settings]);

  const weightDomain = useMemo(() => {
    if (chartData.length === 0) return [60, 90];
    const weights = chartData.flatMap(d => [d.weight, d.trend].filter(v => v != null));
    return [Math.floor(Math.min(...weights) - 1), Math.ceil(Math.max(...weights) + 1)];
  }, [chartData]);

  // BMI zones for chart (weight boundaries based on user height)
  const bmiZones = useMemo(() => {
    if (!settings.height) return [];
    const h = settings.height / 100;
    const h2 = h * h;
    return [
      { name: "Sottopeso", y1: 0, y2: Math.round(18.5 * h2 * 10) / 10, color: "#3B82F6" },
      { name: "Normopeso", y1: Math.round(18.5 * h2 * 10) / 10, y2: Math.round(25 * h2 * 10) / 10, color: "#02C39A" },
      { name: "Sovrappeso", y1: Math.round(25 * h2 * 10) / 10, y2: Math.round(30 * h2 * 10) / 10, color: "#F0B429" },
      { name: "Obesità", y1: Math.round(30 * h2 * 10) / 10, y2: 300, color: "#E85D4E" },
    ];
  }, [settings.height]);

  // Comparisons: trend at Monday (weekly) and 1st of month (monthly)
  const comparisons = useMemo(() => {
    const mondays = getMondays(4);
    const firsts = getFirstOfMonths(4);

    const weeklyData = mondays.map((date, i) => {
      const trend = getTrendAtDate(smoothed, date);
      const prevTrend = i < mondays.length - 1 ? getTrendAtDate(smoothed, mondays[i + 1]) : null;
      const diff = (trend != null && prevTrend != null)
        ? Math.round((trend - prevTrend) * 100) / 100
        : null;
      let label;
      if (i === 0) label = "Questa sett.";
      else if (i === 1) label = "Sett. scorsa";
      else label = `${i} sett. fa`;
      const dateLabel = new Date(date).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
      return { date, dateLabel, trend, diff, label, isCurrent: i === 0 };
    });

    const monthlyData = firsts.map((date, i) => {
      const trend = getTrendAtDate(smoothed, date);
      const prevTrend = i < firsts.length - 1 ? getTrendAtDate(smoothed, firsts[i + 1]) : null;
      const diff = (trend != null && prevTrend != null)
        ? Math.round((trend - prevTrend) * 100) / 100
        : null;
      const d = new Date(date);
      const monthName = d.toLocaleDateString("it-IT", { month: "long" });
      const label = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      const dateLabel = "1 " + d.toLocaleDateString("it-IT", { month: "short" });
      return { date, dateLabel, trend, diff, label, isCurrent: i === 0 };
    });

    return { weeklyData, monthlyData };
  }, [smoothed]);

  // Recent entries with ritmo (weekly trend slope) and diff vs previous
  const recentWithRitmo = useMemo(() => {
    const recent = [...sorted].reverse().slice(0, 5);
    return recent.map((entry, idx) => {
      const smoothedIdx = smoothed.findIndex(e => e.date === entry.date);
      let ritmo = null;
      if (smoothedIdx > 0) {
        const curr = smoothed[smoothedIdx];
        const prev = smoothed[smoothedIdx - 1];
        if (curr != null && prev != null) {
          const daysBetween = Math.max(1, (new Date(curr.date) - new Date(prev.date)) / 86400000);
          ritmo = Math.round((curr.trend - prev.trend) / daysBetween * 7 * 100) / 100;
        }
      }
      const next = idx < recent.length - 1 ? recent[idx + 1] : null;
      const diff = next != null ? Math.round((entry.weight - next.weight) * 100) / 100 : null;
      return { ...entry, ritmo, diff };
    });
  }, [sorted, smoothed]);

  // Handlers
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
    setNewWeight(""); setNewNote(""); setNewDate(today());
    setScreen("dashboard");
  }, [entries, newWeight, newNote, newDate]);

  const deleteEntry = useCallback((id) => { setEntries(prev => prev.filter(e => e.id !== id)); setShowConfirmDelete(null); }, []);

  const goTo = useCallback((s) => {
    setScreen(s);
    setShowConfirmDelete(null);
    setEditingEntry(null);
    // Close all FoodSection sheets when navigating
    if (foodSectionRef.current && foodSectionRef.current.closeAllSheets) {
      foodSectionRef.current.closeAllSheets();
    }
    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const activeTab = ["dashboard", "food", "fitness", "gym"].includes(screen) ? screen : "dashboard";

  /* ═══════════════════════════════════════
     SCREEN: ADD WEIGHT
     ═══════════════════════════════════════ */
  if (screen === "add") {
    const w = parseFloat(newWeight.replace(",", "."));
    const valid = !isNaN(w) && w >= 20 && w <= 300;
    const currentWeight = metrics.current;
    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <Header title="Nuovo Peso" showBack onBack={() => goTo("dashboard")} />
        <div style={{ padding: "20px 20px 100px" }}>
          <div style={{
            background: T.card, borderRadius: 24, padding: "36px 24px", textAlign: "center",
            boxShadow: T.shadowLg, marginBottom: 16,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: `${T.teal}12`,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <Scale size={26} color={T.teal} />
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 20, fontWeight: 600 }}>Quanto pesi oggi?</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <input
                type="number" inputMode="decimal" step="0.1" value={newWeight}
                onChange={e => setNewWeight(e.target.value)} placeholder="0.0" autoFocus
                style={{
                  fontSize: 60, fontWeight: 800, color: T.text, border: "none", outline: "none",
                  width: 180, textAlign: "center", background: "transparent",
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              />
              <span style={{ fontSize: 22, color: T.textMuted, fontWeight: 600 }}>kg</span>
            </div>
            {currentWeight != null && valid && (
              <div style={{
                fontSize: 14, fontWeight: 700, marginTop: 12, padding: "6px 16px",
                borderRadius: 20, display: "inline-block",
                background: w < currentWeight ? "#02C39A15" : w > currentWeight ? "#E85D4E15" : "#F0F0F0",
                color: w < currentWeight ? T.mint : w > currentWeight ? T.coral : T.textSec,
              }}>
                {w < currentWeight
                  ? <ArrowDown size={14} style={{ verticalAlign: -2 }} />
                  : w > currentWeight
                    ? <ArrowUp size={14} style={{ verticalAlign: -2 }} />
                    : <Minus size={14} style={{ verticalAlign: -2 }} />}
                {" "}{Math.abs(Math.round((w - currentWeight) * 100) / 100)} kg
              </div>
            )}
          </div>

          <div style={{
            background: T.card, borderRadius: 16, padding: "14px 18px",
            boxShadow: T.shadow, marginBottom: 10,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <Calendar size={18} color={T.teal} />
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              style={{
                flex: 1, border: "none", outline: "none", fontSize: 15, color: T.text,
                fontFamily: "'Inter', sans-serif", background: "transparent",
              }}
            />
          </div>

          <div style={{
            background: T.card, borderRadius: 16, padding: "14px 18px",
            boxShadow: T.shadow, marginBottom: 28,
          }}>
            <input type="text" value={newNote} onChange={e => setNewNote(e.target.value)}
              placeholder="Aggiungi una nota (opzionale)"
              style={{
                width: "100%", border: "none", outline: "none", fontSize: 15, color: T.text,
                fontFamily: "'Inter', sans-serif", background: "transparent",
              }}
            />
          </div>

          <button onClick={addEntry} disabled={!valid} style={{
            width: "100%", padding: "17px", borderRadius: 16, border: "none",
            background: valid ? T.gradient : "#D1D5DB",
            color: "#fff", fontSize: 17, fontWeight: 800, cursor: valid ? "pointer" : "default",
            boxShadow: valid ? "0 4px 24px rgba(2,128,144,0.3)" : "none",
            letterSpacing: 0.3, transition: "all 0.2s",
          }}>
            Salva Peso
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     SCREEN: HISTORY
     ═══════════════════════════════════════ */
  if (screen === "history") {
    const reversed = [...sorted].reverse();
    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <Header title="Cronologia" subtitle="Peso" showBack onBack={() => goTo("dashboard")} />
        <div style={{ padding: "8px 20px 100px" }}>
          <div style={{
            fontSize: 12, color: T.textMuted, marginBottom: 14, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Clock size={13} /> {sorted.length} registrazioni
          </div>
          {reversed.map((entry, idx) => {
            const prev = idx < reversed.length - 1 ? reversed[idx + 1] : null;
            const diff = prev != null ? Math.round((entry.weight - prev.weight) * 100) / 100 : null;
            return (
              <div key={entry.id} style={{
                background: T.card, borderRadius: 14, padding: "14px 16px", marginBottom: 8,
                boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginBottom: 3 }}>
                    {formatDateFull(entry.date)}
                  </div>
                  {editingEntry === entry.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input type="number" inputMode="decimal" step="0.1" value={editWeight}
                        onChange={e => setEditWeight(e.target.value)}
                        style={{
                          fontSize: 17, fontWeight: 700, width: 80,
                          border: `2px solid ${T.teal}`, borderRadius: 10, padding: "3px 8px", outline: "none",
                        }}
                      />
                      <button onClick={() => {
                        const w = parseFloat(editWeight.replace(",", "."));
                        if (!isNaN(w) && w >= 20 && w <= 300)
                          setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, weight: w } : e));
                        setEditingEntry(null);
                      }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                        <Check size={18} color={T.mint} />
                      </button>
                      <button onClick={() => setEditingEntry(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                        <X size={18} color={T.coral} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{entry.weight}</span>
                      <span style={{ fontSize: 13, color: T.textSec }}>kg</span>
                      {diff != null && diff !== 0 && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, marginLeft: 6, padding: "2px 8px", borderRadius: 8,
                          background: diff < 0 ? "#02C39A15" : "#E85D4E15",
                          color: diff < 0 ? T.mint : T.coral,
                        }}>
                          {diff > 0 ? "+" : ""}{diff}
                        </span>
                      )}
                    </div>
                  )}
                  {entry.note ? <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{entry.note}</div> : null}
                </div>
                <div style={{ display: "flex", gap: 2 }}>
                  <button onClick={() => { setEditingEntry(entry.id); setEditWeight(String(entry.weight)); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                    <Edit3 size={15} color={T.teal} />
                  </button>
                  {showConfirmDelete === entry.id ? (
                    <button onClick={() => deleteEntry(entry.id)} style={{
                      background: "#FEE2E2", border: "none", borderRadius: 8, cursor: "pointer",
                      padding: "4px 10px", fontSize: 11, color: T.coral, fontWeight: 700,
                    }}>Elimina</button>
                  ) : (
                    <button onClick={() => setShowConfirmDelete(entry.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                      <Trash2 size={15} color="#D1D5DB" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     SCREEN: FOOD (Nutrition Tracking)
     ═══════════════════════════════════════ */
  // Auto-sync toast overlay (shown on any screen)
  const autoSyncToastEl = autoSyncToast ? (
    <div style={{
      position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 12px)", left: "50%", transform: "translateX(-50%)",
      background: T.card, borderRadius: 20, padding: "8px 16px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
      display: "flex", alignItems: "center", gap: 8, zIndex: 8000, border: `1px solid ${T.mint}30`,
      animation: "fadeInDown 0.3s ease-out",
    }}>
      <CheckCircle2 size={14} color={T.mint} />
      <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Backup aggiornato</span>
    </div>
  ) : null;

  if (screen === "food") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
        {autoSyncToastEl}
        <FoodSection
          ref={foodSectionRef}
          settings={settings}
          weightEntries={sorted}
          goTo={goTo}
          T={T}
          nutritionGoals={nutritionGoals}
          goalHistory={goalHistory}
          onDataChange={triggerAutoSync}
          weightTrend={metrics.current}
          renderNutritionGoalsPanel={() => (
            <NutritionGoalsPanel
              key={(nutritionGoals.kcalTarget || 0) + "_" + (goalHistory[0]?.effectiveFrom || "")}
              nutritionGoals={nutritionGoals}
              onSave={handleSaveNutritionGoals}
              goalEffectiveDate={goalEffectiveDate}
              setGoalEffectiveDate={setGoalEffectiveDate}
            />
          )}
        />
        <BottomNav active="food" onNavigate={goTo} onAdd={() => {
          if (foodSectionRef.current) foodSectionRef.current.openAddFood();
          else goTo("add");
        }} />
        <style>{`@keyframes fadeInDown { from { opacity: 0; transform: translateX(-50%) translateY(-20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     SCREEN: FITNESS
     ═══════════════════════════════════════ */
  if (screen === "fitness") {
    return <FitnessSection onNavigate={goTo} />;
  }

  /* ═══════════════════════════════════════
     SCREEN: GYM
     ═══════════════════════════════════════ */
  if (screen === "gym") {
    return <GymSection onNavigate={goTo} />;
  }

  /* ═══════════════════════════════════════
     SCREEN: PROFILE / SETTINGS (accessible via Settings icon in Home)
     ═══════════════════════════════════════ */
  if (screen === "profile") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif", paddingBottom: 100 }}>
        <Header title="Profilo" subtitle="Impostazioni" />
        <div style={{ padding: "16px 20px" }}>
          <div style={{
            background: T.gradient, borderRadius: 20, padding: "24px 20px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 16,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <User size={28} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{settings.name}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 500, marginTop: 2 }}>
                {metrics.totalEntries || 0} registrazioni  |  {metrics.streak || 0} giorni di streak
              </div>
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginTop: 8 }}>
            Dati personali
          </div>
          {[
            { label: "Nome", key: "name", type: "text", unit: "", icon: User },
            { label: "Altezza", key: "height", type: "number", unit: "cm", icon: Activity },
          ].map(({ label, key, type, unit, icon: Ic }) => (
            <div key={key} style={{
              background: T.card, borderRadius: 14, padding: "12px 16px", marginBottom: 8,
              boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: `${T.teal}10`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Ic size={16} color={T.teal} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{label}</div>
                <input type={type} inputMode={type === "number" ? "decimal" : "text"}
                  value={settings[key]}
                  onChange={e => setSettings(prev => ({ ...prev, [key]: type === "number" ? parseFloat(e.target.value) || "" : e.target.value }))}
                  style={{
                    border: "none", outline: "none", fontSize: 16, fontWeight: 700,
                    color: T.text, fontFamily: "'Inter', sans-serif", background: "transparent", width: "100%",
                  }}
                />
              </div>
              {unit ? <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500 }}>{unit}</span> : null}
            </div>
          ))}

          <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginTop: 20 }}>
            Obiettivi
          </div>
          {[
            { label: "Peso iniziale", key: "startWeight", unit: "kg", icon: Scale },
            { label: "Peso obiettivo", key: "goalWeight", unit: "kg", icon: Target },
          ].map(({ label, key, unit, icon: Ic }) => (
            <div key={key} style={{
              background: T.card, borderRadius: 14, padding: "12px 16px", marginBottom: 8,
              boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: `${T.mint}10`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Ic size={16} color={T.mint} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{label}</div>
                <input type="number" inputMode="decimal"
                  value={settings[key]}
                  onChange={e => setSettings(prev => ({ ...prev, [key]: parseFloat(e.target.value) || "" }))}
                  style={{
                    border: "none", outline: "none", fontSize: 16, fontWeight: 700,
                    color: T.text, fontFamily: "'Inter', sans-serif", background: "transparent", width: "100%",
                  }}
                />
              </div>
              <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500 }}>{unit}</span>
            </div>
          ))}

          {/* Obiettivi Nutrizionali moved to Food Settings sub-screen */}

          <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginTop: 20 }}>
            Riepilogo
          </div>
          <div style={{ background: T.card, borderRadius: 14, padding: "16px", boxShadow: T.shadow }}>
            {[
              { label: "Peso attuale", value: metrics.current != null ? `${metrics.current} kg` : "—" },
              { label: "BMI", value: metrics.bmi ? `${metrics.bmi} (${bmiCategory(metrics.bmi)})` : "—" },
              { label: "Variazione totale", value: metrics.totalChange != null ? `${metrics.totalChange > 0 ? "+" : ""}${metrics.totalChange} kg` : "—" },
              { label: "Ritmo settimanale", value: metrics.weeklyRate != null ? `${metrics.weeklyRate > 0 ? "+" : ""}${metrics.weeklyRate} kg/sett` : "—" },
            ].map((item, i, arr) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", padding: "10px 0",
                borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none",
              }}>
                <span style={{ fontSize: 13, color: T.textSec }}>{item.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* ─── Sync Google Sheets ─── */}
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginTop: 20 }}>
            Sync Google Sheets
          </div>
          <div style={{ background: T.card, borderRadius: 14, padding: 16, boxShadow: T.shadow, marginBottom: 8 }}>
            {/* Connection status */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: sheetsConnected ? T.mint : sheetsUrl ? T.coral : T.border,
                boxShadow: sheetsConnected ? `0 0 8px ${T.mint}` : "none",
              }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                {sheetsConnected ? "Connesso" : sheetsUrl ? "Non connesso" : "Non configurato"}
              </span>
              {lastSyncTime && (
                <span style={{ fontSize: 10, color: T.textMuted, marginLeft: "auto" }}>
                  Ultimo sync: {(() => {
                    const diff = Math.floor((Date.now() - lastSyncTime) / 1000);
                    if (diff < 60) return "adesso";
                    if (diff < 3600) return `${Math.floor(diff / 60)} min fa`;
                    if (diff < 86400) return `${Math.floor(diff / 3600)} ore fa`;
                    return new Date(lastSyncTime).toLocaleDateString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
                  })()}
                </span>
              )}
            </div>

            {/* URL input */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginBottom: 6 }}>URL Web App (Apps Script)</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="url" value={sheetsUrlInput}
                  onChange={(e) => setSheetsUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  style={{
                    flex: 1, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${T.border}`,
                    fontSize: 12, fontFamily: "inherit", color: T.text, outline: "none", background: T.bg,
                  }} />
                <button onClick={() => handleSaveSheetsUrl(sheetsUrlInput)} style={{
                  padding: "10px 14px", borderRadius: 10, border: "none",
                  background: T.gradient, color: "#fff", fontSize: 11, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                }}>
                  {sheetsUrl ? "Aggiorna" : "Salva"}
                </button>
              </div>
            </div>

            {/* Sync status message */}
            {syncMessage && (
              <div style={{
                padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 11, fontWeight: 600,
                background: syncStatus === "success" ? `${T.mint}15` : syncStatus === "error" ? `${T.coral}15` : `${T.teal}10`,
                color: syncStatus === "success" ? T.mint : syncStatus === "error" ? T.coral : T.teal,
              }}>
                {syncStatus === "syncing" && "⏳ "}{syncMessage}
              </div>
            )}

            {/* Sync buttons */}
            {sheetsConnected && (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleFullSync} disabled={syncStatus === "syncing"} style={{
                  flex: 1, padding: 12, borderRadius: 12, border: "none",
                  background: syncStatus === "syncing" ? "#ccc" : T.gradient,
                  color: "#fff", fontSize: 12, fontWeight: 700, cursor: syncStatus === "syncing" ? "default" : "pointer",
                  fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                  <ArrowUp size={14} />
                  Sincronizza Tutto
                </button>
                <button onClick={handleRestore} disabled={syncStatus === "syncing"} style={{
                  flex: 1, padding: 12, borderRadius: 12, border: `1.5px solid ${T.border}`,
                  background: T.card, color: T.text, fontSize: 12, fontWeight: 700,
                  cursor: syncStatus === "syncing" ? "default" : "pointer",
                  fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                  <ArrowDown size={14} />
                  Ripristina
                </button>
              </div>
            )}

            {/* Auto-sync toggle */}
            {sheetsConnected && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px", background: autoSync ? `${T.teal}08` : T.bg,
                borderRadius: 12, border: `1px solid ${autoSync ? `${T.teal}30` : T.border}`,
                marginTop: 4,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Sync automatico</div>
                  <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>Sincronizza 10s dopo ogni modifica</div>
                </div>
                <button onClick={() => handleToggleAutoSync(!autoSync)} style={{
                  width: 48, height: 28, borderRadius: 14, border: "none", cursor: "pointer",
                  background: autoSync ? T.gradient : "#d1d5db", position: "relative",
                  transition: "background 0.2s",
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 11, background: "#fff",
                    position: "absolute", top: 3, left: autoSync ? 23 : 3,
                    transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </button>
              </div>
            )}

            {/* Guide toggle */}
            <button onClick={() => setShowSyncGuide(!showSyncGuide)} style={{
              width: "100%", padding: "10px 0", marginTop: 12, border: "none", background: "transparent",
              cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <Info size={14} color={T.teal} />
              <span style={{ fontSize: 12, fontWeight: 600, color: T.teal }}>
                {showSyncGuide ? "Nascondi guida" : "Come configurare il sync"}
              </span>
              {showSyncGuide
                ? <ChevronLeft size={14} color={T.teal} style={{ transform: "rotate(90deg)" }} />
                : <ChevronRight size={14} color={T.teal} style={{ transform: "rotate(90deg)" }} />
              }
            </button>

            {/* Step-by-step guide */}
            {showSyncGuide && (
              <div style={{ marginTop: 8, padding: 16, background: T.bg, borderRadius: 12, fontSize: 12, lineHeight: 1.7, color: T.textSec }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 12 }}>Guida Setup Google Sheets Sync</div>

                <div style={{ fontSize: 11, fontWeight: 700, color: T.teal, textTransform: "uppercase", marginBottom: 6 }}>Perché è utile?</div>
                <div style={{ marginBottom: 14, fontSize: 11, color: T.textMuted }}>
                  I tuoi dati sono salvati nel browser. Se cambi telefono, pulisci la cache o reinstalli, li perdi.
                  Con il sync su Google Sheets hai un backup cloud gratuito, puoi vedere i dati in formato tabella,
                  creare grafici, e ripristinare tutto su un nuovo dispositivo in un tap.
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: T.teal, textTransform: "uppercase", marginBottom: 6 }}>Come vengono salvati i dati</div>
                <div style={{ marginBottom: 14, fontSize: 11, color: T.textMuted }}>
                  Lo script crea automaticamente 3 fogli nel tuo Google Sheet:
                </div>
                <div style={{ marginBottom: 14, fontSize: 11 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: T.teal, whiteSpace: "nowrap" }}>📋 Diario</span>
                    <span style={{ color: T.textMuted }}>— ogni cibo registrato con data, pasto, grammi, kcal e macro</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: T.teal, whiteSpace: "nowrap" }}>📊 Riepilogo</span>
                    <span style={{ color: T.textMuted }}>— totali giornalieri con obiettivi e scostamento kcal</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ fontWeight: 700, color: T.teal, whiteSpace: "nowrap" }}>🗄️ Database</span>
                    <span style={{ color: T.textMuted }}>— tutti i cibi unici (da scanner, ricerca, manuali) per ricerche future</span>
                  </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: T.teal, textTransform: "uppercase", marginBottom: 6 }}>Sync automatico</div>
                <div style={{ marginBottom: 14, fontSize: 11, color: T.textMuted }}>
                  Con il sync automatico attivo, ogni volta che aggiungi, modifichi o elimini un cibo, i dati vengono
                  sincronizzati su Sheets dopo 10 secondi dall{"'"}ultima modifica. Se fai più modifiche ravvicinate,
                  il timer si resetta per inviarle tutte insieme. Puoi attivare/disattivare il sync automatico con
                  il toggle qui sopra. Il sync manuale è sempre disponibile con il pulsante {"\""}Sincronizza Tutto{"\""}.
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: T.teal, textTransform: "uppercase", marginBottom: 6 }}>Setup (una volta sola, 5 minuti)</div>

                {[
                  { n: "1", title: "Crea un nuovo Google Sheet", desc: "Vai su sheets.google.com e crea un foglio vuoto. Chiamalo come vuoi (es. \"Weight Tracker Backup\")." },
                  { n: "2", title: "Apri Apps Script", desc: "Nel foglio, vai su Estensioni → Apps Script. Si apre l'editor di codice." },
                  { n: "3", title: "Copia e incolla lo script", desc: "Premi il bottone qui sotto per copiare lo script, poi incollalo nell'editor Apps Script (sostituisci tutto il codice). Salva con Ctrl+S.", hasButton: true },
                  { n: "4", title: "Deploy come Web App", desc: "Clicca Deploy → Nuova distribuzione → seleziona \"App web\". Imposta: Esegui come → Me, Accesso → Chiunque. Clicca Deploy." },
                  { n: "5", title: "Autorizza", desc: "Google ti chiederà di autorizzare. Clicca Avanzate → Vai a (nome progetto) → Consenti." },
                  { n: "6", title: "Copia l'URL", desc: "Dopo il deploy, copia l'URL della web app (inizia con https://script.google.com/macros/s/...). Incollalo qui sopra e premi Salva." },
                  { n: "7", title: "Primo sync e auto-sync", desc: "Premi \"Sincronizza Tutto\" per il primo backup. Vedrai 3 fogli creati automaticamente. Attiva il toggle \"Sync automatico\" per mantenere i dati sempre aggiornati senza doverci pensare." },
                ].map(step => (
                  <div key={step.n} style={{ display: "flex", gap: 10, marginBottom: step.hasButton ? 4 : 10 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 8, background: T.teal,
                      color: "#fff", fontSize: 12, fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>{step.n}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{step.title}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{step.desc}</div>
                      {step.hasButton && (
                        <button onClick={() => {
                          navigator.clipboard.writeText(APPS_SCRIPT_CODE).then(() => {
                            setScriptCopied(true);
                            setTimeout(() => setScriptCopied(false), 3000);
                          });
                        }} style={{
                          marginTop: 8, marginBottom: 8, padding: "10px 16px", borderRadius: 10, border: "none",
                          background: scriptCopied ? T.mint : T.gradient,
                          color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                          display: "flex", alignItems: "center", gap: 6, width: "100%", justifyContent: "center",
                        }}>
                          {scriptCopied ? <Check size={14} /> : <Copy size={14} />}
                          {scriptCopied ? "Copiato negli appunti!" : "Copia Script per Apps Script"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: `${T.gold}15`, fontSize: 11, color: T.text }}>
                  <strong style={{ color: T.gold }}>Nota:</strong> i tuoi dati restano nel TUO Google Sheet personale.
                  L'URL dello script non è indicizzato e non è accessibile senza il link diretto.
                  Per uso personale è perfettamente sicuro.
                </div>
              </div>
            )}
          </div>

          {/* ─── Gestione Dati ─── */}
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginTop: 20 }}>
            Gestione Dati
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
            <button onClick={() => { setShowResetSheet(true); setResetInput(""); setResetDeleteDb(false); }} style={{
              flex: 1, padding: "14px 12px", borderRadius: 14,
              border: `1.5px solid ${T.coral}30`,
              background: T.card,
              cursor: "pointer", fontFamily: "inherit", boxShadow: T.shadow,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            }}>
              <Trash2 size={18} color={T.coral} />
              <span style={{ fontSize: 12, fontWeight: 700, color: T.coral }}>Reset Dati Cibo</span>
              <span style={{ fontSize: 10, color: T.textMuted }}>Cancella tutti i cibi</span>
            </button>
            <button onClick={async () => {
              await populateDemoData();
              if (autoSync && sheetsConnected && sheetsUrl) {
                try { await fullSyncToSheets(sheetsUrl, nutritionGoals); } catch {}
              }
              window.location.reload();
            }} style={{
              flex: 1, padding: "14px 12px", borderRadius: 14, border: `1.5px solid ${T.teal}30`,
              background: T.card, cursor: "pointer", fontFamily: "inherit", boxShadow: T.shadow,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            }}>
              <Sparkles size={18} color={T.teal} />
              <span style={{ fontSize: 12, fontWeight: 700, color: T.teal }}>Carica Dati Demo</span>
              <span style={{ fontSize: 10, color: T.textMuted }}>30 giorni di esempio</span>
            </button>
          </div>

          {/* ─── Reset Bottom Sheet ─── */}
          {showResetSheet && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9000 }}>
              {/* Overlay */}
              <div onClick={() => !resetting && setShowResetSheet(false)} style={{
                position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
              }} />
              {/* Sheet */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                background: T.card, borderRadius: "20px 20px 0 0",
                padding: "20px 20px calc(env(safe-area-inset-bottom, 0px) + 20px)",
                boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
                animation: "slideUp 0.3s ease-out",
              }}>
                {/* Handle */}
                <div style={{ width: 40, height: 4, borderRadius: 2, background: T.border, margin: "0 auto 16px" }} />

                {/* Warning icon + title */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `${T.coral}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <AlertCircle size={22} color={T.coral} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>Reset Dati Cibo</div>
                    <div style={{ fontSize: 12, color: T.coral, fontWeight: 600 }}>Questa azione è irreversibile</div>
                  </div>
                </div>

                {/* What will be deleted */}
                <div style={{ padding: 14, background: `${T.coral}08`, borderRadius: 12, marginBottom: 14, fontSize: 12, lineHeight: 1.7, color: T.text }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Verranno cancellati:</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Trash2 size={12} color={T.coral} />
                    <span>Tutti i cibi registrati (Diario)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Trash2 size={12} color={T.coral} />
                    <span>Tutti i riepiloghi giornalieri</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Trash2 size={12} color={T.coral} />
                    <span>Tutti i pasti salvati</span>
                  </div>
                  {sheetsConnected && (
                    <div style={{ marginTop: 6, fontSize: 11, color: T.textMuted }}>
                      I fogli Diario e Riepilogo su Google Sheets verranno svuotati al prossimo sync.
                    </div>
                  )}
                </div>

                {/* Database choice */}
                <div style={{ marginBottom: 16 }}>
                  <button onClick={() => setResetDeleteDb(!resetDeleteDb)} style={{
                    width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${resetDeleteDb ? T.coral : T.border}`,
                    background: resetDeleteDb ? `${T.coral}08` : T.bg, cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, border: `2px solid ${resetDeleteDb ? T.coral : T.border}`,
                      background: resetDeleteDb ? T.coral : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      {resetDeleteDb && <Check size={14} color="#fff" />}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Cancella anche il Database Alimenti</div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                        {resetDeleteDb
                          ? "Il database cibi verrà cancellato dal dispositivo e da Sheets"
                          : "Il database cibi verrà mantenuto per ricerche future"}
                      </div>
                    </div>
                  </button>
                </div>

                {/* DELETE input */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.textSec, marginBottom: 6 }}>
                    Scrivi <span style={{ fontWeight: 800, color: T.coral, fontFamily: "monospace", letterSpacing: 1 }}>DELETE</span> per confermare:
                  </div>
                  <input
                    type="text"
                    value={resetInput}
                    onChange={(e) => setResetInput(e.target.value.toUpperCase())}
                    placeholder="Scrivi DELETE"
                    autoCapitalize="characters"
                    style={{
                      width: "100%", padding: "12px 14px", borderRadius: 12, fontSize: 16, fontWeight: 700,
                      fontFamily: "monospace", letterSpacing: 2, textAlign: "center",
                      border: `2px solid ${resetInput === "DELETE" ? T.coral : T.border}`,
                      background: T.bg, color: T.text, outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowResetSheet(false)} disabled={resetting} style={{
                    flex: 1, padding: 14, borderRadius: 14, border: `1.5px solid ${T.border}`,
                    background: T.card, color: T.text, fontSize: 14, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    Annulla
                  </button>
                  <button
                    onClick={async () => {
                      if (resetInput !== "DELETE") return;
                      setResetting(true);
                      try {
                        await clearAllFoodData(!resetDeleteDb ? false : true);
                        if (sheetsConnected && sheetsUrl) {
                          await syncResetToSheets(sheetsUrl, resetDeleteDb);
                        }
                        window.location.reload();
                      } catch (err) {
                        setResetting(false);
                      }
                    }}
                    disabled={resetInput !== "DELETE" || resetting}
                    style={{
                      flex: 1, padding: 14, borderRadius: 14, border: "none",
                      background: resetInput === "DELETE" ? T.coral : "#d1d5db",
                      color: "#fff", fontSize: 14, fontWeight: 800,
                      cursor: resetInput === "DELETE" ? "pointer" : "default",
                      fontFamily: "inherit", opacity: resetting ? 0.7 : 1,
                    }}
                  >
                    {resetting ? "Cancellando..." : "Cancella Tutto"}
                  </button>
                </div>
              </div>
              <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
            </div>
          )}

          <div style={{ marginTop: 24, padding: "14px 16px", borderRadius: 14, background: T.tealLight, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: T.teal, fontWeight: 600 }}>
              Weight Tracker v2.0 — I tuoi dati restano sul tuo dispositivo
            </div>
          </div>
        </div>
        <BottomNav active="profile" onNavigate={goTo} onAdd={() => goTo("add")} />
      </div>
    );
  }

  /* ═══════════════════════════════════════
     DASHBOARD HELPERS
     ═══════════════════════════════════════ */

  // Smart summary using new comparison data (trend-based)
  const weekDiff = comparisons.weeklyData?.[0]?.diff ?? null;
  const summaryMessage = (() => {
    if (sorted.length < 3) return { text: "Inizia a registrare il tuo peso ogni giorno per vedere i tuoi progressi qui.", mood: "neutral" };
    const goal = settings.goalWeight;
    const current = metrics.current;
    const losing = goal != null && current != null && current > goal;

    if (weekDiff == null) return { text: "Continua a registrare per calcolare i confronti settimanali.", mood: "neutral" };
    if (losing && weekDiff < -0.3) return { text: `Ottimo lavoro! Il trend è sceso di ${Math.abs(weekDiff)} kg questa settimana. Stai andando alla grande.`, mood: "great" };
    if (losing && weekDiff < 0) return { text: `Il trend è sceso di ${Math.abs(weekDiff)} kg questa settimana. Stai andando nella direzione giusta, continua così.`, mood: "good" };
    if (losing && weekDiff === 0) return { text: "Il trend è stabile rispetto alla settimana scorsa. A volte il corpo ha bisogno di una pausa prima di scendere ancora.", mood: "neutral" };
    if (losing && weekDiff > 0) return { text: `Il trend è salito di ${weekDiff} kg questa settimana. È normale avere oscillazioni, guarda il trend a lungo termine.`, mood: "attention" };
    if (!losing && weekDiff > 0.3) return { text: `Ottimo! Il trend è salito di ${weekDiff} kg questa settimana, in linea con il tuo obiettivo.`, mood: "great" };
    return { text: `Variazione trend settimanale: ${weekDiff > 0 ? "+" : ""}${weekDiff} kg. Continua a tracciare per dati più precisi.`, mood: "neutral" };
  })();

  const moodColors = { great: T.mint, good: T.teal, neutral: T.textSec, attention: T.gold };
  const moodIcons = { great: Award, good: TrendingDown, neutral: Activity, attention: AlertCircle };
  const SummaryIcon = moodIcons[summaryMessage.mood] || Activity;

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  // Progress percentage
  const progressPct = (() => {
    if (!settings.goalWeight || !settings.startWeight || metrics.current == null) return 0;
    const total = Math.abs(settings.startWeight - settings.goalWeight);
    const done = Math.abs(settings.startWeight - metrics.current);
    return total > 0 ? Math.min(Math.max((done / total) * 100, 0), 100) : 0;
  })();

  const kgMancanti = (metrics.current != null && settings.goalWeight)
    ? Math.abs(Math.round((metrics.current - settings.goalWeight) * 10) / 10)
    : null;

  const kgPersi = (metrics.totalChange != null)
    ? Math.abs(metrics.totalChange)
    : null;

  /* ═══════════════════════════════════════
     SCREEN: DASHBOARD
     ═══════════════════════════════════════ */
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{
        padding: "16px 16px 0", background: T.bg,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 14,
              background: T.gradient,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>
                {(settings.name || "?").charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                <GreetingIcon size={11} /> {greeting.text}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.text, letterSpacing: -0.5 }}>
                {settings.name}
              </div>
            </div>
          </div>
          <button onClick={() => goTo("profile")} style={{
            background: T.card, border: "none", borderRadius: 12, padding: 10,
            cursor: "pointer", boxShadow: T.shadow,
          }}>
            <Settings size={18} color={T.teal} />
          </button>
        </div>
      </div>

      <div style={{ padding: "14px 16px 120px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ── CHECK-IN PROMPT ── */}
        {!metrics.todayLogged && (
          <div
            onClick={() => goTo("add")}
            style={{
              background: `linear-gradient(135deg, ${T.coral}12, ${T.gold}12)`,
              borderRadius: 16, padding: "14px 16px",
              border: `1px dashed ${T.gold}70`,
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 12,
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: `${T.gold}20`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Scale size={20} color={T.gold} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Non ti sei ancora pesato oggi</div>
              <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>Tocca per registrare il peso di oggi</div>
            </div>
            <ChevronRight size={16} color={T.textMuted} />
          </div>
        )}

        {/* ══════════════════════════════════════════
            1. CARD PRINCIPALE
            ══════════════════════════════════════════ */}
        <div style={{
          background: T.gradient, borderRadius: 20, padding: "20px",
          boxShadow: "0 4px 24px rgba(2,128,144,0.2)",
        }}>
          {/* Top row: peso + circular progress */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Peso attuale
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 4 }}>
                <span style={{ fontSize: 38, fontWeight: 900, color: "#fff" }}>
                  {metrics.current != null ? metrics.current : "—"}
                </span>
                <span style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>kg</span>
              </div>

              {/* Trend con info */}
              {metrics.trend != null && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2, fontWeight: 500, display: "flex", alignItems: "center", gap: 3 }}>
                  {"Trend: "}
                  <span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>{metrics.trend} kg</span>
                  <button
                    onClick={() => setShowTrendInfo(true)}
                    style={{
                      width: 15, height: 15, borderRadius: "50%",
                      background: "rgba(255,255,255,0.25)", border: "none",
                      color: "rgba(255,255,255,0.85)", fontSize: 9, fontWeight: 800,
                      cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
                      marginLeft: 2, flexShrink: 0,
                    }}
                  >i</button>
                </div>
              )}

              {/* vs ieri */}
              {metrics.vsYesterday != null && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6,
                  background: "rgba(255,255,255,0.18)", padding: "3px 10px", borderRadius: 8,
                }}>
                  {metrics.vsYesterday < 0
                    ? <ArrowDown size={11} color="#fff" />
                    : metrics.vsYesterday > 0
                      ? <ArrowUp size={11} color="#fff" />
                      : <Minus size={11} color="#fff" />}
                  <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>
                    {Math.abs(metrics.vsYesterday)} kg vs ieri
                  </span>
                </div>
              )}
            </div>

            {/* Circular progress + obiettivo */}
            <div style={{ textAlign: "center" }}>
              <div style={{ position: "relative", width: 76, height: 76 }}>
                <CircularProgress percentage={Math.round(progressPct)} size={76} strokeWidth={5} color="#fff" />
                <div style={{
                  position: "absolute", top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>{Math.round(progressPct)}%</div>
                </div>
              </div>
              {settings.goalWeight ? (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
                    {"Obiettivo "}
                    <strong style={{ color: "rgba(255,255,255,0.9)" }}>{settings.goalWeight} kg</strong>
                  </div>
                  {kgMancanti != null && (
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", fontWeight: 700, marginTop: 2 }}>
                      {"-"}{kgMancanti} kg al traguardo
                    </div>
                  )}
                  {kgPersi != null && (
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: 600, marginTop: 1 }}>
                      {metrics.totalChange != null && metrics.totalChange < 0 ? `-${kgPersi} kg persi` : `+${kgPersi} kg`}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.15)", margin: "14px 0 12px" }} />

          {/* Previsione */}
          {metrics.predictedDate ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                  <Target size={13} color="rgba(255,255,255,0.75)" />
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
                    {"Raggiungerai "}{settings.goalWeight}{" kg il "}
                    <strong style={{ color: "#fff" }}>{metrics.predictedDate}</strong>
                  </span>
                </div>
                <button
                  onClick={() => setShowPredInfo(true)}
                  style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: "rgba(255,255,255,0.25)", border: "none",
                    color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: 800,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, marginLeft: 6,
                  }}
                >i</button>
              </div>
              {metrics.weeklyRate != null && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 4, paddingLeft: 21 }}>
                  {"Al ritmo di "}{metrics.weeklyRate > 0 ? "+" : ""}{metrics.weeklyRate} kg/settimana
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>
              Aggiungi più dati per vedere la previsione
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════
            2. CONFRONTI
            ══════════════════════════════════════════ */}
        <div style={{ background: T.card, borderRadius: 18, padding: "16px", boxShadow: T.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 12 }}>Confronti</div>

          {/* Tab row */}
          <div style={{
            display: "flex", gap: 0, background: "#E8ECEF", borderRadius: 10, padding: 3, marginBottom: 14,
          }}>
            {[["week", "Settimane"], ["month", "Mesi"]].map(([key, label]) => (
              <button key={key} onClick={() => setCompTab(key)} style={{
                flex: 1, padding: "7px 0", border: "none", borderRadius: 8,
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: compTab === key ? "#fff" : "transparent",
                color: compTab === key ? T.teal : T.textMuted,
                boxShadow: compTab === key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.2s", fontFamily: "'Inter', sans-serif",
              }}>{label}</button>
            ))}
          </div>

          {/* SETTIMANE */}
          {compTab === "week" && (
            <div>
              {comparisons.weeklyData.slice(0, 3).map((w, i) => (
                <div key={w.date} style={{
                  background: T.card, borderRadius: 14, padding: "14px 16px",
                  boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: 8,
                  borderLeft: w.isCurrent ? `3px solid ${T.teal}` : "3px solid transparent",
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>
                      {w.label}
                    </div>
                    {w.trend != null ? (
                      <>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 3 }}>
                          <span style={{ fontSize: 20, fontWeight: 900, color: T.text }}>{w.trend}</span>
                          <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>kg trend</span>
                        </div>
                        <div style={{ fontSize: 9, color: T.textMuted, marginTop: 1 }}>{w.dateLabel}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Dati non disponibili</div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {w.diff != null ? (
                      <div style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8,
                        display: "inline-flex", alignItems: "center", gap: 3,
                        background: w.diff <= 0 ? "#02C39A12" : "#E85D4E12",
                        color: w.diff <= 0 ? T.mint : T.coral,
                      }}>
                        {w.diff <= 0 ? "↓" : "↑"}
                        {" "}{w.diff > 0 ? "+" : ""}{w.diff} kg
                      </div>
                    ) : i === comparisons.weeklyData.slice(0, 3).length - 1 ? (
                      <div style={{
                        fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 8,
                        background: "#F0F0F0", color: T.textMuted,
                      }}>Prima sett.</div>
                    ) : null}
                  </div>
                </div>
              ))}
              <button
                onClick={() => goTo("history")}
                style={{
                  width: "100%", padding: "10px", border: `1px dashed ${T.border}`, borderRadius: 12,
                  background: "transparent", fontSize: 12, fontWeight: 700, color: T.teal,
                  cursor: "pointer", fontFamily: "'Inter', sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  marginTop: 2,
                }}
              >
                Vedi tutte le settimane <ChevronRight size={13} />
              </button>
            </div>
          )}

          {/* MESI */}
          {compTab === "month" && (
            <div>
              {comparisons.monthlyData.slice(0, 3).map((m, i) => (
                <div key={m.date} style={{
                  background: T.card, borderRadius: 14, padding: "14px 16px",
                  boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: 8,
                  borderLeft: m.isCurrent ? `3px solid ${T.teal}` : "3px solid transparent",
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>
                      {m.label}
                    </div>
                    {m.trend != null ? (
                      <>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 3 }}>
                          <span style={{ fontSize: 20, fontWeight: 900, color: T.text }}>{m.trend}</span>
                          <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>kg trend</span>
                        </div>
                        <div style={{ fontSize: 9, color: T.textMuted, marginTop: 1 }}>{m.dateLabel}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Dati non disponibili</div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {m.diff != null ? (
                      <div style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8,
                        display: "inline-flex", alignItems: "center", gap: 3,
                        background: m.diff <= 0 ? "#02C39A12" : "#E85D4E12",
                        color: m.diff <= 0 ? T.mint : T.coral,
                      }}>
                        {m.diff <= 0 ? "↓" : "↑"}
                        {" "}{m.diff > 0 ? "+" : ""}{m.diff} kg
                      </div>
                    ) : (
                      <div style={{
                        fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 8,
                        background: "#F0F0F0", color: T.textMuted,
                      }}>Primo mese</div>
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={() => goTo("history")}
                style={{
                  width: "100%", padding: "10px", border: `1px dashed ${T.border}`, borderRadius: 12,
                  background: "transparent", fontSize: 12, fontWeight: 700, color: T.teal,
                  cursor: "pointer", fontFamily: "'Inter', sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  marginTop: 2,
                }}
              >
                Vedi tutti i mesi <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════
            3. RIEPILOGO INTELLIGENTE
            ══════════════════════════════════════════ */}
        <div style={{
          background: T.card, borderRadius: 16, padding: "14px 16px",
          boxShadow: T.shadow, borderLeft: `4px solid ${moodColors[summaryMessage.mood]}`,
        }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: `${moodColors[summaryMessage.mood]}15`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <SummaryIcon size={16} color={moodColors[summaryMessage.mood]} />
            </div>
            <div style={{ fontSize: 13, color: T.text, lineHeight: 1.55, fontWeight: 500 }}>
              {summaryMessage.text}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            4. GRAFICO con impostazioni
            ══════════════════════════════════════════ */}
        <div style={{ background: T.card, borderRadius: 18, padding: "16px 14px 8px", boxShadow: T.shadow }}>
          {/* Header grafico */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, padding: "0 4px" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Andamento</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex", gap: 3 }}>
                {["1W", "1M", "3M", "ALL"].map(r => (
                  <button key={r} onClick={() => setChartRange(r)} style={{
                    padding: "4px 9px", borderRadius: 7, border: "none", fontSize: 10, fontWeight: 700,
                    background: chartRange === r ? T.teal : T.tealLight,
                    color: chartRange === r ? "#fff" : T.teal,
                    cursor: "pointer", fontFamily: "'Inter', sans-serif",
                  }}>{r}</button>
                ))}
              </div>
              {/* Gear button */}
              <button
                onClick={() => setShowChartSettings(prev => !prev)}
                style={{
                  width: 28, height: 28, borderRadius: 8, border: "none",
                  background: showChartSettings ? T.tealLight : T.bg,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Settings size={14} color={showChartSettings ? T.teal : T.textMuted} />
              </button>
            </div>
          </div>

          {/* Settings panel */}
          {showChartSettings && (
            <div style={{
              background: T.bg, borderRadius: 12, padding: "2px 14px 2px",
              margin: "8px 4px",
            }}>
              {[
                { key: "showObjective", label: "Mostra obiettivo" },
                { key: "showBMIZones", label: "Mostra zone BMI" },
                { key: "showScale", label: "Mostra peso bilancia" },
                { key: "showTrend", label: "Mostra trend" },
              ].map(({ key, label }, i, arr) => (
                <div key={key} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "9px 0",
                  borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none",
                }}>
                  <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{label}</span>
                  <button
                    onClick={() => setChartSettings(prev => ({ ...prev, [key]: !prev[key] }))}
                    style={{
                      width: 40, height: 22, borderRadius: 11, border: "none",
                      background: chartSettings[key] ? T.teal : "#D1D5DB",
                      position: "relative", cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: "absolute", top: 2,
                      left: chartSettings[key] ? 20 : 2,
                      width: 18, height: 18, borderRadius: 9, background: "#fff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                      transition: "left 0.2s",
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
                <linearGradient id="areaGradNew" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.teal} stopOpacity={0.12} />
                  <stop offset="95%" stopColor={T.teal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8ECEF" vertical={false} />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 9, fill: T.textMuted }} tickLine={false} axisLine={false} />
              <YAxis domain={weightDomain} tick={{ fontSize: 9, fill: T.textMuted }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />

              {/* BMI zones */}
              {chartSettings.showBMIZones && settings.height && bmiZones.map(zone => (
                <ReferenceArea key={zone.name} y1={zone.y1} y2={zone.y2} fill={zone.color} fillOpacity={0.07} />
              ))}

              {/* Obiettivo */}
              {chartSettings.showObjective && settings.goalWeight && (
                <ReferenceLine y={settings.goalWeight} stroke={T.mint} strokeDasharray="6 4" strokeWidth={1.5} />
              )}

              {/* Trend area */}
              {chartSettings.showTrend && (
                <Area type="monotone" dataKey="trend" fill="url(#areaGradNew)" stroke="none" />
              )}

              {/* Peso bilancia */}
              {chartSettings.showScale && (
                <Line type="monotone" dataKey="weight" stroke="#C5D0D0" strokeWidth={1.5}
                  dot={{ r: 2.5, fill: "#C5D0D0", strokeWidth: 0 }} activeDot={{ r: 5, fill: T.teal }} />
              )}

              {/* Trend line */}
              {chartSettings.showTrend && (
                <Line type="monotone" dataKey="trend" stroke={T.teal} strokeWidth={2.5} dot={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ══════════════════════════════════════════
            5. ULTIME REGISTRAZIONI
            ══════════════════════════════════════════ */}
        <div style={{ background: T.card, borderRadius: 18, padding: "14px 16px", boxShadow: T.shadow }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Ultime registrazioni</span>
            <button onClick={() => goTo("history")} style={{
              background: T.tealLight, border: "none", fontSize: 11, color: T.teal,
              fontWeight: 700, cursor: "pointer", padding: "5px 12px", borderRadius: 8,
              display: "flex", alignItems: "center", gap: 3, fontFamily: "'Inter', sans-serif",
            }}>
              Tutte <ChevronRight size={13} />
            </button>
          </div>

          {/* Header colonne */}
          <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, textTransform: "uppercase" }}>Data</span>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", width: 44, textAlign: "center" }}>Diff</span>
              <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", width: 50, textAlign: "center" }}>Ritmo</span>
              <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", width: 60, textAlign: "right" }}>Peso</span>
            </div>
          </div>

          {recentWithRitmo.map((entry, idx) => {
            const isToday = entry.date === today();
            const isYesterday = (() => {
              const y = new Date(); y.setDate(y.getDate() - 1);
              return entry.date === toISO(y);
            })();
            const dateLabel = isToday ? "Oggi" : isYesterday ? "Ieri" : formatDate(entry.date);
            const dateSubLabel = !isToday && !isYesterday ? "" : formatDate(entry.date);

            return (
              <div key={entry.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 0", borderTop: `1px solid ${T.border}`,
              }}>
                <div>
                  <span style={{ fontSize: 12, color: isToday ? T.teal : T.text, fontWeight: isToday ? 700 : 600 }}>
                    {dateLabel}
                  </span>
                  {(isToday || isYesterday) && (
                    <span style={{ fontSize: 10, color: T.textMuted, marginLeft: 4 }}>
                      {formatDate(entry.date)}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Diff */}
                  <div style={{ width: 44, display: "flex", justifyContent: "center" }}>
                    {entry.diff != null ? (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                        background: entry.diff < 0 ? "#02C39A12" : entry.diff > 0 ? "#E85D4E12" : "#F0F0F0",
                        color: entry.diff < 0 ? T.mint : entry.diff > 0 ? T.coral : T.textMuted,
                        display: "inline-flex", alignItems: "center",
                      }}>
                        {entry.diff > 0 ? "+" : ""}{entry.diff}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: T.textMuted }}>—</span>
                    )}
                  </div>
                  {/* Ritmo */}
                  <div style={{ width: 50, textAlign: "center" }}>
                    {entry.ritmo != null ? (
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: entry.ritmo < 0 ? T.mint : entry.ritmo > 0 ? T.coral : T.textMuted,
                      }}>
                        {entry.ritmo > 0 ? "+" : ""}{entry.ritmo}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: T.textMuted }}>—</span>
                    )}
                  </div>
                  {/* Peso */}
                  <div style={{ width: 60, textAlign: "right" }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{entry.weight} kg</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      <BottomNav active="dashboard" onNavigate={goTo} onAdd={() => goTo("add")} />

      {/* ══════════════════════════════════════════
          INFO POPUP: Cos'è il Trend
          ══════════════════════════════════════════ */}
      <InfoPopup show={showTrendInfo} onClose={() => setShowTrendInfo(false)} title="Cos'è il Trend?">
        <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7 }}>
          {"Il peso sulla bilancia cambia ogni giorno per molte ragioni: quanta acqua hai bevuto, cosa hai mangiato, se hai fatto attività fisica. Queste oscillazioni possono essere di "}
          <strong>0.5–1.5 kg in un solo giorno</strong>
          {"."}<br /><br />
          {"Il "}
          <strong>trend</strong>
          {" filtra queste oscillazioni e ti mostra la direzione reale del tuo peso. È come guardare il percorso dall'alto invece che passo per passo."}<br /><br />
          {"Per questo lo usiamo in tutti i calcoli (previsioni, confronti, ritmo): il trend è più affidabile del singolo dato della bilancia."}
          <br /><br />
          <span style={{ color: T.textMuted, fontSize: 12 }}>
            Tecnicamente usiamo una media mobile esponenziale (EMA) che pesa di più i giorni recenti.
          </span>
        </div>
      </InfoPopup>

      {/* ══════════════════════════════════════════
          INFO POPUP: Come viene calcolata la previsione
          ══════════════════════════════════════════ */}
      <InfoPopup show={showPredInfo} onClose={() => setShowPredInfo(false)} title="Come calcoliamo la previsione">
        <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7 }}>
          {"Guardiamo il tuo "}
          <strong>trend degli ultimi 14 giorni</strong>
          {" e calcoliamo quanto peso perdi in media a settimana."}
          <br /><br />
          {metrics.weeklyRate != null && metrics.weeksToGoal != null ? (
            <>
              {"Se mantieni il ritmo attuale di "}
              <strong>{metrics.weeklyRate > 0 ? "+" : ""}{metrics.weeklyRate} kg/sett</strong>
              {", raggiungerai l'obiettivo in circa "}
              <strong>{metrics.weeksToGoal} {metrics.weeksToGoal === 1 ? "settimana" : "settimane"}</strong>
              {"."}
            </>
          ) : "Continua a registrare per vedere la previsione."}
          <br /><br />
          <span style={{ color: T.textMuted, fontSize: 12 }}>
            La previsione si aggiorna ogni giorno in base ai tuoi dati più recenti.
          </span>
        </div>
      </InfoPopup>

    </div>
  );
}
