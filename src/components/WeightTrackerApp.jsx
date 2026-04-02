import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  Sparkles, Trophy, CheckCircle2, Info
} from "lucide-react";

/* ═══════════════════════════════════════════
   UTILITIES & ALGORITHMS
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
  if (!weight || 
!heightCm) return null;
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
  const daysToMonday 
= dayOfWeek === 0 ? 6 : dayOfWeek - 1;
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
      {d.trend != null && <div style={{ fontSize: 
12, color: T.teal, fontWeight: 600 }}>Trend: {d.trend} kg</div>}
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
   ══════════════════════════════════════════ */

const BottomNav = ({ active, onNavigate, onAdd }) => {
  const tabs = [
    { id: "dashboard", icon: Home, label: "Home" },
    { id: "food", icon: Utensils, label: "Cibo" },
    { id: "add", icon: Plus, label: "" },
    { id: "fitness", icon: Dumbbell, label: "Fitness" },
    { id: "profile", icon: User, label: "Profilo" },
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
   MAIN APP
   ═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   FOOD TRACKING – CONSTANTS & DATABASE
   ═══════════════════════════════════════════════════════════════ */

const FOOD_GOAL_DEFAULT = { kcal: 1900, p: 150, c: 200, g: 65 };

const FOOD_MEALS = [
  { id: "colazione", label: "Colazione", emoji: "☀️", color: "#FEF9C3", textColor: "#92400E" },
  { id: "pranzo",    label: "Pranzo",    emoji: "🌿", color: "#DCFCE7", textColor: "#166534" },
  { id: "cena",      label: "Cena",      emoji: "🌙", color: "#EDE9FE", textColor: "#5B21B6" },
  { id: "spuntini",  label: "Spuntini",  emoji: "🍎", color: "#FEE2E2", textColor: "#991B1B" },
];

const FOOD_DB = [
  { name: "Petto di pollo",    detail: "per 100g",        kcal: 165, p: 31, c: 0,  g: 4  },
  { name: "Pasta integrale",   detail: "per 100g cruda",  kcal: 350, p: 13, c: 68, g: 2  },
  { name: "Riso basmati",      detail: "per 100g crudo",  kcal: 360, p: 7,  c: 79, g: 1  },
  { name: "Yogurt greco 0%",   detail: "per 100g",        kcal: 59,  p: 10, c: 4,  g: 0  },
  { name: "Uova intere",       detail: "per 100g",        kcal: 155, p: 13, c: 1,  g: 11 },
  { name: "Salmone",           detail: "per 100g",        kcal: 208, p: 20, c: 0,  g: 13 },
  { name: "Avena fiocchi",     detail: "per 100g",        kcal: 370, p: 13, c: 60, g: 7  },
  { name: "Banana",            detail: "per 100g",        kcal: 89,  p: 1,  c: 23, g: 0  },
  { name: "Mandorle",          detail: "per 100g",        kcal: 579, p: 21, c: 22, g: 50 },
  { name: "Olio extravergine", detail: "per 100g",        kcal: 884, p: 0,  c: 0,  g: 100},
  { name: "Proteine whey",     detail: "per 100g",        kcal: 400, p: 80, c: 10, g: 4  },
  { name: "Mela",              detail: "per 100g",        kcal: 52,  p: 0,  c: 14, g: 0  },
  { name: "Mozzarella",        detail: "per 100g",        kcal: 280, p: 18, c: 2,  g: 22 },
  { name: "Pane integrale",    detail: "per 100g",        kcal: 241, p: 9,  c: 41, g: 3  },
  { name: "Lenticchie cotte",  detail: "per 100g",        kcal: 116, p: 9,  c: 20, g: 0  },
  { name: "Ricotta",           detail: "per 100g",        kcal: 146, p: 11, c: 3,  g: 10 },
  { name: "Tonno al naturale", detail: "per 100g",        kcal: 108, p: 24, c: 0,  g: 1  },
  { name: "Miele",             detail: "per 100g",        kcal: 304, p: 0,  c: 82, g: 0  },
  { name: "Latte p. scremato", detail: "per 100g",        kcal: 36,  p: 3,  c: 5,  g: 1  },
  { name: "Broccoli",          detail: "per 100g cotti",  kcal: 35,  p: 3,  c: 6,  g: 0  },
  { name: "Ceci cotti",        detail: "per 100g",        kcal: 164, p: 9,  c: 27, g: 3  },
  { name: "Burro di arachidi", detail: "per 100g",        kcal: 588, p: 25, c: 20, g: 50 },
  { name: "Petto di tacchino", detail: "per 100g",        kcal: 135, p: 30, c: 0,  g: 1  },
  { name: "Quinoa cotta",      detail: "per 100g",        kcal: 120, p: 4,  c: 22, g: 2  },
  { name: "Patate bollite",    detail: "per 100g",        kcal: 86,  p: 2,  c: 20, g: 0  },
  { name: "Grana Padano",      detail: "per 100g",        kcal: 384, p: 33, c: 0,  g: 28 },
  { name: "Fagioli borlotti",  detail: "per 100g cotti",  kcal: 125, p: 8,  c: 23, g: 0  },
  { name: "Spinaci cotti",     detail: "per 100g",        kcal: 23,  p: 3,  c: 4,  g: 0  },
  { name: "Pomodori",          detail: "per 100g",        kcal: 18,  p: 1,  c: 4,  g: 0  },
  { name: "Avocado",           detail: "per 100g",        kcal: 160, p: 2,  c: 9,  g: 15 },
  { name: "Fragole",           detail: "per 100g",        kcal: 32,  p: 1,  c: 8,  g: 0  },
  { name: "Pane bianco",       detail: "per 100g",        kcal: 265, p: 9,  c: 49, g: 3  },
  { name: "Pecorino",          detail: "per 100g",        kcal: 395, p: 26, c: 0,  g: 32 },
  { name: "Merluzzo",          detail: "per 100g",        kcal: 82,  p: 18, c: 0,  g: 1  },
  { name: "Bistecca di manzo", detail: "per 100g",        kcal: 217, p: 26, c: 0,  g: 12 },
  { name: "Hummus",            detail: "per 100g",        kcal: 166, p: 8,  c: 14, g: 10 },
  { name: "Kiwi",              detail: "per 100g",        kcal: 61,  p: 1,  c: 15, g: 1  },
  { name: "Fiocchi di latte",  detail: "per 100g",        kcal: 72,  p: 12, c: 2,  g: 1  },
  { name: "Cracker integrali", detail: "per 100g",        kcal: 427, p: 9,  c: 68, g: 13 },
  { name: "Caffè espresso",    detail: "per 100ml",       kcal: 2,   p: 0,  c: 0,  g: 0  },
];

const scaleN = (val, grams) => Math.round(val * grams / 100);

function getFoodDay(data, dateISO) {
  if (!data[dateISO]) {
    return {
      colazione: { kcal: 0, p: 0, c: 0, g: 0, items: [] },
      pranzo:    { kcal: 0, p: 0, c: 0, g: 0, items: [] },
      cena:      { kcal: 0, p: 0, c: 0, g: 0, items: [] },
      spuntini:  { kcal: 0, p: 0, c: 0, g: 0, items: [] },
    };
  }
  return data[dateISO];
}

function getDateISO(offsetFromToday = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetFromToday);
  return d.toISOString().split("T")[0];
}

/* ─── BARCODE SCANNER COMPONENT ─── */
function BarcodeScanner({ onFound, onClose }) {
  const videoRef = useRef(null);
  const [scanError, setScanError] = useState(null);
  const [scanStatus, setScanStatus] = useState("Inizializzazione fotocamera…");
  const streamRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function startScan() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (!("BarcodeDetector" in window)) {
          setScanError("BarcodeDetector non supportato su questo browser. Usa la ricerca manuale.");
          return;
        }

        const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
        setScanStatus("Punta il codice a barre verso la fotocamera");

        async function detect() {
          if (!mounted || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              const barcode = codes[0].rawValue;
              setScanStatus("Codice trovato! Ricerca in corso…");
              try {
                const resp = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
                const data = await resp.json();
                if (data.status === 1) {
                  const pr = data.product;
                  const n = pr.nutriments || {};
                  const kcalPer100 = Math.round(
                    n["energy-kcal_100g"] ||
                    (n["energy_100g"] ? n["energy_100g"] / 4.184 : 0)
                  );
                  const food = {
                    name: pr.product_name || pr.abbreviated_product_name || "Prodotto",
                    detail: `per 100g · barcode ${barcode}`,
                    kcal: kcalPer100,
                    p: Math.round(n.proteins_100g || 0),
                    c: Math.round(n.carbohydrates_100g || 0),
                    g: Math.round(n.fat_100g || 0),
                  };
                  onFound(food);
                  return;
                } else {
                  setScanStatus("Prodotto non trovato. Inquadra un altro codice.");
                }
              } catch {
                setScanStatus("Errore di rete. Riprova.");
              }
            }
          } catch {}
          if (mounted) animRef.current = requestAnimationFrame(detect);
        }
        detect();
      } catch (err) {
        if (mounted) setScanError("Fotocamera non disponibile: " + err.message);
      }
    }
    startScan();
    return () => {
      mounted = false;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000", zIndex: 300,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    }}>
      {!scanError && (
        <video ref={videoRef} playsInline muted style={{
          width: "100%", maxWidth: 390, height: "100vh", objectFit: "cover", opacity: 0.9,
        }} />
      )}
      {/* Overlay UI */}
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: 32,
      }}>
        {scanError ? (
          <div style={{
            background: "rgba(0,0,0,0.8)", borderRadius: 18, padding: "24px 20px",
            textAlign: "center", maxWidth: 300,
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📷</div>
            <div style={{ color: "#fff", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>{scanError}</div>
            <button onClick={onClose} style={{
              padding: "12px 24px", borderRadius: 14, border: "none",
              background: T.teal, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>Chiudi</button>
          </div>
        ) : (
          <>
            {/* Viewfinder box */}
            <div style={{
              width: 260, height: 160, borderRadius: 16, border: "3px solid rgba(255,255,255,0.9)",
              position: "relative", boxShadow: "0 0 0 2000px rgba(0,0,0,0.55)",
            }}>
              {/* Corners */}
              {[["0","0","30px","0px","0","30px"],["0","auto","30px","30px","0","0"],["auto","0","0","30px","30px","30px"],["auto","auto","0","0px","30px","0"]].map((c,i)=>(
                <div key={i} style={{
                  position:"absolute", top:c[0], bottom:c[1], left:c[2], right:c[3],
                  width:22,height:22,border:`3px solid ${T.teal}`,borderRadius:c[4],
                  borderTopWidth:i>1?0:"3px",borderBottomWidth:i<2?0:"3px",
                  borderLeftWidth:(i===1||i===3)?0:"3px",borderRightWidth:(i===0||i===2)?0:"3px",
                }}/>
              ))}
            </div>
            <div style={{
              marginTop: 24, background: "rgba(0,0,0,0.65)", borderRadius: 12,
              padding: "10px 20px", textAlign: "center",
            }}>
              <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{scanStatus}</div>
            </div>
          </>
        )}
        <button onClick={onClose} style={{
          position: "absolute", top: 24, right: 20,
          width: 40, height: 40, borderRadius: 20, border: "none",
          background: "rgba(255,255,255,0.2)", color: "#fff",
          fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}>✕</button>
      </div>
    </div>
  );
}

/* ─── FOOD SCREEN ─── */
function FoodScreen({ onNavigate, settings }) {
  const [dayOffset, setDayOffset] = useState(0);
  const [foodData, setFoodData] = useState(() => {
    try { return JSON.parse(localStorage.getItem("foodData") || "{}"); } catch { return {}; }
  });
  const [savedMeals, setSavedMeals] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("savedMeals") || "null");
      return stored || [
        { name: "Colazione classica", foods: [
            { name: "Yogurt greco 0%", kcal: 118, p: 20, c: 8, g: 0, grams: 200 },
            { name: "Avena fiocchi",   kcal: 148, p: 5,  c: 24, g: 3, grams: 40 },
            { name: "Banana",          kcal: 89,  p: 1,  c: 23, g: 0, grams: 100 },
        ]},
        { name: "Pranzo fit", foods: [
            { name: "Petto di pollo",  kcal: 165, p: 31, c: 0, g: 4,  grams: 100 },
            { name: "Riso basmati",    kcal: 144, p: 3,  c: 32, g: 0, grams: 40  },
            { name: "Broccoli",        kcal: 35,  p: 3,  c: 6,  g: 0, grams: 100 },
        ]},
        { name: "Post-workout", foods: [
            { name: "Proteine whey",   kcal: 120, p: 24, c: 3, g: 1, grams: 30  },
            { name: "Banana",          kcal: 89,  p: 1,  c: 23, g: 0, grams: 100 },
        ]},
      ];
    } catch { return []; }
  });
  const foodGoal = { kcal: 1900, p: 150, c: 200, g: 65 };

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMeal, setSearchMeal] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTab, setSearchTab] = useState("alimenti");
  const [selectedItems, setSelectedItems] = useState([]);
  const [currentList, setCurrentList] = useState([]);

  // Gram editor state
  const [gramOpen, setGramOpen] = useState(false);
  const [gramFood, setGramFood] = useState(null);
  const [gramValue, setGramValue] = useState("100");
  const [gramSelIdx, setGramSelIdx] = useState(-1);   // index in selectedItems (-1 = new)
  const [gramEditMeal, setGramEditMeal] = useState(null);
  const [gramEditItemIdx, setGramEditItemIdx] = useState(null); // null = not editing existing

  // Save meal state
  const [saveOpen, setSaveOpen] = useState(false);
  const [savingMeal, setSavingMeal] = useState(null);
  const [saveName, setSaveName] = useState("");

  // Expanded meals
  const [expanded, setExpanded] = useState({});

  // Barcode scanner
  const [scanOpen, setScanOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastRef = useRef(null);

  // Persist food data
  useEffect(() => {
    try { localStorage.setItem("foodData", JSON.stringify(foodData)); } catch {}
  }, [foodData]);
  useEffect(() => {
    try { localStorage.setItem("savedMeals", JSON.stringify(savedMeals)); } catch {}
  }, [savedMeals]);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2500);
  }

  // ── Date helpers ──
  const dateISO = getDateISO(dayOffset);
  const dayDisplay = (() => {
    const dNames = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
    const mNames = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
    const d = new Date(); d.setDate(d.getDate() + dayOffset);
    return `${dNames[d.getDay()]} ${d.getDate()} ${mNames[d.getMonth()]}`;
  })();
  const todayLabel = dayOffset === 0 ? "Oggi" : dayOffset === -1 ? "Ieri" : dayOffset === 1 ? "Domani" : dayDisplay;

  // ── Day data ──
  const day = getFoodDay(foodData, dateISO);
  const totalKcal = FOOD_MEALS.reduce((s, m) => s + (day[m.id]?.kcal || 0), 0);
  const totalP    = FOOD_MEALS.reduce((s, m) => s + (day[m.id]?.p    || 0), 0);
  const totalC    = FOOD_MEALS.reduce((s, m) => s + (day[m.id]?.c    || 0), 0);
  const totalG    = FOOD_MEALS.reduce((s, m) => s + (day[m.id]?.g    || 0), 0);
  const kcalPct   = Math.min(totalKcal / foodGoal.kcal, 1);
  const ringCirc  = 2 * Math.PI * 36; // r=36

  // ── Search / filter logic ──
  const getFilteredList = (q) => {
    if (!q.trim()) {
      if (searchMeal) {
        const recentNames = (day[searchMeal]?.items || []).map(i => i.name);
        const recent = FOOD_DB.filter(f => recentNames.includes(f.name));
        return recent.length ? recent : FOOD_DB.slice(0, 8);
      }
      return FOOD_DB.slice(0, 8);
    }
    return FOOD_DB.filter(f => f.name.toLowerCase().includes(q.toLowerCase()));
  };

  useEffect(() => {
    setCurrentList(getFilteredList(searchQuery));
  }, [searchQuery, searchMeal, searchOpen, foodData, dateISO]);

  // ── Open search ──
  function openSearch(meal) {
    setSearchMeal(meal);
    setSelectedItems([]);
    setSearchQuery("");
    setSearchTab("alimenti");
    setSearchOpen(true);
  }

  function closeSearch() {
    setSearchOpen(false);
    setSelectedItems([]);
  }

  // ── Toggle meal expand ──
  function toggleMeal(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // ── Select/deselect food ──
  function toggleSelect(food) {
    setSelectedItems(prev => {
      const idx = prev.findIndex(s => s.food.name === food.name);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return [...prev, { food, grams: 100 }];
    });
  }

  // ── Gram editor (from search list) ──
  function openGramFromSearch(food) {
    const selIdx = selectedItems.findIndex(s => s.food.name === food.name);
    const g = selIdx >= 0 ? selectedItems[selIdx].grams : 100;
    setGramFood(food);
    setGramValue(String(g));
    setGramSelIdx(selIdx);
    setGramEditMeal(null);
    setGramEditItemIdx(null);
    setGramOpen(true);
  }

  // ── Gram editor (edit existing logged food) ──
  function openGramEdit(mealId, itemIdx) {
    const item = day[mealId].items[itemIdx];
    const dbFood = FOOD_DB.find(f => f.name === item.name) || {
      name: item.name,
      kcal: item.grams > 0 ? Math.round(item.kcal / item.grams * 100) : item.kcal,
      p:    item.grams > 0 ? Math.round(item.p    / item.grams * 100) : item.p,
      c:    item.grams > 0 ? Math.round(item.c    / item.grams * 100) : item.c,
      g:    item.grams > 0 ? Math.round(item.g    / item.grams * 100) : item.g,
      detail: "per 100g",
    };
    setGramFood(dbFood);
    setGramValue(String(item.grams));
    setGramSelIdx(-1);
    setGramEditMeal(mealId);
    setGramEditItemIdx(itemIdx);
    setGramOpen(true);
  }

  function confirmGram() {
    const g = Math.max(1, parseInt(gramValue) || 100);
    if (gramEditMeal !== null && gramEditItemIdx !== null) {
      // Edit existing logged item
      setFoodData(prev => {
        const newData = JSON.parse(JSON.stringify(prev));
        if (!newData[dateISO]) newData[dateISO] = getFoodDay(prev, dateISO);
        const md = newData[dateISO][gramEditMeal];
        const old = md.items[gramEditItemIdx];
        md.kcal -= old.kcal; md.p -= old.p; md.c -= old.c; md.g -= old.g;
        const newItem = { name: old.name, grams: g, kcal: scaleN(gramFood.kcal, g), p: scaleN(gramFood.p, g), c: scaleN(gramFood.c, g), g: scaleN(gramFood.g, g) };
        md.items[gramEditItemIdx] = newItem;
        md.kcal += newItem.kcal; md.p += newItem.p; md.c += newItem.c; md.g += newItem.g;
        return newData;
      });
      showToast("✅ " + gramFood.name + " aggiornato");
    } else {
      // Update selectedItems
      setSelectedItems(prev => {
        if (gramSelIdx >= 0) {
          const updated = [...prev];
          updated[gramSelIdx] = { ...updated[gramSelIdx], grams: g };
          return updated;
        }
        // Add new
        const existing = prev.findIndex(s => s.food.name === gramFood.name);
        if (existing >= 0) {
          const updated = [...prev]; updated[existing] = { food: gramFood, grams: g }; return updated;
        }
        return [...prev, { food: gramFood, grams: g }];
      });
    }
    setGramOpen(false);
  }

  // ── Confirm add ──
  function confirmAdd() {
    if (!selectedItems.length) { showToast("⚠️ Seleziona almeno un alimento"); return; }
    if (!searchMeal) { showToast("⚠️ Seleziona un pasto (chips in alto)"); return; }
    setFoodData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      if (!newData[dateISO]) newData[dateISO] = getFoodDay(prev, dateISO);
      const md = newData[dateISO][searchMeal];
      selectedItems.forEach(({ food, grams }) => {
        const item = { name: food.name, grams, kcal: scaleN(food.kcal, grams), p: scaleN(food.p, grams), c: scaleN(food.c, grams), g: scaleN(food.g, grams) };
        md.kcal += item.kcal; md.p += item.p; md.c += item.c; md.g += item.g;
        md.items.push(item);
      });
      return newData;
    });
    setExpanded(prev => ({ ...prev, [searchMeal]: true }));
    const n = selectedItems.length;
    showToast("✅ " + n + " aliment" + (n > 1 ? "i aggiunti" : "e aggiunto"));
    closeSearch();
  }

  // ── Remove logged food ──
  function removeItem(mealId, itemIdx) {
    setFoodData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      if (!newData[dateISO]) return prev;
      const md = newData[dateISO][mealId];
      const item = md.items[itemIdx];
      md.kcal -= item.kcal; md.p -= item.p; md.c -= item.c; md.g -= item.g;
      md.items.splice(itemIdx, 1);
      return newData;
    });
  }

  // ── Use saved meal ──
  function useSaved(smIdx) {
    if (!searchMeal) { showToast("⚠️ Seleziona prima un pasto (chips in alto)"); return; }
    const sm = savedMeals[smIdx];
    setFoodData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      if (!newData[dateISO]) newData[dateISO] = getFoodDay(prev, dateISO);
      const md = newData[dateISO][searchMeal];
      sm.foods.forEach(f => {
        md.kcal += f.kcal; md.p += f.p; md.c += f.c; md.g += f.g;
        md.items.push({ ...f });
      });
      return newData;
    });
    setExpanded(prev => ({ ...prev, [searchMeal]: true }));
    showToast("✅ \"" + sm.name + "\" aggiunto a " + searchMeal);
    closeSearch();
  }

  // ── Save meal ──
  function confirmSave() {
    if (!saveName.trim()) { showToast("⚠️ Dai un nome al pasto"); return; }
    const md = day[savingMeal];
    setSavedMeals(prev => [...prev, { name: saveName.trim(), foods: md.items.map(i => ({ ...i })) }]);
    setSaveOpen(false);
    showToast("⭐ Pasto \"" + saveName.trim() + "\" salvato!");
    setSaveName("");
  }

  // ── Barcode found ──
  function onBarcodeFound(food) {
    setScanOpen(false);
    // Check if already in DB, if not add temporarily
    const inDB = FOOD_DB.find(f => f.name === food.name);
    if (!inDB) FOOD_DB.unshift(food);
    openSearch(null);
    // Auto-select the found food
    setTimeout(() => {
      setSelectedItems([{ food, grams: 100 }]);
      setSearchQuery(food.name.split(" ")[0]);
    }, 100);
    showToast("📦 " + food.name + " trovato!");
  }

  // ── Gram preview ──
  const gramG = Math.max(1, parseInt(gramValue) || 0);
  const gramPreview = gramFood ? {
    kcal: scaleN(gramFood.kcal, gramG),
    p:    scaleN(gramFood.p,    gramG),
    c:    scaleN(gramFood.c,    gramG),
    g:    scaleN(gramFood.g,    gramG),
  } : null;

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif", paddingBottom: 100 }}>

      {/* ── HEADER ── */}
      <div style={{ padding: "16px 20px 10px", background: T.bg, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginBottom: 2 }}>{dayDisplay}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.text, letterSpacing: -0.5 }}>Diario 🥗</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button onClick={() => setDayOffset(d => d - 1)} style={{
              width: 32, height: 32, borderRadius: 10, background: T.card, border: "none", cursor: "pointer",
              fontSize: 18, color: T.teal, fontWeight: 700, boxShadow: T.shadow,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>‹</button>
            <div style={{
              padding: "5px 12px", borderRadius: 10, background: T.tealLight,
              fontSize: 11, fontWeight: 700, color: T.teal,
            }}>{todayLabel}</div>
            <button onClick={() => setDayOffset(d => d + 1)} style={{
              width: 32, height: 32, borderRadius: 10, background: T.card, border: "none", cursor: "pointer",
              fontSize: 18, color: T.teal, fontWeight: 700, boxShadow: T.shadow,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>›</button>
          </div>
        </div>
      </div>

      {/* ── SUMMARY CARD ── */}
      <div style={{ margin: "0 16px 12px", background: T.gradient, borderRadius: 22, padding: "18px 20px 16px", boxShadow: "0 8px 32px rgba(2,128,144,.22)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* Ring */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <svg width="86" height="86" style={{ transform: "rotate(-90deg)", display: "block" }}>
              <circle cx="43" cy="43" r="36" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="7" />
              <circle cx="43" cy="43" r="36" fill="none" stroke="#fff" strokeWidth="7"
                strokeDasharray={ringCirc} strokeDashoffset={ringCirc * (1 - kcalPct)}
                strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.7s ease" }} />
            </svg>
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{totalKcal}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,.72)", fontWeight: 700, marginTop: 2 }}>kcal</div>
            </div>
          </div>

          {/* Stats + Macro bars */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              {[
                { label: "Obiettivo", val: foodGoal.kcal },
                { label: "Rimanenti", val: Math.max(0, foodGoal.kcal - totalKcal) },
              ].flatMap((s, i) => {
                const els = [];
                if (i === 1) els.push(<div key={"div"+i} style={{ width: 1, background: "rgba(255,255,255,0.18)" }} />);
                els.push(<div key={"s"+i} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>{s.val}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,.68)", fontWeight: 700, marginTop: 1 }}>{s.label}</div>
                  </div>);
                return els;
              })}
            </div>
            {[
              { lbl: "P", val: totalP, goal: foodGoal.p, color: "#93C5FD" },
              { lbl: "C", val: totalC, goal: foodGoal.c, color: "#FCD34D" },
              { lbl: "G", val: totalG, goal: foodGoal.g, color: "#FCA5A5" },
            ].map(m => (
              <div key={m.lbl} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,.85)", fontWeight: 800, width: 10 }}>{m.lbl}</div>
                <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,.18)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: Math.min(m.val / m.goal * 100, 100) + "%", height: 5, background: m.color, borderRadius: 3, transition: "width .6s ease" }} />
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,.82)", fontWeight: 700, width: 44, textAlign: "right" }}>{m.val}/{m.goal}g</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SEARCH BAR ── */}
      <div style={{ margin: "0 16px 12px", display: "flex", gap: 8 }}>
        <button onClick={() => openSearch(null)} style={{
          flex: 1, height: 46, background: T.card, borderRadius: 14, border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 10, padding: "0 16px",
          boxShadow: T.shadow, textAlign: "left",
        }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <span style={{ fontSize: 14, color: T.textMuted }}>Cerca un alimento…</span>
        </button>
        <button onClick={() => setScanOpen(true)} style={{
          width: 46, height: 46, borderRadius: 14, background: T.tealLight, border: "none",
          cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
        }}>📷</button>
      </div>

      {/* ── MEALS TABLE ── */}
      <div style={{ margin: "0 16px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>Pasti</div>
      <div style={{ margin: "0 16px", background: T.card, borderRadius: 18, overflow: "hidden", boxShadow: T.shadow }}>
        {/* Column header */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 56px 40px 40px 40px",
          padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: "#FAFAFA",
        }}>
          {[["Pasto", "left", T.textMuted], ["kcal", "right", T.textMuted], ["P", "right", "#3B82F6"], ["C", "right", T.gold], ["G", "right", T.coral]].map(([lbl, align, color]) => (
            <div key={lbl} style={{ fontSize: 10, fontWeight: 800, color, textAlign: align }}>{lbl}</div>
          ))}
        </div>

        {/* Meal rows */}
        {FOOD_MEALS.map((meal, mi) => {
          const md = day[meal.id] || { kcal: 0, p: 0, c: 0, g: 0, items: [] };
          const hasItems = md.items.length > 0;
          const isExpanded = expanded[meal.id];
          const isLast = mi === FOOD_MEALS.length - 1;

          return (
            <div key={meal.id}>
              {/* Row */}
              <div onClick={() => toggleMeal(meal.id)} style={{
                display: "grid", gridTemplateColumns: "1fr 56px 40px 40px 40px",
                padding: "12px 14px", borderBottom: (isLast && !isExpanded) ? "none" : `1px solid ${T.border}`,
                alignItems: "center", cursor: "pointer",
                background: isExpanded ? "#FAFBFF" : "transparent",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{meal.emoji}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{meal.label}</span>
                  <ChevronRight size={12} color={T.textMuted} style={{ transition: "transform 0.25s", transform: isExpanded ? "rotate(90deg)" : "none" }} />
                </div>
                {[
                  [md.kcal, T.text],
                  [md.p + "g", "#3B82F6"],
                  [md.c + "g", T.gold],
                  [md.g + "g", T.coral],
                ].map(([val, color], vi) => (
                  <div key={vi} style={{ fontSize: 12, fontWeight: 700, color: hasItems ? color : T.textMuted, textAlign: "right" }}>
                    {hasItems ? val : "—"}
                  </div>
                ))}
              </div>

              {/* Expanded body */}
              {isExpanded && (
                <div style={{ borderBottom: isLast ? "none" : `1px solid ${T.border}` }}>
                  {/* Food items */}
                  {md.items.map((item, ii) => (
                    <div key={ii} style={{
                      display: "flex", alignItems: "center", padding: "10px 14px",
                      borderBottom: `1px solid ${T.border}`, gap: 10,
                    }}>
                      <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => openGramEdit(meal.id, ii)}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>{item.grams}g · tocca per modificare</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{item.kcal} kcal</div>
                        <div style={{ fontSize: 10, color: T.textMuted }}>P {item.p}g · C {item.c}g · G {item.g}g</div>
                      </div>
                      <button onClick={() => removeItem(meal.id, ii)} style={{
                        width: 28, height: 28, borderRadius: 8, border: "none", background: "#FEE2E2",
                        color: T.coral, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}><X size={14} /></button>
                    </div>
                  ))}

                  {/* Footer actions */}
                  <div>
                    <div onClick={() => openSearch(meal.id)} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                      cursor: "pointer", borderBottom: `1px solid ${T.border}`,
                    }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: T.tealLight, color: T.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700 }}>+</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.teal }}>Aggiungi alimento</div>
                    </div>
                    {hasItems && (
                      <div onClick={() => { setSavingMeal(meal.id); setSaveName(""); setSaveOpen(true); }} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer",
                      }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⭐</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.purple }}>Salva come pasto</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <BottomNav active="food" onNavigate={onNavigate} onAdd={() => openSearch(null)} />

      {/* ═══════════════════════════════════════════
          SEARCH OVERLAY
          ═══════════════════════════════════════════ */}
      {searchOpen && (
        <div onClick={closeSearch} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100,
          display: "flex", alignItems: "flex-end",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 390, margin: "0 auto",
            background: T.card, borderRadius: "24px 24px 0 0",
            maxHeight: "92vh", display: "flex", flexDirection: "column",
            animation: "slideUp 0.28s ease",
          }}>
            {/* Handle + Header */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, background: "#E5E7EB", borderRadius: 2, margin: "12px auto 0" }} />
              <div style={{ padding: "10px 16px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>Aggiungi alimento</div>
                  <button onClick={closeSearch} style={{
                    width: 28, height: 28, borderRadius: 14, background: "#F3F4F6", border: "none",
                    cursor: "pointer", fontSize: 15, color: T.textMuted, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>✕</button>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", borderBottom: `2px solid ${T.border}`, marginBottom: 10 }}>
                  {[["alimenti", "🥦 Alimenti"], ["salvati", "⭐ Pasti salvati"]].map(([id, label]) => (
                    <button key={id} onClick={() => setSearchTab(id)} style={{
                      flex: 1, padding: "8px 0", fontSize: 13, fontWeight: 700,
                      color: searchTab === id ? T.teal : T.textMuted,
                      border: "none", background: "none", cursor: "pointer",
                      borderBottom: searchTab === id ? `2px solid ${T.teal}` : "2px solid transparent",
                      marginBottom: -2, transition: "all .2s",
                    }}>{label}</button>
                  ))}
                </div>

                {/* Meal chips – single row */}
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 8, scrollbarWidth: "none" }}>
                  {[{ id: null, label: "Tutti", color: "#F3F4F6", textColor: T.text }, ...FOOD_MEALS].map(chip => {
                    const isSel = searchMeal === chip.id;
                    return (
                      <button key={chip.id || "all"} onClick={() => setSearchMeal(chip.id)} style={{
                        flexShrink: 0, padding: "7px 12px", borderRadius: 20, border: "none", cursor: "pointer",
                        fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                        background: isSel ? (chip.color || "#F3F4F6") : "#F3F4F6",
                        color: isSel ? (chip.textColor || T.text) : T.textMuted,
                        opacity: isSel ? 1 : 0.6,
                        transition: "all .15s",
                      }}>
                        {chip.emoji ? chip.emoji + " " : ""}{chip.label}
                      </button>
                    );
                  })}
                </div>

                {/* Search input (alimenti only) */}
                {searchTab === "alimenti" && (
                  <>
                    <div style={{
                      display: "flex", alignItems: "center", background: "#F5F7FA",
                      borderRadius: 14, padding: "0 14px", gap: 8,
                      border: `1.5px solid ${T.tealLight}`, marginBottom: 8,
                    }}>
                      <span style={{ fontSize: 16 }}>🔍</span>
                      <input
                        autoFocus
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Es. pollo, pasta, riso…"
                        style={{
                          flex: 1, height: 44, background: "none", border: "none", outline: "none",
                          fontSize: 15, color: T.text, fontFamily: "inherit",
                        }}
                      />
                      {searchQuery && <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: 18 }}>✕</button>}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.7, paddingBottom: 6 }}>
                      {!searchQuery.trim()
                        ? (searchMeal ? "Recenti – " + FOOD_MEALS.find(m => m.id === searchMeal)?.label : "Suggeriti")
                        : (currentList.length ? "Risultati" : "Nessun risultato")}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Results */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 4px" }}>
              {searchTab === "alimenti" ? (
                currentList.length === 0 ? (
                  <div style={{ padding: "24px 0", textAlign: "center", color: T.textMuted, fontSize: 14 }}>Nessun alimento trovato</div>
                ) : currentList.map((food, i) => {
                  const selObj = selectedItems.find(s => s.food.name === food.name);
                  const isSel = !!selObj;
                  const grams = selObj ? selObj.grams : 100;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}`, gap: 10 }}>
                      {/* Checkbox */}
                      <div onClick={() => toggleSelect(food)} style={{
                        width: 22, height: 22, borderRadius: 7, flexShrink: 0, cursor: "pointer",
                        border: isSel ? "none" : `2px solid ${T.border}`,
                        background: isSel ? T.teal : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, color: "#fff", transition: "all .15s",
                      }}>{isSel ? "✓" : ""}</div>
                      {/* Food info – tap to edit grams */}
                      <div style={{ flex: 1, cursor: "pointer", minWidth: 0 }} onClick={() => openGramFromSearch(food)}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                          {food.name}
                          {isSel && <span style={{ fontSize: 10, color: T.teal, fontWeight: 700, marginLeft: 6 }}>{grams}g</span>}
                        </div>
                        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>{food.detail} · tocca per grammi</div>
                      </div>
                      {/* Kcal */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{isSel ? scaleN(food.kcal, grams) : food.kcal}</div>
                        <div style={{ fontSize: 10, color: T.textMuted }}>kcal</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                /* Saved meals tab */
                savedMeals.length === 0 ? (
                  <div style={{ padding: "32px 0", textAlign: "center", color: T.textMuted, fontSize: 14 }}>
                    Nessun pasto salvato.<br />Aggiungi alimenti e salva!
                  </div>
                ) : savedMeals.map((sm, i) => (
                  <div key={i} style={{
                    padding: "12px 0", borderBottom: `1px solid ${T.border}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>⭐ {sm.name}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {sm.foods.map(f => f.name).join(", ")}<br />
                        {sm.foods.reduce((s, f) => s + f.kcal, 0)} kcal · P {sm.foods.reduce((s, f) => s + f.p, 0)}g · C {sm.foods.reduce((s, f) => s + f.c, 0)}g · G {sm.foods.reduce((s, f) => s + f.g, 0)}g
                      </div>
                    </div>
                    <button onClick={() => useSaved(i)} style={{
                      padding: "7px 14px", borderRadius: 10, background: T.tealLight,
                      border: "none", fontSize: 12, fontWeight: 700, color: T.teal,
                      cursor: "pointer", flexShrink: 0, marginLeft: 10,
                    }}>Usa</button>
                  </div>
                ))
              )}
            </div>

            {/* Add bar (alimenti only) */}
            {searchTab === "alimenti" && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", borderTop: `1.5px solid ${T.border}`, flexShrink: 0, background: T.card,
              }}>
                <div style={{ fontSize: 13, color: T.textSec, fontWeight: 600 }}>
                  {selectedItems.length === 0 ? "0 selezionati" : selectedItems.length + " selezionat" + (selectedItems.length === 1 ? "o" : "i")}
                </div>
                <button onClick={confirmAdd} disabled={selectedItems.length === 0} style={{
                  padding: "10px 24px", borderRadius: 14,
                  background: selectedItems.length > 0 ? T.gradient : "#E5E7EB",
                  color: selectedItems.length > 0 ? "#fff" : T.textMuted,
                  fontSize: 14, fontWeight: 800, border: "none", cursor: selectedItems.length > 0 ? "pointer" : "not-allowed",
                  transition: "all .2s",
                }}>Aggiungi</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          GRAM EDITOR OVERLAY
          ═══════════════════════════════════════════ */}
      {gramOpen && gramFood && (
        <div onClick={() => setGramOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: 22, padding: 24, width: "100%", maxWidth: 320,
            boxShadow: "0 16px 48px rgba(0,0,0,.15)",
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 4 }}>{gramFood.name}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>
              Valori per 100g: {gramFood.kcal} kcal · P {gramFood.p}g · C {gramFood.c}g · G {gramFood.g}g
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <input
                type="number" min="1" max="9999"
                value={gramValue}
                onChange={e => setGramValue(e.target.value)}
                autoFocus
                style={{
                  flex: 1, height: 48, border: `2px solid ${T.tealLight}`, borderRadius: 14,
                  textAlign: "center", fontSize: 22, fontWeight: 800, color: T.text,
                  outline: "none", background: T.bg, fontFamily: "inherit",
                }}
              />
              <div style={{ fontSize: 14, fontWeight: 700, color: T.textMuted }}>g</div>
            </div>
            {gramPreview && (
              <div style={{ fontSize: 12, color: T.textSec, fontWeight: 600, marginBottom: 18 }}>
                = {gramPreview.kcal} kcal · P {gramPreview.p}g · C {gramPreview.c}g · G {gramPreview.g}g
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setGramOpen(false)} style={{
                flex: 1, padding: 12, borderRadius: 14, background: T.bg, border: "none",
                fontSize: 14, fontWeight: 700, color: T.textSec, cursor: "pointer",
              }}>Annulla</button>
              <button onClick={confirmGram} style={{
                flex: 1, padding: 12, borderRadius: 14, background: T.gradient,
                border: "none", fontSize: 14, fontWeight: 800, color: "#fff", cursor: "pointer",
              }}>Conferma</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          SAVE MEAL OVERLAY
          ═══════════════════════════════════════════ */}
      {saveOpen && (
        <div onClick={() => setSaveOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: 22, padding: 24, width: "100%", maxWidth: 320,
            boxShadow: "0 16px 48px rgba(0,0,0,.15)",
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 8 }}>⭐ Salva questo pasto</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>
              {savingMeal && (day[savingMeal]?.items || []).map(i => i.name).join(", ")}
            </div>
            <input
              autoFocus
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && confirmSave()}
              placeholder="Es. Colazione classica, Pranzo fit…"
              maxLength={40}
              style={{
                width: "100%", height: 48, border: `2px solid ${T.tealLight}`, borderRadius: 14,
                padding: "0 16px", fontSize: 15, color: T.text, outline: "none",
                background: T.bg, fontFamily: "inherit", marginBottom: 16, boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setSaveOpen(false)} style={{
                flex: 1, padding: 12, borderRadius: 14, background: T.bg, border: "none",
                fontSize: 14, fontWeight: 700, color: T.textSec, cursor: "pointer",
              }}>Annulla</button>
              <button onClick={confirmSave} style={{
                flex: 1, padding: 12, borderRadius: 14,
                background: "linear-gradient(135deg,#7C5CFC,#028090)",
                border: "none", fontSize: 14, fontWeight: 800, color: "#fff", cursor: "pointer",
              }}>Salva ⭐</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 110, left: "50%", transform: "translateX(-50%)",
          background: T.text, color: "#fff", padding: "10px 20px", borderRadius: 12,
          fontSize: 13, fontWeight: 600, zIndex: 400, whiteSpace: "nowrap", pointerEvents: "none",
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        }}>{toast}</div>
      )}

      {/* ── BARCODE SCANNER ── */}
      {scanOpen && <BarcodeScanner onFound={onBarcodeFound} onClose={() => setScanOpen(false)} />}

      {/* CSS animation */}
      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
}


export default function WeightTrackerApp() {
  const [entries, setEntries] = useState(generateSampleData);
  const [screen, setScreen] = useState("dashboard");
  const [settings, setSettings] = useState({
    height: 175, goalWeight: 78, startWeight: 85.5, name: "Davide",
  });
  const [newWeight, setNewWeight] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newDate, setNewDate] = useState(
today());
  const [chartRange, setChartRange] = useState("1M");
  const [editingEntry, setEditingEntry] = useState(null);
  const [editWeight, setEditWeight] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState(null);

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
    let p
redictedDate = null;
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

  const goTo = useCallback((s) => { setScreen(s); setShowConfirmDelete(null); setEditingEntry(null); }, []);

  const activeTab = ["dashboard", "food", "fitness", "profile"].includes(screen) ? screen : "dashboard";

  /* ═══════════════════════════════════════
     SCREEN: ADD WEIGHT
     ══════════════════════════════════════ */
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
                fontSize: 14, fontWeight: 700, marginT
op: 12, padding: "6px 16px",
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
            width: "100%", padding: "17px", border
Radius: 16, border: "none",
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
                    {formatDateF
ull(entry.date)}
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
     SCREEN: FOOD (Coming Soon)
     ═══════════════════════════════════════ */
  if (screen === "food") {
    return <FoodScreen onNavigate={goTo} settings={settings} />;
  }

  /* ═══════════════════════════════════════
     SCREEN: FITNESS (Coming Soon)
     ═══════════════════════════════════════ */
  if (screen === "fitness") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <Header title="Fitness" subtitle="Attività" />
        <ComingSoonScreen
          icon={Dumbbell} title="Traccia il tuo Allenamento" color={T.purple}
          description="Registra camminate, sessioni in palestra e monitora i tuoi progressi fitness."
          features={[
            { icon: Activity, title: "Camminata & Corsa", desc: "Passi, distanza e calorie bruciate" },
            { icon: Dumbbell, title: "Palestra", desc: "Esercizi, serie, ripetizioni e carichi" },
            { icon: Flame, title: "Calorie Bruciate", desc: "Stima automatica per attività" },
            { icon: TrendingUp, title: "Progressi Forza", desc: "Traccia i tuoi personal record" },
          ]}
        />
        <BottomNav active="fitness" onNavigate={goTo} onAdd={() => goTo("add")} />
      </div>
    );
  }

  /
* ═══════════════════════════════════════
     SCREEN: PROFILE / SETTINGS
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
                borderBottom: i < arr.length - 1 ? `1px so
lid ${T.border}` : "none",
              }}>
                <span style={{ fontSize: 13, color: T.textSec }}>{item.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{item.value}</span>
              </div>
            ))}
          </div>

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
    if (losing && weekDiff === 0) return { text: "Il trend è stabile rispetto 
alla settimana scorsa. A volte il corpo ha bisogno di una pausa prima di scendere ancora.", mood: "neutral" };
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
                <di
v style={{
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
                    <strong 
style={{ color: "#fff" }}>{metrics.predictedDate}</strong>
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
              <button key={key} onCli
ck={() => setCompTab(key)} style={{
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
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Dati non disponi
bili</div>
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
                        fontSize: 10, fontWeight: 600, padding: "3px 8px", 
borderRadius: 8,
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
            <div st
yle={{
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
              chartSetting
s.showObjective && settings.goalWeight ? "Verde = obiettivo" : null,
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
              {c
hartSettings.showTrend && (
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
              <span style={{ fontSize: 9, color: T.textMuted, fontWeight:
 600, textTransform: "uppercase", width: 60, textAlign: "right" }}>Peso</span>
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
                        {entry.diff > 0 ? "+" : ""}{entry.dif
f}
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
          {
"Il "}
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
