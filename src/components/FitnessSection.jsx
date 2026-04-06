"use client";
// FitnessSection.jsx — Walking tracker module
// v4 — Toast, custom confirm, dynamic chips, redesigned goal modal

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  BarChart, Bar, XAxis, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  ChevronLeft, Plus, Check, X, Settings,
  Timer, Gauge, Footprints, Home, Utensils, Dumbbell, User,
  Flame, TrendingUp, TrendingDown, BarChart3, Zap,
  Heart, Mountain, Clock, Trash2, AlertTriangle, Award, Trophy,
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

const DAY_LABELS = ["Lu", "Ma", "Me", "Gi", "Ve", "Sa", "Do"];

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
   CURRENT STREAK
   ═══════════════════════════════════════════ */
const calcCurrentStreak = (activities) => {
  if (!activities.length) return 0;
  const dates = [...new Set(activities.map(a => a.date))].sort().reverse();
  const today = todayISO();
  const yesterday = toISO(new Date(Date.now() - 86400000));
  if (dates[0] !== today && dates[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i - 1]) - new Date(dates[i])) / 86400000;
    if (diff === 1) streak++;
    else break;
  }
  return streak;
};

/* ═══════════════════════════════════════════
   BADGE / ACHIEVEMENT SYSTEM
   ═══════════════════════════════════════════ */
const BADGES = [
  // Distanza cumulativa
  { id:"total_10",   emoji:"👟", name:"Primi passi",       desc:"Raggiungi 10 km totali",      category:"km",     check: s => s.totalKm >= 10,    tier:0 },
  { id:"total_25",   emoji:"🎯", name:"25 km!",            desc:"Raggiungi 25 km totali",      category:"km",     check: s => s.totalKm >= 25,    tier:0 },
  { id:"total_50",   emoji:"🏃", name:"50 km club",        desc:"Raggiungi 50 km totali",      category:"km",     check: s => s.totalKm >= 50,    tier:1 },
  { id:"total_100",  emoji:"💯", name:"Cento!",            desc:"Raggiungi 100 km totali",     category:"km",     check: s => s.totalKm >= 100,   tier:1 },
  { id:"total_200",  emoji:"🌟", name:"200 km!",           desc:"Raggiungi 200 km totali",     category:"km",     check: s => s.totalKm >= 200,   tier:2 },
  { id:"total_500",  emoji:"🏆", name:"500 km leggendario",desc:"Raggiungi 500 km totali",     category:"km",     check: s => s.totalKm >= 500,   tier:2 },
  { id:"total_1000", emoji:"🥇", name:"Mille!",            desc:"Raggiungi 1000 km totali",    category:"km",     check: s => s.totalKm >= 1000,  tier:2 },
  // Sessione singola — distanza
  { id:"single_5",   emoji:"🎯", name:"Cinque!",           desc:"Cammina 5+ km in una sessione",   category:"dist", check: s => s.maxDist >= 5,   tier:0 },
  { id:"single_10",  emoji:"🏔", name:"Dieci!",            desc:"Cammina 10+ km in una sessione",  category:"dist", check: s => s.maxDist >= 10,  tier:1 },
  { id:"single_15",  emoji:"⛰️",  name:"Ultra",             desc:"Cammina 15+ km in una sessione",  category:"dist", check: s => s.maxDist >= 15,  tier:2 },
  // Sessione singola — kcal (ripetibili)
  { id:"kcal_500",   emoji:"🔥", name:"Bruciatore",        desc:"Brucia 500+ kcal in una sessione",  category:"kcal", check: s => s.maxKcal >= 500,  tier:1, repeatable:true },
  { id:"kcal_800",   emoji:"💥", name:"Inferno",           desc:"Brucia 800+ kcal in una sessione",  category:"kcal", check: s => s.maxKcal >= 800,  tier:2, repeatable:true },
  { id:"kcal_1000",  emoji:"☄️",  name:"Supernova",         desc:"Brucia 1000+ kcal in una sessione", category:"kcal", check: s => s.maxKcal >= 1000, tier:2, repeatable:true },
  // Ritmo
  { id:"pace_10",    emoji:"⚡", name:"Passo svelto",      desc:"Ritmo sotto 10 min/km",       category:"pace",   check: s => s.bestPace < 10 && s.bestPace > 0, tier:1 },
  { id:"pace_8",     emoji:"🚀", name:"Razzo",             desc:"Ritmo sotto 8 min/km",        category:"pace",   check: s => s.bestPace < 8 && s.bestPace > 0,  tier:2 },
  // Streak (7+ ripetibili)
  { id:"streak_3",   emoji:"🔥", name:"Tre di fila",       desc:"Streak di 3 giorni",          category:"streak", check: s => s.maxStreak >= 3,   tier:0 },
  { id:"streak_7",   emoji:"⚡", name:"Settimana perfetta",desc:"Streak di 7 giorni",          category:"streak", check: s => s.maxStreak >= 7,   tier:1, repeatable:true },
  { id:"streak_14",  emoji:"👑", name:"Due settimane!",    desc:"Streak di 14 giorni",         category:"streak", check: s => s.maxStreak >= 14,  tier:2, repeatable:true },
  { id:"streak_30",  emoji:"🏅", name:"Mese d'acciaio",   desc:"Streak di 30 giorni",         category:"streak", check: s => s.maxStreak >= 30,  tier:2, repeatable:true },
  { id:"streak_60",  emoji:"💎", name:"Inarrestabile",     desc:"Streak di 60 giorni",         category:"streak", check: s => s.maxStreak >= 60,  tier:2, repeatable:true },
  // Sessioni totali
  { id:"sess_10",    emoji:"📊", name:"10 sessioni",       desc:"Completa 10 sessioni",        category:"sess",   check: s => s.totalSess >= 10,  tier:0 },
  { id:"sess_25",    emoji:"📈", name:"25 sessioni",       desc:"Completa 25 sessioni",        category:"sess",   check: s => s.totalSess >= 25,  tier:0 },
  { id:"sess_50",    emoji:"🎖",  name:"50 sessioni",       desc:"Completa 50 sessioni",        category:"sess",   check: s => s.totalSess >= 50,  tier:1 },
  { id:"sess_100",   emoji:"🏅", name:"100 sessioni",      desc:"Completa 100 sessioni",       category:"sess",   check: s => s.totalSess >= 100, tier:1 },
  { id:"sess_200",   emoji:"👑", name:"200 sessioni",      desc:"Completa 200 sessioni",       category:"sess",   check: s => s.totalSess >= 200, tier:2 },
  // Obiettivo settimanale consecutivo
  { id:"goal_2w",    emoji:"✅", name:"Costante",          desc:"Obiettivo raggiunto 2 sett. di fila", category:"goal", check: s => s.goalStreak >= 2, tier:0, repeatable:true },
  { id:"goal_4w",    emoji:"🎖",  name:"Mese d'oro",        desc:"Obiettivo raggiunto 4 sett. di fila", category:"goal", check: s => s.goalStreak >= 4, tier:1, repeatable:true },
  { id:"goal_8w",    emoji:"💪", name:"Due mesi!",         desc:"Obiettivo raggiunto 8 sett. di fila", category:"goal", check: s => s.goalStreak >= 8, tier:2, repeatable:true },
  { id:"goal_12w",   emoji:"🏆", name:"Trimestre d'oro",   desc:"Obiettivo raggiunto 12 sett. di fila",category:"goal", check: s => s.goalStreak >= 12, tier:2, repeatable:true },
  // Costanza mensile
  { id:"month_15d",  emoji:"📅", name:"Mese attivo",       desc:"Cammina 15+ giorni in un mese",    category:"monthly", check: s => s.daysThisMonth >= 15, tier:1, repeatable:true },
  { id:"month_20d",  emoji:"🗓",  name:"Instancabile",      desc:"Cammina 20+ giorni in un mese",    category:"monthly", check: s => s.daysThisMonth >= 20, tier:2, repeatable:true },
];

const calcBadgeStats = (activities, weeklyGoal) => {
  const pr = calcPR(activities);
  const maxStreak = calcMaxStreak(activities);
  const now = new Date();
  const thisMonth = activities.filter(a => { const d = new Date(a.date); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
  const daysThisMonth = new Set(thisMonth.map(a => a.date)).size;

  // Calcola goal streak (settimane consecutive con obiettivo raggiunto, contando all'indietro)
  let goalStreak = 0;
  for (let w = 0; w < 52; w++) {
    const mon = new Date(getMondayISO());
    mon.setDate(mon.getDate() - w * 7);
    const days = getWeekDays(toISO(mon));
    const wkKm = days.reduce((s, iso) => s + activities.filter(a => a.date === iso).reduce((ss, a) => ss + a.distanceKm, 0), 0);
    if (wkKm >= weeklyGoal) goalStreak++;
    else break;
  }

  return {
    totalKm: pr.totalKm, maxDist: pr.maxDist, bestPace: pr.bestPace,
    maxKcal: pr.maxKcal, totalMin: pr.totalMin,
    maxStreak, totalSess: activities.length,
    goalStreak, daysThisMonth,
  };
};

const getUnlockedBadges = (stats) => BADGES.filter(b => b.check(stats));

const getNewlyUnlocked = (statsBefore, statsAfter, repeatCountsBefore, repeatCountsAfter) => {
  const before = new Set(BADGES.filter(b => b.check(statsBefore)).map(b => b.id));
  const firstTime = BADGES.filter(b => b.check(statsAfter) && !before.has(b.id));
  // Also detect repeatable badges that incremented
  const repeats = BADGES.filter(b => b.repeatable && b.check(statsAfter) && before.has(b.id) && (repeatCountsAfter[b.id] || 0) > (repeatCountsBefore[b.id] || 0));
  return [...firstTime, ...repeats];
};

/* Count how many times each repeatable badge was achieved from activity history */
const countRepeatableAchievements = (activities, weeklyGoal) => {
  const counts = {};
  if (!activities.length) return counts;

  // Kcal badges: count sessions with kcal >= threshold
  const kcalThresholds = { kcal_500: 500, kcal_800: 800, kcal_1000: 1000 };
  for (const [id, thr] of Object.entries(kcalThresholds)) {
    counts[id] = activities.filter(a => (a.calories || 0) >= thr).length;
  }

  // Streak badges: count separate qualifying streaks
  // Walk through sorted dates, count completed streaks >= N
  const dates = [...new Set(activities.map(a => a.date))].sort();
  const streaks = []; // array of streak lengths
  let cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
    if (diff === 1) cur++;
    else { streaks.push(cur); cur = 1; }
  }
  streaks.push(cur);
  const streakThresholds = { streak_7: 7, streak_14: 14, streak_30: 30, streak_60: 60 };
  for (const [id, thr] of Object.entries(streakThresholds)) {
    counts[id] = streaks.filter(s => s >= thr).length;
  }

  // Goal streak badges: count separate runs of consecutive weeks meeting goal
  const goalRuns = [];
  let goalCur = 0;
  for (let w = 51; w >= 0; w--) {
    const mon = new Date(getMondayISO());
    mon.setDate(mon.getDate() - w * 7);
    const days = getWeekDays(toISO(mon));
    const wkKm = days.reduce((s, iso) => s + activities.filter(a => a.date === iso).reduce((ss, a) => ss + a.distanceKm, 0), 0);
    if (wkKm >= weeklyGoal) goalCur++;
    else { if (goalCur > 0) goalRuns.push(goalCur); goalCur = 0; }
  }
  if (goalCur > 0) goalRuns.push(goalCur);
  const goalThresholds = { goal_2w: 2, goal_4w: 4, goal_8w: 8, goal_12w: 12 };
  for (const [id, thr] of Object.entries(goalThresholds)) {
    counts[id] = goalRuns.filter(r => r >= thr).length;
  }

  // Monthly badges: count months with >= N unique activity days
  const monthMap = {};
  activities.forEach(a => {
    const key = a.date.slice(0, 7); // "YYYY-MM"
    if (!monthMap[key]) monthMap[key] = new Set();
    monthMap[key].add(a.date);
  });
  counts["month_15d"] = Object.values(monthMap).filter(s => s.size >= 15).length;
  counts["month_20d"] = Object.values(monthMap).filter(s => s.size >= 20).length;

  return counts;
};

/* ═══════════════════════════════════════════
   SPARKLINE (SVG)
   ═══════════════════════════════════════════ */
const Sparkline = ({ data, width = "100%", height = 36, color }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const padY = 4, usableH = height - padY * 2;
  const n = data.length;
  const points = data.map((v, i) => ({
    x: (i / (n - 1)) * 100,
    y: padY + usableH - ((v - min) / range) * usableH,
  }));
  const isUp = data[n - 1] >= data[Math.max(0, n - 2)];
  const lineC = color || (isUp ? T.teal : T.coral);
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L${points[n - 1].x} ${height} L0 ${height} Z`;
  const last = points[n - 1];
  const avg = data.reduce((s, v) => s + v, 0) / n;
  const avgY = padY + usableH - ((avg - min) / range) * usableH;

  return (
    <svg viewBox={`0 0 100 ${height}`} width={width} height={height} preserveAspectRatio="none" style={{ display:"block" }}>
      <defs>
        <linearGradient id="spkG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineC} stopOpacity={0.15}/>
          <stop offset="100%" stopColor={lineC} stopOpacity={0.02}/>
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#spkG)"/>
      <line x1={0} y1={avgY} x2={100} y2={avgY} stroke={T.textMuted} strokeWidth={0.3} strokeDasharray="2 1.5" opacity={0.5}/>
      <path d={pathD} fill="none" stroke={lineC} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={last.x} cy={last.y} r={2} fill={lineC} stroke="#fff" strokeWidth={1}/>
    </svg>
  );
};

/* ═══════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════ */

/* ── Toast notification ── */
const Toast = ({ message, icon, action, onAction, onDismiss, color = T.teal }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 300); }, action ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div style={{
      position:"fixed",bottom:100,left:"50%",transform:`translateX(-50%) translateY(${visible?0:40}px)`,
      opacity:visible?1:0,transition:"all 0.3s ease",zIndex:200,
      background:"#1E293B",borderRadius:16,padding:"12px 20px",
      display:"flex",alignItems:"center",gap:10,boxShadow:"0 10px 40px rgba(0,0,0,0.3)",
      maxWidth:"calc(100% - 40px)",
    }}>
      {icon && <span style={{ fontSize:18 }}>{icon}</span>}
      <span style={{ fontSize:13,fontWeight:600,color:"#fff",flex:1 }}>{message}</span>
      {action && (
        <button onClick={() => { onAction(); setVisible(false); setTimeout(onDismiss, 300); }} style={{
          background:"none",border:"none",cursor:"pointer",fontSize:13,fontWeight:800,color,padding:"4px 8px",
        }}>{action}</button>
      )}
    </div>
  );
};

/* ── Badge Toast (golden, animated — for achievements) ── */
const BadgeToast = ({ badge, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const [pop, setPop] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    setTimeout(() => setPop(true), 200);
    const timer = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 400); }, 4500);
    return () => clearTimeout(timer);
  }, []);
  const isBig = badge.tier >= 2;
  return (
    <>
      {isBig && <div style={{
        position:"fixed",inset:0,zIndex:199,pointerEvents:"none",
        background:"radial-gradient(circle at 50% 70%,rgba(240,180,41,0.15),transparent 70%)",
        opacity:visible?1:0,transition:"opacity 0.8s",
      }}/>}
      <div style={{
        position:"fixed",bottom:100,left:"50%",zIndex:200,width:340,maxWidth:"calc(100% - 32px)",
        transform:`translateX(-50%) translateY(${visible?0:60}px) scale(${visible?1:0.9})`,
        opacity:visible?1:0,transition:"all 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        <div style={{
          background:"linear-gradient(135deg,#1a1a2e,#16213e)",borderRadius:20,padding:"16px 18px",
          border:`1.5px solid ${T.gold}44`,boxShadow:`0 16px 48px rgba(0,0,0,0.35),0 0 30px ${T.gold}15`,
          position:"relative",overflow:"hidden",display:"flex",alignItems:"center",gap:14,
        }}>
          <div style={{
            position:"absolute",top:0,left:"-80%",width:"60%",height:"100%",
            background:`linear-gradient(90deg,transparent,${T.gold}10,transparent)`,
            animation:visible?"shineSlide 2s ease-in-out 0.5s":"none",
            pointerEvents:"none",
          }}/>
          <div style={{
            width:52,height:52,borderRadius:16,flexShrink:0,
            background:`linear-gradient(135deg,${T.gold},#F59E0B)`,
            display:"flex",alignItems:"center",justifyContent:"center",
            transform:pop?"scale(1) rotate(0deg)":"scale(0) rotate(-20deg)",
            transition:"transform 0.6s cubic-bezier(0.34,1.56,0.64,1)",
            boxShadow:`0 4px 16px ${T.gold}55`,
          }}>
            <span style={{ fontSize:26 }}>{badge.emoji}</span>
          </div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:3 }}>
              <span style={{ fontSize:10,fontWeight:800,color:T.gold,textTransform:"uppercase",letterSpacing:1 }}>Nuovo traguardo!</span>
              <span style={{ fontSize:10 }}>✨</span>
            </div>
            <div style={{ fontSize:15,fontWeight:800,color:"#fff",marginBottom:2 }}>{badge.name}</div>
            <div style={{ fontSize:11,color:"rgba(255,255,255,0.6)",fontWeight:500 }}>{badge.desc}</div>
          </div>
        </div>
      </div>
    </>
  );
};

/* ── PR Toast (teal gradient — for personal records) ── */
const PRToast = ({ message, icon, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 300); }, 4000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div style={{
      position:"fixed",bottom:100,left:"50%",zIndex:200,maxWidth:"calc(100% - 40px)",
      transform:`translateX(-50%) translateY(${visible?0:40}px)`,
      opacity:visible?1:0,transition:"all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
    }}>
      <div style={{
        background:"linear-gradient(135deg,#028090,#02C39A)",borderRadius:16,padding:"12px 20px",
        border:"1.5px solid rgba(2,195,154,0.3)",boxShadow:"0 10px 40px rgba(2,128,144,0.4)",
        display:"flex",alignItems:"center",gap:12,
      }}>
        <span style={{ fontSize:22 }}>{icon}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:9,fontWeight:800,color:"rgba(255,255,255,0.7)",textTransform:"uppercase",letterSpacing:1,marginBottom:2 }}>Nuovo Record!</div>
          <span style={{ fontSize:14,fontWeight:700,color:"#fff" }}>{message}</span>
        </div>
      </div>
    </div>
  );
};

/* ── Custom Confirm Modal ── */
const ConfirmModal = ({ title, message, confirmLabel = "Elimina", onConfirm, onCancel }) => (
  <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:150,padding:20 }}>
    <div style={{ background:T.card,borderRadius:24,padding:28,width:"100%",maxWidth:320,boxShadow:T.shadowLg }}>
      <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:16 }}>
        <div style={{ width:40,height:40,borderRadius:12,background:"#FEF2F2",display:"flex",alignItems:"center",justifyContent:"center" }}>
          <AlertTriangle size={20} color="#DC2626"/>
        </div>
        <div style={{ fontSize:17,fontWeight:800,color:T.text }}>{title}</div>
      </div>
      <div style={{ fontSize:13,color:T.textSec,lineHeight:1.5,marginBottom:24 }}>{message}</div>
      <div style={{ display:"flex",gap:10 }}>
        <button onClick={onCancel} style={{
          flex:1,padding:14,borderRadius:14,border:`1.5px solid ${T.border}`,background:T.bg,
          fontSize:14,fontWeight:700,color:T.textSec,cursor:"pointer",
        }}>Annulla</button>
        <button onClick={onConfirm} style={{
          flex:1,padding:14,borderRadius:14,border:"none",background:"#DC2626",
          fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer",
        }}>{confirmLabel}</button>
      </div>
    </div>
  </div>
);

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
   SESSION CARD (tocca per modificare)
   ═══════════════════════════════════════════ */
const SessionCard = ({ activity: a, onClick }) => (
  <div onClick={() => onClick(a)} style={{
    background:T.card, borderRadius:16, padding:"14px 16px",
    boxShadow:T.shadow, display:"flex", alignItems:"center", gap:12,
    cursor:"pointer", marginBottom:10,
  }}>
    <div style={{ width:46,height:46,borderRadius:14,background:GREEN_LIGHT,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <Footprints size={21} color={GREEN}/>
    </div>
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ display:"flex",alignItems:"baseline",gap:6,marginBottom:5 }}>
        <span style={{ fontSize:22,fontWeight:900,color:T.text,letterSpacing:-.5 }}>{a.distanceKm.toFixed(1)}</span>
        <span style={{ fontSize:12,fontWeight:700,color:T.textMuted }}>km</span>
        <span style={{ fontSize:11,color:T.textMuted,marginLeft:"auto",whiteSpace:"nowrap" }}>{formatDateLabel(a.date)}</span>
      </div>
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
);

/* ═══════════════════════════════════════════
   MODAL: MODIFICA OBIETTIVO (redesigned)
   ═══════════════════════════════════════════ */
const GoalModal = ({ current, onSave, onClose }) => {
  const [val, setVal] = useState(current);
  const adj = (d) => setVal(v => Math.max(1, Math.min(200, v + d)));
  const btnStyle = (bg, color, size = "normal") => ({
    flex: size === "large" ? 2 : 1,
    height: 48, borderRadius: 14, border: "none", cursor: "pointer",
    fontSize: size === "large" ? 18 : 15, fontWeight: 800, color,
    background: bg, transition: "transform 0.1s",
    display: "flex", alignItems: "center", justifyContent: "center",
  });
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:T.card,borderRadius:28,padding:"28px 24px",width:"100%",maxWidth:340,boxShadow:T.shadowLg }}>
        {/* Header */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
          <div style={{ fontSize:17,fontWeight:800,color:T.text }}>Obiettivo settimanale</div>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",padding:4 }}><X size={20} color={T.textMuted}/></button>
        </div>
        <div style={{ fontSize:11,color:T.textMuted,marginBottom:20 }}>Quanti km vuoi percorrere ogni settimana?</div>

        {/* Value display */}
        <div style={{ textAlign:"center",marginBottom:20 }}>
          <div style={{ background:"linear-gradient(135deg,#028090,#02C39A)",borderRadius:20,padding:"20px 16px",display:"inline-block",minWidth:160 }}>
            <span style={{ fontSize:52,fontWeight:900,color:"#fff",letterSpacing:-2 }}>{val}</span>
            <span style={{ fontSize:18,color:"rgba(255,255,255,0.8)",fontWeight:700,marginLeft:4 }}>km</span>
          </div>
        </div>

        {/* Buttons row: -5 -1 | +1 +5 */}
        <div style={{ display:"flex",gap:8,marginBottom:20 }}>
          <button onClick={() => adj(-5)} style={btnStyle("#FEE2E2","#DC2626")}>−5</button>
          <button onClick={() => adj(-1)} style={btnStyle("#FEF3C7","#92400E")}>−1</button>
          <button onClick={() => adj(+1)} style={btnStyle("#DCFCE7","#166534")}>+1</button>
          <button onClick={() => adj(+5)} style={btnStyle("#D1FAE5","#065F46")}>+5</button>
        </div>

        {/* Save */}
        <button onClick={() => { onSave(val); onClose(); }} style={{
          width:"100%",padding:16,borderRadius:16,border:"none",
          background:"linear-gradient(135deg,#028090,#02C39A)",
          color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          boxShadow:"0 6px 20px rgba(2,128,144,0.3)",
        }}>
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

const WalkForm = ({ initial, userProfile, onSave, onBack, title, onDelete, editId, onNavigateSection, allActivities = [] }) => {
  const [date,      setDate]      = useState(initial?.date      ?? todayISO());
  const [km,        setKm]        = useState(initial?.distanceKm ?? 5.0);
  const [duration,  setDuration]  = useState(initial?.durationMin ?? 50);
  const [heartRate, setHeartRate] = useState(initial?.heartRate  ?? 0);
  const [slope,     setSlope]     = useState(initial?.slope      ?? 0);
  const [kcalOver,  setKcalOver]  = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showKmInput, setShowKmInput] = useState(false);
  const kmInputRef = useRef(null);

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

  // Dynamic duration chips — basate sulle durate più usate dall'utente
  const dynamicChips = useMemo(() => {
    if (!allActivities || allActivities.length < 3) return DURATION_CHIPS;
    const freq = {};
    allActivities.forEach(a => {
      if (!a.durationMin) return;
      // Round to nearest chip-friendly value (multiple of 5)
      const rounded = Math.round(a.durationMin / 5) * 5;
      if (rounded >= 10 && rounded <= 180) freq[rounded] = (freq[rounded] || 0) + 1;
    });
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v]) => parseInt(v)).sort((a, b) => a - b);
    if (sorted.length < 3) return DURATION_CHIPS;
    return sorted.map(v => ({
      label: v >= 60 ? (v % 60 === 0 ? `${v/60}h` : `${Math.floor(v/60)}h ${v%60}`) : `${v} min`,
      value: v,
    }));
  }, [allActivities]);

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

      {/* EDIT MODE BANNER */}
      {editId && (
        <div style={{ background:"linear-gradient(90deg,#FEF3C7,#FDE68A)",borderRadius:12,padding:"8px 14px",margin:"0 14px 10px",display:"flex",alignItems:"center",gap:8 }}>
          <span style={{ fontSize:14 }}>✏️</span>
          <span style={{ fontSize:12,fontWeight:700,color:"#92400E" }}>Stai modificando una sessione del {formatDateLabel(initial?.date)}</span>
        </div>
      )}

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
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            <button onClick={() => adjustKm(-1)} style={{ width:44,height:34,borderRadius:10,border:"none",background:"rgba(255,255,255,0.28)",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:800 }}>−1</button>
            <button onClick={() => adjustKm(-0.1)} style={{ width:44,height:34,borderRadius:10,border:"none",background:"rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.8)",cursor:"pointer",fontSize:13,fontWeight:700 }}>−0.1</button>
          </div>
          <div style={{ textAlign:"center" }}>
            {showKmInput ? (
              <input ref={kmInputRef} type="number" inputMode="decimal" step="0.1" min="0.1" max="99"
                defaultValue={parseFloat(km).toFixed(1)}
                onBlur={e => { const v = parseFloat(e.target.value); if (v > 0) setKm(v); setShowKmInput(false); }}
                onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
                autoFocus
                style={{ fontSize:52,fontWeight:900,lineHeight:1,width:120,textAlign:"center",border:"none",background:"rgba(255,255,255,0.15)",borderRadius:14,color:"#fff",outline:"none",fontFamily:"inherit",padding:"6px 0" }}/>
            ) : (
              <div onClick={() => setShowKmInput(true)} style={{ cursor:"pointer" }}>
                <div style={{ fontSize:56,fontWeight:900,lineHeight:1 }}>{parseFloat(km).toFixed(1)}</div>
                <div style={{ fontSize:12,fontWeight:800,opacity:0.9,marginTop:4 }}>KM</div>
              </div>
            )}
            {!showKmInput && <div style={{ fontSize:9,opacity:0.6,marginTop:2 }}>tocca per digitare</div>}
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            <button onClick={() => adjustKm(+1)} style={{ width:44,height:34,borderRadius:10,border:"none",background:"rgba(255,255,255,0.28)",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:800 }}>+1</button>
            <button onClick={() => adjustKm(+0.1)} style={{ width:44,height:34,borderRadius:10,border:"none",background:"rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.8)",cursor:"pointer",fontSize:13,fontWeight:700 }}>+0.1</button>
          </div>
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
          {dynamicChips.map(chip => (
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

      {/* Elimina sessione — solo in modalità modifica */}
      {editId && onDelete && (
        <button onClick={() => setShowDeleteConfirm(true)} style={{
          width:"calc(100% - 28px)",margin:"0 14px 24px",padding:14,borderRadius:16,
          border:"1.5px solid #FCA5A5",background:"#FEF2F2",color:"#DC2626",
          fontSize:14,fontWeight:700,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",gap:8,
        }}>
          <Trash2 size={16}/> Elimina sessione
        </button>
      )}

      {showDeleteConfirm && (
        <ConfirmModal
          title="Elimina sessione"
          message={`Vuoi eliminare la camminata di ${parseFloat(km).toFixed(1)} km del ${formatDateLabel(date)}? Questa azione non può essere annullata.`}
          confirmLabel="Elimina"
          onConfirm={() => { onDelete(editId); setShowDeleteConfirm(false); onBack(); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      <div style={{ height:80 }}/>
      <FitnessBottomNav onAdd={() => { onBack(); }} onNavigate={(section) => { if (onNavigateSection) onNavigateSection(section); else onBack(); }}/>
    </div>
  );
};

/* ═══════════════════════════════════════════
   SCREEN: MAIN — Opzione B (barra gradient, no ring)
   ═══════════════════════════════════════════ */
const MainScreen = ({ activities, weeklyGoal, onAdd, onDelete, onEdit, onEditGoal, onNavigate, onReport, onBadges }) => {
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

  // Streak
  const curStreak = useMemo(() => calcCurrentStreak(activities), [activities]);

  // Sparkline: km totali delle ultime 6 settimane
  const sparkData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const mon = new Date(getMondayISO());
      mon.setDate(mon.getDate() - (5 - i) * 7);
      const days = getWeekDays(toISO(mon));
      return parseFloat(days.reduce((s, iso) => s + activities.filter(a => a.date === iso).reduce((ss, a) => ss + a.distanceKm, 0), 0).toFixed(1));
    });
  }, [activities]);
  const sparkAvg = sparkData.length ? Math.round(sparkData.reduce((a, b) => a + b, 0) / sparkData.length * 10) / 10 : 0;

  // Recent badges
  const badgeStats = useMemo(() => calcBadgeStats(activities, weeklyGoal), [activities, weeklyGoal]);
  const unlockedBadges = useMemo(() => getUnlockedBadges(badgeStats), [badgeStats]);

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
            <div style={{ display:"flex",alignItems:"center",gap:8 }}>
              {/* Streak badge */}
              {curStreak > 0 ? (
                <div style={{
                  display:"flex",alignItems:"center",gap:4,
                  background:curStreak>=7?"linear-gradient(135deg,#F97316,#EF4444)":curStreak>=3?"linear-gradient(135deg,#FB923C,#F97316)":"#FED7AA",
                  padding:"4px 10px",borderRadius:10,
                  boxShadow:curStreak>=3?`0 2px 8px ${ORANGE}40`:"none",
                }}>
                  <span style={{ fontSize:12 }}>🔥</span>
                  <span style={{ fontSize:11,fontWeight:800,color:curStreak>=3?"#fff":"#9A3412" }}>{curStreak}</span>
                  <span style={{ fontSize:8,fontWeight:600,color:curStreak>=3?"rgba(255,255,255,0.85)":"#9A3412" }}>giorni</span>
                </div>
              ) : (
                <div style={{ display:"flex",alignItems:"center",gap:4,background:"#F3F4F6",padding:"4px 10px",borderRadius:10 }}>
                  <span style={{ fontSize:11,opacity:0.5 }}>🔥</span>
                  <span style={{ fontSize:9,fontWeight:600,color:T.textMuted }}>inizia oggi!</span>
                </div>
              )}
              {/* Trend */}
              <div style={{ display:"flex",alignItems:"center",gap:4 }}>
                {trendDiff >= 0
                  ? <TrendingUp size={12} color={GREEN}/>
                  : <TrendingDown size={12} color={T.coral}/>}
                <span style={{ fontSize:11,fontWeight:700,color:trendDiff>=0?GREEN:T.coral }}>
                  {trendDiff >= 0 ? "+" : ""}{trendDiff.toFixed(1)} km
                </span>
              </div>
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
              {`Mancano ${Math.max(0, weeklyGoal - weekTotal).toFixed(1)} km · ${Math.round(pct)}%`}
            </span>
            <span style={{ fontSize:10,color:T.textMuted }}>{weeklyGoal} km</span>
          </div>

          {/* Sparkline — trend ultime 6 settimane */}
          {sparkData.length >= 2 && (
            <div style={{ marginBottom:10 }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3 }}>
                <span style={{ fontSize:9,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:0.5 }}>Trend 6 settimane</span>
                <span style={{ fontSize:9,fontWeight:600,color:T.textMuted }}>media: {sparkAvg} km</span>
              </div>
              <Sparkline data={sparkData} height={36}/>
              <div style={{ display:"flex",justifyContent:"space-between",marginTop:1 }}>
                {sparkData.map((_, i) => (
                  <span key={i} style={{ fontSize:7,color:i===sparkData.length-1?T.teal:T.textMuted,fontWeight:i===sparkData.length-1?700:400 }}>
                    {i===sparkData.length-1?"Ora":`-${sparkData.length-1-i}w`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Grafico a barre con label km sopra */}
          <ResponsiveContainer width="100%" height={95}>
            <BarChart data={chart} barSize={22} margin={{ top:14,right:0,left:-28,bottom:0 }}>
              <XAxis dataKey="day" tick={{ fontSize:10,fill:T.textMuted,fontWeight:600 }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{ background:"rgba(0,0,0,.75)",border:"none",borderRadius:8,fontSize:11,color:"#fff" }} cursor={{ fill:`${T.teal}10` }} formatter={v=>[`${v} km`]}/>
              <Bar dataKey="km" radius={[5,5,0,0]} label={({ x, y, width, value }) =>
                value > 0 ? (
                  <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={9} fontWeight={700} fill={T.textSec}>
                    {value}
                  </text>
                ) : null
              }>
                {chart.map((d,i) => (
                  <Cell key={i} fill={d.iso===oggi?T.mint:d.km>0?T.teal:"#F0F0F0"}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Recent badges */}
          {unlockedBadges.length > 0 && (
            <div style={{ display:"flex",alignItems:"center",gap:6,paddingTop:10,borderTop:`1px solid ${T.border}` }}>
              <span style={{ fontSize:9,fontWeight:700,color:T.textMuted }}>Ultimi:</span>
              {unlockedBadges.slice(-3).reverse().map(b => (
                <div key={b.id} style={{ display:"flex",alignItems:"center",gap:4,background:`${T.gold}0D`,padding:"3px 8px",borderRadius:8 }}>
                  <span style={{ fontSize:12 }}>{b.emoji}</span>
                  <span style={{ fontSize:9,fontWeight:700,color:T.gold }}>{b.name}</span>
                </div>
              ))}
              <button onClick={onBadges} style={{ marginLeft:"auto",background:"none",border:"none",cursor:"pointer",fontSize:10,fontWeight:700,color:T.teal }}>
                Tutti →
              </button>
            </div>
          )}
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
              <SessionCard key={a.id} activity={a} onClick={onEdit}/>
            ))}
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
const ReportScreen = ({ activities, onBack, onNavigate, onAdd }) => {
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
        <div style={{ fontSize:20,fontWeight:800,color:T.text }}>Report</div>
      </div>

      <div style={{ padding:"0 16px" }}>

        {/* ── CARD UNICA: CONFRONTO + DETTAGLIO ── */}
        <div style={{ background:T.card,borderRadius:18,padding:16,boxShadow:T.shadow,marginBottom:12 }}>
          {/* Period toggle (segmented control) */}
          <div style={{ display:"flex",background:"#F3F4F6",borderRadius:10,padding:3,marginBottom:14 }}>
            {[["week","Settimanale"],["month","Mensile"]].map(([v,l]) => (
              <button key={v} onClick={() => setPeriod(v)} style={{
                flex:1,padding:"8px 0",borderRadius:8,border:"none",cursor:"pointer",
                background:period===v?T.card:"transparent",fontWeight:700,fontSize:12,
                color:period===v?T.text:T.textMuted,boxShadow:period===v?T.shadow:"none",transition:".2s",
              }}>{l}</button>
            ))}
          </div>

          {/* CONFRONTO (prima) */}
          {curr && prev && (
            <>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
                <div style={{ fontSize:12,fontWeight:700,color:T.text }}>Confronto</div>
                <div style={{ fontSize:10,color:T.textMuted,fontWeight:600 }}>{period==="week"?"Sett. vs Sett. prec.":`${curr.periodLabel} vs ${prev.periodLabel}`}</div>
              </div>
              <div style={{ display:"flex",gap:6,marginBottom:16 }}>
                {confrontoMetrics.map(m => {
                  const cV = curr[m.key] || 0, pV = prev[m.key] || 0;
                  const diff = cV - pV;
                  const pctC = pV > 0 ? Math.round((diff / pV) * 100) : 0;
                  const isUp = diff > 0;
                  const arrow = isUp ? "↑" : diff < 0 ? "↓" : "=";
                  const aC = m.inv ? (isUp ? T.coral : GREEN) : (isUp ? GREEN : T.coral);
                  return (
                    <div key={m.key} style={{ flex:1,background:`${m.color}0A`,borderRadius:12,padding:"8px 4px",textAlign:"center" }}>
                      <div style={{ fontSize:9,fontWeight:600,color:T.textMuted,marginBottom:3 }}>{m.label}</div>
                      <div style={{ fontSize:15,fontWeight:800,color:m.color }}>{m.key==="avgPace"&&cV>0?cV.toFixed(1):cV}</div>
                      <div style={{ fontSize:9,color:T.textMuted,marginTop:1 }}>vs {m.key==="avgPace"&&pV>0?pV.toFixed(1):pV}</div>
                      <div style={{ fontSize:10,fontWeight:700,color:diff===0?T.textMuted:aC,marginTop:3,
                        background:diff===0?"transparent":`${aC}14`,borderRadius:6,padding:"1px 4px",display:"inline-block"
                      }}>{arrow} {Math.abs(pctC)}%</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ height:1,background:T.border,marginBottom:14 }}/>
            </>
          )}

          {/* DETTAGLIO (dopo) */}
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
            <div style={{ fontSize:12,fontWeight:700,color:T.text }}>Dettaglio</div>
            <div style={{ display:"flex",gap:6 }}>
              {[["km","Km"],["kcal","Kcal"]].map(([v,l]) => (
                <button key={v} onClick={() => setChartMetric(v)} style={{
                  padding:"5px 14px",borderRadius:20,cursor:"pointer",fontWeight:700,fontSize:11,transition:".15s",
                  border:`1.5px solid ${chartMetric===v?T.teal:T.border}`,
                  background:chartMetric===v?`${T.teal}0D`:"transparent",
                  color:chartMetric===v?T.teal:T.textMuted,
                }}>{l}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={sliced} barSize={20} margin={{ top:14,right:0,left:-28,bottom:0 }}>
              <XAxis dataKey="label" tick={{ fontSize:9,fill:T.textMuted,fontWeight:600 }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{ background:"rgba(0,0,0,.75)",border:"none",borderRadius:8,fontSize:11,color:"#fff" }} cursor={{ fill:`${metricColor}10` }} formatter={v=>[`${v} ${metricUnit}`]}/>
              <Bar dataKey={chartMetric} radius={[5,5,0,0]} label={({ x, y, width: w, value }) =>
                value > 0 ? (
                  <text x={x + w / 2} y={y - 4} textAnchor="middle" fontSize={8} fontWeight={700} fill={metricColor}>
                    {value}
                  </text>
                ) : null
              }>
                {sliced.map((d,i) => (
                  <Cell key={i} fill={i === sliced.length - 1 ? T.mint : d[chartMetric] > 0 ? metricColor : "#F0F0F0"}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display:"flex",alignItems:"baseline",justifyContent:"center",gap:4,padding:"8px 0 0",borderTop:`1px solid ${T.border}` }}>
            <span style={{ fontSize:16,fontWeight:800,color:metricColor }}>{avg}</span>
            <span style={{ fontSize:10,color:T.textMuted }}>{metricUnit}/{period==="week"?"settimana":"mese"} media</span>
          </div>
        </div>

        {/* ── METRICHE TOTALI (compatta) ── */}
        <div style={{ background:T.card,borderRadius:18,padding:14,boxShadow:T.shadow,marginBottom:12 }}>
          <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:10 }}>🏆 Metriche Totali</div>
          <div style={{ display:"flex",gap:6,marginBottom:8 }}>
            {[
              { val: pr.totalKm.toFixed(1), label:"km totali", color:T.teal },
              { val: totalKcal >= 1000 ? `${(totalKcal/1000).toFixed(1)}k` : totalKcal, label:"kcal", color:ORANGE },
              { val: `${activities.length}`, label:"sessioni", color:T.purple },
              { val: formatTotalTime(pr.totalMin), label:"tempo", color:GREEN },
            ].map(({ val, label, color }) => (
              <div key={label} style={{ flex:1,background:`${color}0A`,borderRadius:12,padding:"10px 6px",textAlign:"center" }}>
                <div style={{ fontSize:22,fontWeight:900,color,lineHeight:1 }}>{val}</div>
                <div style={{ fontSize:9,color:T.textMuted,fontWeight:600,marginTop:3 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex",gap:6 }}>
            {[
              { emoji:"🏅", val: `${pr.maxDist.toFixed(1)} km`, label:"distanza max" },
              { emoji:"⚡", val: pr.bestPace < Infinity ? `${formatPace(pr.bestPace)}` : "—", label:"ritmo best" },
              { emoji:"🔥", val: `${pr.maxKcal}`, label:"kcal max" },
            ].map(({ emoji, val, label }) => (
              <div key={label} style={{ flex:1,background:`${T.gold}0A`,borderRadius:10,padding:"8px 10px",display:"flex",alignItems:"center",gap:6 }}>
                <span style={{ fontSize:14 }}>{emoji}</span>
                <div>
                  <div style={{ fontSize:12,fontWeight:800,color:T.gold }}>{val}</div>
                  <div style={{ fontSize:8,color:T.textMuted }}>{label}</div>
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

      <FitnessBottomNav onAdd={onAdd} onNavigate={onNavigate}/>
    </div>
  );
};

/* ═══════════════════════════════════════════
   SCREEN: BADGES (Traguardi)
   ═══════════════════════════════════════════ */
const BadgesScreen = ({ activities, weeklyGoal, onBack, onNavigate }) => {
  const stats = useMemo(() => calcBadgeStats(activities, weeklyGoal), [activities, weeklyGoal]);
  const unlocked = useMemo(() => getUnlockedBadges(stats), [stats]);
  const unlockedIds = useMemo(() => new Set(unlocked.map(b => b.id)), [unlocked]);
  const repeatCounts = useMemo(() => countRepeatableAchievements(activities, weeklyGoal), [activities, weeklyGoal]);
  const curStreak = useMemo(() => calcCurrentStreak(activities), [activities]);
  const maxSt = stats.maxStreak;

  // Prossimo streak badge
  const nextStreakBadge = BADGES.filter(b => b.category === "streak" && !unlockedIds.has(b.id))[0];

  // Progress per badge non sbloccati
  const getProgress = (b) => {
    if (b.category === "km") { const targets = [10,25,50,100,200,500,1000]; const t = targets.find(t => !unlockedIds.has(`total_${t}`)); return t ? { cur: Math.round(stats.totalKm), target: t } : null; }
    if (b.category === "dist") { const targets = [5,10,15]; const t = targets.find(t => !unlockedIds.has(`single_${t}`)); return t ? { cur: parseFloat(stats.maxDist.toFixed(1)), target: t } : null; }
    if (b.category === "kcal") { const targets = [500,800,1000]; const t = targets.find(t => !unlockedIds.has(`kcal_${t}`)); return t ? { cur: stats.maxKcal, target: t } : null; }
    if (b.category === "streak") { const targets = [3,7,14,30,60]; const t = targets.find(t => !unlockedIds.has(`streak_${t}`)); return t ? { cur: maxSt, target: t } : null; }
    if (b.category === "sess") { const targets = [10,25,50,100,200]; const t = targets.find(t => !unlockedIds.has(`sess_${t}`)); return t ? { cur: stats.totalSess, target: t } : null; }
    if (b.category === "goal") { const targets = [2,4,8,12]; const t = targets.find(t => !unlockedIds.has(`goal_${t}w`)); return t ? { cur: stats.goalStreak, target: t } : null; }
    if (b.category === "monthly") { return { cur: stats.daysThisMonth, target: b.id === "month_15d" ? 15 : 20 }; }
    if (b.category === "pace") { return stats.bestPace < Infinity ? { cur: stats.bestPace.toFixed(1), target: b.id === "pace_10" ? 10 : 8 } : null; }
    return null;
  };

  return (
    <div style={{ minHeight:"100vh",background:T.bg,fontFamily:"'Inter',-apple-system,sans-serif",paddingBottom:100 }}>
      <div style={{ position:"sticky",top:0,zIndex:10,background:T.bg,display:"flex",alignItems:"center",gap:12,padding:"16px 16px 12px" }}>
        <button onClick={onBack} style={{ width:36,height:36,borderRadius:12,background:T.tealLight,border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
          <ChevronLeft size={18} color={T.teal}/>
        </button>
        <div style={{ fontSize:20,fontWeight:800,color:T.text }}>Traguardi</div>
        <div style={{ marginLeft:"auto",fontSize:12,fontWeight:700,color:T.teal }}>{unlocked.length}/{BADGES.length}</div>
      </div>

      <div style={{ padding:"0 16px" }}>
        {/* Hero streak */}
        <div style={{ background:"linear-gradient(135deg,#F97316,#EF4444)",borderRadius:20,padding:20,marginBottom:16,color:"#fff",position:"relative",overflow:"hidden" }}>
          <div style={{ position:"absolute",top:-20,right:-20,fontSize:80,opacity:0.15 }}>🔥</div>
          <div style={{ fontSize:11,fontWeight:700,opacity:0.85,marginBottom:4 }}>STREAK ATTUALE</div>
          <div style={{ display:"flex",alignItems:"baseline",gap:6,marginBottom:8 }}>
            <span style={{ fontSize:48,fontWeight:900,letterSpacing:-2 }}>{curStreak}</span>
            <span style={{ fontSize:16,fontWeight:700,opacity:0.85 }}>giorni di fila</span>
          </div>
          <div style={{ display:"flex",gap:16 }}>
            <div><div style={{ fontSize:9,opacity:0.7 }}>Record</div><div style={{ fontSize:16,fontWeight:800 }}>{maxSt} giorni</div></div>
            {nextStreakBadge && <div><div style={{ fontSize:9,opacity:0.7 }}>Prossimo badge</div><div style={{ fontSize:16,fontWeight:800 }}>{nextStreakBadge.name} {nextStreakBadge.emoji}</div></div>}
          </div>
        </div>

        <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:12 }}>Tutti i traguardi</div>

        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
          {BADGES.map(b => {
            const isUnlocked = unlockedIds.has(b.id);
            const prog = !isUnlocked ? getProgress(b) : null;
            return (
              <div key={b.id} style={{
                background:isUnlocked?T.card:"#F9FAFB",borderRadius:16,padding:14,
                boxShadow:isUnlocked?T.shadow:"none",border:`1px solid ${isUnlocked?"transparent":T.border}`,
                opacity:isUnlocked?1:0.6,position:"relative",overflow:"hidden",
              }}>
                {isUnlocked && (
                  <div style={{ position:"absolute",top:0,right:0,background:b.repeatable && (repeatCounts[b.id]||0)>1 ? T.purple : GREEN,color:"#fff",fontSize:8,fontWeight:800,padding:"3px 8px",borderRadius:"0 0 0 10px" }}>
                    {b.repeatable && (repeatCounts[b.id]||0)>1 ? `×${repeatCounts[b.id]}` : "✓"}
                  </div>
                )}
                <div style={{ fontSize:28,marginBottom:6 }}>{b.emoji}</div>
                <div style={{ fontSize:12,fontWeight:800,color:T.text,marginBottom:2 }}>{b.name}</div>
                <div style={{ fontSize:9,color:T.textMuted,lineHeight:1.3 }}>{b.desc}</div>
                {isUnlocked && (
                  <div style={{ fontSize:9,color:T.teal,fontWeight:600,marginTop:6 }}>
                    {b.repeatable && (repeatCounts[b.id] || 0) > 1
                      ? `×${repeatCounts[b.id]}`
                      : "Sbloccato ✓"}
                  </div>
                )}
                {!isUnlocked && prog && (
                  <>
                    <div style={{ marginTop:6,height:4,background:"#E5E7EB",borderRadius:4,overflow:"hidden" }}>
                      <div style={{ width:`${Math.min(100,Math.round((parseFloat(prog.cur)/prog.target)*100))}%`,height:"100%",background:T.teal,borderRadius:4 }}/>
                    </div>
                    <div style={{ fontSize:8,color:T.textMuted,marginTop:2 }}>{prog.cur} / {prog.target}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <FitnessBottomNav onAdd={onBack} onNavigate={onNavigate}/>
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
  const [toast,         setToast]         = useState(null);
  const [badgeToast,    setBadgeToast]    = useState(null);
  const [prToast,       setPrToast]       = useState(null);
  const deletedRef = useRef(null);
  const toastQueueRef = useRef([]);

  const today = useMemo(() => todayISO(), []);

  const loadData = useCallback(async () => {
    const [goal, profile, last] = await Promise.all([
      getWeeklyGoalKm(), getNutritionGoals(), getLastFitnessActivity(),
    ]);
    if (goal)    setWeeklyGoal(goal);
    if (profile) setUserProfile(profile);
    if (last)    setLastSession(last);
    const end   = today;
    const start = toISO(new Date(Date.now() - 120 * 86400000));
    const acts  = await getFitnessActivitiesByDateRange(start, end);
    setActivities(acts.sort((a, b) => b.date.localeCompare(a.date)));
  }, [today]);

  useEffect(() => { loadData(); }, [loadData]);

  const showToast = useCallback((msg, icon, action, onAction) => {
    setToast({ message: msg, icon, action, onAction });
  }, []);

  // Queued notification system: save toast → PR toast → badge toast (most rare only)
  const playNotificationQueue = useCallback((queue) => {
    if (!queue.length) return;
    const [first, ...rest] = queue;
    if (first.type === "toast") {
      showToast(first.msg, first.icon);
    } else if (first.type === "pr") {
      setPrToast({ message: first.msg, icon: first.icon });
    } else if (first.type === "badge") {
      setBadgeToast(first.badge);
    }
    if (rest.length > 0) {
      const delay = first.type === "badge" ? 5000 : first.type === "pr" ? 4500 : 3500;
      setTimeout(() => playNotificationQueue(rest), delay);
    }
  }, [showToast]);

  const checkNewPR = useCallback((newAct, prevActs) => {
    if (!prevActs.length) return null;
    const pr = calcPR(prevActs);
    if (newAct.distanceKm > pr.maxDist) return { icon: "🏆", msg: `Distanza record: ${newAct.distanceKm.toFixed(1)} km!` };
    if (newAct.paceMinKm && newAct.paceMinKm < pr.bestPace) return { icon: "⚡", msg: `Ritmo record: ${formatPace(newAct.paceMinKm)}/km!` };
    if (newAct.kcal && newAct.kcal > pr.maxKcal) return { icon: "🔥", msg: `Kcal record: ${newAct.kcal} kcal!` };
    return null;
  }, []);

  const handleSaveNew = useCallback(async (act) => {
    // Snapshot stats BEFORE saving
    const statsBefore = calcBadgeStats(activities, weeklyGoal);
    const repeatCountsBefore = countRepeatableAchievements(activities, weeklyGoal);

    const prResult = checkNewPR(act, activities);
    await addFitnessActivity(act);
    await loadData();
    setSubScreen("main");

    // Build notification queue
    const queue = [];
    queue.push({ type: "toast", msg: "Camminata salvata!", icon: "✅" });

    if (prResult) {
      queue.push({ type: "pr", msg: prResult.msg, icon: prResult.icon });
    }

    // Check newly unlocked badges
    // We need to simulate the "after" stats since loadData is async
    const fakeAfterActs = [...activities, { ...act, id: "temp" }];
    const statsAfter = calcBadgeStats(fakeAfterActs, weeklyGoal);
    const repeatCountsAfter = countRepeatableAchievements(fakeAfterActs, weeklyGoal);
    const newBadges = getNewlyUnlocked(statsBefore, statsAfter, repeatCountsBefore, repeatCountsAfter);
    if (newBadges.length > 0) {
      // Pick the rarest (highest tier) badge to show
      const best = newBadges.sort((a, b) => b.tier - a.tier)[0];
      queue.push({ type: "badge", badge: best });
    }

    setTimeout(() => playNotificationQueue(queue), 400);
  }, [activities, weeklyGoal, checkNewPR, loadData, playNotificationQueue]);

  const handleSaveEdit = useCallback(async (act) => {
    if (!editTarget?.id) return;
    await updateFitnessActivity(editTarget.id, act);
    await loadData();
    setEditTarget(null);
    setSubScreen("main");
    showToast("Sessione aggiornata", "✏️");
  }, [editTarget, loadData, showToast]);

  const handleDelete = useCallback(async (id) => {
    const deleted = activities.find(a => a.id === id);
    deletedRef.current = deleted;
    await deleteFitnessActivity(id);
    await loadData();
    showToast(
      `Sessione di ${deleted?.distanceKm?.toFixed(1) || "?"} km eliminata`,
      "🗑️",
      "Annulla",
      async () => {
        if (deletedRef.current) {
          await addFitnessActivity({
            date: deletedRef.current.date,
            distanceKm: deletedRef.current.distanceKm,
            durationMin: deletedRef.current.durationMin,
            paceMinKm: deletedRef.current.paceMinKm,
            kcal: deletedRef.current.kcal,
            heartRate: deletedRef.current.heartRate,
            slope: deletedRef.current.slope,
          });
          deletedRef.current = null;
          await loadData();
          showToast("Sessione ripristinata!", "↩️");
        }
      }
    );
  }, [activities, loadData, showToast]);

  const handleSaveGoal = useCallback(async (km) => {
    await saveWeeklyGoalKm(km);
    setWeeklyGoal(km);
    showToast(`Obiettivo aggiornato: ${km} km/settimana`, "🎯");
  }, [showToast]);

  const openEdit = useCallback((act) => {
    setEditTarget(act);
    setSubScreen("editWalk");
  }, []);

  const openAddWalk = useCallback(() => {
    setSubScreen("addWalk");
  }, []);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [subScreen]);

  const handleNavigate = useCallback((section) => {
    setEditTarget(null);
    setSubScreen("main");
    window.scrollTo({ top: 0, behavior: "smooth" });
    onNavigate(section);
  }, [onNavigate]);

  const defaultInitial = useMemo(() => ({
    distanceKm:  lastSession?.distanceKm  ?? 5.0,
    durationMin: lastSession?.durationMin  ?? 50,
    heartRate:   lastSession?.heartRate    ?? 0,
    slope:       lastSession?.slope        ?? 0,
  }), [lastSession]);

  // Toast elements
  const toastEl = toast && (
    <Toast key={"t"+Date.now()} message={toast.message} icon={toast.icon}
      action={toast.action} onAction={toast.onAction}
      onDismiss={() => setToast(null)}/>
  );
  const badgeToastEl = badgeToast && (
    <BadgeToast key={"b"+Date.now()} badge={badgeToast} onDismiss={() => setBadgeToast(null)}/>
  );
  const prToastEl = prToast && (
    <PRToast key={"p"+Date.now()} message={prToast.message} icon={prToast.icon} onDismiss={() => setPrToast(null)}/>
  );
  const allToasts = <>{toastEl}{badgeToastEl}{prToastEl}</>;

  if (subScreen === "addWalk") return (
    <>
      <WalkForm title="Nuova camminata" initial={defaultInitial} userProfile={userProfile}
        onSave={handleSaveNew} onBack={() => setSubScreen("main")}
        onNavigateSection={handleNavigate} allActivities={activities}/>
      {showGoalModal && <GoalModal current={weeklyGoal} onSave={handleSaveGoal} onClose={() => setShowGoalModal(false)}/>}
      {allToasts}
    </>
  );

  if (subScreen === "editWalk") return (
    <>
      <WalkForm title="Modifica camminata" initial={editTarget} userProfile={userProfile}
        onSave={handleSaveEdit} onBack={() => { setEditTarget(null); setSubScreen("main"); }}
        onDelete={handleDelete} editId={editTarget?.id}
        onNavigateSection={handleNavigate} allActivities={activities}/>
      {showGoalModal && <GoalModal current={weeklyGoal} onSave={handleSaveGoal} onClose={() => setShowGoalModal(false)}/>}
      {allToasts}
    </>
  );

  if (subScreen === "report") return (
    <>
      <ReportScreen activities={activities} onBack={() => setSubScreen("main")} onNavigate={handleNavigate} onAdd={openAddWalk}/>
      {allToasts}
    </>
  );

  if (subScreen === "badges") return (
    <>
      <BadgesScreen activities={activities} weeklyGoal={weeklyGoal}
        onBack={() => setSubScreen("main")} onNavigate={handleNavigate}/>
      {allToasts}
    </>
  );

  return (
    <>
      <MainScreen activities={activities} weeklyGoal={weeklyGoal}
        onAdd={openAddWalk} onDelete={handleDelete} onEdit={openEdit}
        onEditGoal={() => setShowGoalModal(true)} onNavigate={handleNavigate}
        onReport={() => setSubScreen("report")} onBadges={() => setSubScreen("badges")}/>
      {showGoalModal && <GoalModal current={weeklyGoal} onSave={handleSaveGoal} onClose={() => setShowGoalModal(false)}/>}
      {allToasts}
    </>
  );
}
