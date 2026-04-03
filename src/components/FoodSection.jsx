// FoodSection.jsx — Complete food tracking module with Card 2 Meal Cards
// Features: calorie ring, macro cards, meal diary, barcode scanner,
// OpenFoodFacts API, local caching (Dexie), bottom sheet, gram editor modal,
// custom food forms, cheat food, save/load meals, nutrition goals, reports
import React, {
  useState, useEffect, useRef, useCallback,
  forwardRef, useImperativeHandle,
} from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Line, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from "recharts";
import {
  Search, Plus, X, Check, ChevronLeft, ChevronRight, ChevronDown,
  ChevronUp, Trash2, Camera, Target, BarChart3, Calendar,
  Clock, Star, Flame, Activity, TrendingUp, ScanLine, Settings, Zap,
  Bookmark, Download, Minus, Pizza, ArrowLeft,
} from "lucide-react";
import { FOOD_DATABASE as EXTERNAL_DB } from "./food-database";
import {
  getFoodEntriesByDate, addFoodEntry, addFoodEntries,
  deleteFoodEntry, updateFoodEntry, cacheFood,
  getCachedFoodByBarcode, searchCachedFoods,
  getRecentFoodsByMeal, getAllCachedFoods,
} from "../lib/food-db";

// ─── CONSTANTS ────────────────────────────────────────────
const FALLBACK_DB = [
  { id: "f1", name: "Pasta secca", kcal: 350, protein: 12, carbs: 72, fat: 1.5, fiber: 2, category: "Cereali e Pasta", defaultPortion: 80 },
  { id: "f2", name: "Riso bianco", kcal: 360, protein: 7, carbs: 80, fat: 0.6, fiber: 1, category: "Cereali e Pasta", defaultPortion: 80 },
  { id: "f3", name: "Petto di pollo", kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, category: "Carne", defaultPortion: 150 },
  { id: "f4", name: "Salmone", kcal: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, category: "Pesce", defaultPortion: 150 },
  { id: "f5", name: "Uovo intero", kcal: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0, category: "Latticini e Uova", defaultPortion: 60 },
  { id: "f6", name: "Mozzarella", kcal: 280, protein: 22, carbs: 2.2, fat: 20, fiber: 0, category: "Latticini e Uova", defaultPortion: 125 },
  { id: "f7", name: "Banana", kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, category: "Frutta", defaultPortion: 120 },
  { id: "f8", name: "Mela", kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, category: "Frutta", defaultPortion: 150 },
  { id: "f9", name: "Pane integrale", kcal: 247, protein: 13, carbs: 41, fat: 3.4, fiber: 7, category: "Pane e Prodotti da forno", defaultPortion: 50 },
  { id: "f10", name: "Olio extravergine", kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, category: "Condimenti e Oli", defaultPortion: 10 },
];

const FOOD_DB = (EXTERNAL_DB && EXTERNAL_DB.length > 0) ? EXTERNAL_DB : FALLBACK_DB;

const MEAL_CONFIG = {
  breakfast: { label: "Colazione", icon: "\u2615", color: "#F0B429", bgColor: "#FEF3C7" },
  lunch:     { label: "Pranzo",    icon: "\u2600\uFE0F", color: "#028090", bgColor: "#E0F2F1" },
  dinner:    { label: "Cena",      icon: "\uD83C\uDF19", color: "#7C5CFC", bgColor: "#EDE9FE" },
  snack:     { label: "Snack",     icon: "\uD83C\uDF4E", color: "#E85D4E", bgColor: "#FEE2E2" },
};
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

const CATEGORY_EMOJI = {
  "Cereali e Pasta": "\uD83C\uDF5D", "Pane e Prodotti da forno": "\uD83C\uDF5E",
  "Carne": "\uD83E\uDD69", "Pesce": "\uD83D\uDC1F", "Latticini e Uova": "\uD83E\uDD5B",
  "Frutta": "\uD83C\uDF4E", "Verdura": "\uD83E\uDD6C", "Legumi": "\uD83E\uDED8",
  "Condimenti e Oli": "\uD83E\uDED2", "Dolci e Snack": "\uD83C\uDF6B",
  "Bevande": "\uD83E\uDD64", "Salumi": "\uD83E\uDD53", "Frutta secca": "\uD83E\uDD5C",
};

const dayNames = ["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];
const dayNamesShort = ["Dom","Lun","Mar","Mer","Gio","Ven","Sab"];
const monthNames = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];

// ─── VALUES ROW (ALIGNED COLUMNS) ────────────────────────
const W = { gr: 34, g: 28, c: 28, p: 28, kcal: 38 };

const ValuesRow = ({ gr, g, c, p, kcal, grColor, gColor, cColor, pColor, kcalColor, fontSize = 11, fontWeight = 600 }) => (
  <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
    <span style={{ width: W.gr, textAlign: "right", fontSize, fontWeight, color: grColor, marginRight: 20 }}>{gr}</span>
    <span style={{ width: W.g, textAlign: "right", fontSize, fontWeight, color: gColor }}>{g}</span>
    <span style={{ width: W.c, textAlign: "right", fontSize, fontWeight, color: cColor }}>{c}</span>
    <span style={{ width: W.p, textAlign: "right", fontSize, fontWeight, color: pColor }}>{p}</span>
    <span style={{ width: W.kcal, textAlign: "right", fontSize, fontWeight, color: kcalColor }}>{kcal}</span>
  </div>
);

const MacroRowCompact = ({ grams, kcalPer100, fatPer100, carbsPer100, proteinPer100, T }) => {
  const m = grams / 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
      <span style={{ width: 32, textAlign: "right", fontSize: 11, fontWeight: 700, color: T.mint }}>{grams}</span>
      <span style={{ width: 8 }} />
      <span style={{ width: 26, textAlign: "right", fontSize: 10, fontWeight: 600, color: "#E85D4E" }}>{Math.round(fatPer100 * m)}</span>
      <span style={{ width: 26, textAlign: "right", fontSize: 10, fontWeight: 600, color: "#F0B429" }}>{Math.round(carbsPer100 * m)}</span>
      <span style={{ width: 26, textAlign: "right", fontSize: 10, fontWeight: 600, color: "#3B82F6" }}>{Math.round(proteinPer100 * m)}</span>
      <span style={{ width: 34, textAlign: "right", fontSize: 10, fontWeight: 700, color: T.text }}>{Math.round(kcalPer100 * m)}</span>
    </div>
  );
};

// ─── SWIPEABLE ITEM (REPLACED) ──────────────────────────
const SwipeableItem = ({ entry, onDelete, onTap, T }) => {
  const [offsetX, setOffsetX] = useState(0);
  const swipingRef = useRef(false);
  const startXRef = useRef(0);
  const baseRef = useRef(0);

  return (
    <div style={{ position: "relative", overflow: "hidden", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 75, background: T.coral, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }} onClick={() => onDelete(entry.id)}>
        <Trash2 size={18} color="#fff" />
      </div>
      <div
        style={{ display: "flex", alignItems: "center", padding: "10px 14px", background: T.card, position: "relative", zIndex: 2, transform: `translateX(${-offsetX}px)`, transition: swipingRef.current ? "none" : "transform 0.25s ease", cursor: "pointer" }}
        onTouchStart={(e) => { startXRef.current = e.touches[0].clientX; baseRef.current = offsetX; swipingRef.current = true; }}
        onTouchMove={(e) => { if (!swipingRef.current) return; setOffsetX(Math.max(0, Math.min(75, baseRef.current + (startXRef.current - e.touches[0].clientX)))); }}
        onTouchEnd={() => { swipingRef.current = false; setOffsetX((prev) => (prev > 35 ? 75 : 0)); }}
        onClick={() => { if (offsetX === 0 && onTap) onTap(entry); }}
      >
        {entry.isCheat && <span style={{ fontSize: 14, marginRight: 6, flexShrink: 0 }}>🍕</span>}
        <div style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entry.foodName}
            {entry.brand && <span style={{ fontSize: 10, fontWeight: 400, color: T.textMuted, marginLeft: 5 }}>{entry.brand}</span>}
          </div>
        </div>
        {entry.isCheat ? (
          <div style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
            <span style={{ width: W.gr, textAlign: "right", fontSize: 11, fontWeight: 600, color: T.mint, marginRight: 20 }}>{entry.grams || "—"}</span>
            <span style={{ width: W.g, textAlign: "right", fontSize: 11, fontWeight: 600, color: "#E85D4E" }}>{Math.round(entry.fat)}</span>
            <span style={{ width: W.c, textAlign: "right", fontSize: 11, fontWeight: 600, color: "#F0B429" }}>{Math.round(entry.carbs)}</span>
            <span style={{ width: W.p, textAlign: "right", fontSize: 11, fontWeight: 600, color: "#3B82F6" }}>{Math.round(entry.protein)}</span>
            <span style={{ width: W.kcal, textAlign: "right", fontSize: 11, fontWeight: 600, color: T.text }}>{entry.kcal}</span>
          </div>
        ) : (
          <ValuesRow gr={entry.grams} g={Math.round(entry.fat)} c={Math.round(entry.carbs)} p={Math.round(entry.protein)} kcal={entry.kcal}
            grColor={T.mint} gColor="#E85D4E" cColor="#F0B429" pColor="#3B82F6" kcalColor={T.text} fontSize={11} fontWeight={600} />
        )}
        <div style={{ width: 22, flexShrink: 0 }} />
      </div>
    </div>
  );
};

// ─── GRAM EDITOR MODAL (REPLACED renderGramPopup) ───────
const GramEditorModal = ({ entry, onSave, onClose, T }) => {
  const [grams, setGrams] = useState(entry.grams || entry.lastGrams || 100);
  const m = grams / 100;
  const pv = { kcal: Math.round((entry.kcalPer100||0)*m), protein: +((entry.proteinPer100||0)*m).toFixed(1), carbs: +((entry.carbsPer100||0)*m).toFixed(1), fat: +((entry.fatPer100||0)*m).toFixed(1) };
  const quickGrams = [50, 100, 150, 200, 250];

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 24, width: "100%", maxWidth: 340, boxShadow: "0 25px 60px rgba(0,0,0,0.25)", overflow: "hidden", animation: "scaleIn .25s ease-out" }} onClick={(e) => e.stopPropagation()}>
        <style>{`@keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }`}</style>
        <div style={{ background: T.gradient, padding: "20px 22px 16px" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{entry.foodName}</div>
          {entry.brand && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{entry.brand}</div>}
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{entry.kcalPer100} kcal per 100g</div>
        </div>
        <div style={{ padding: "20px 22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 18 }}>
            <button onClick={() => setGrams(Math.max(1, grams - 10))} style={{ width: 44, height: 44, borderRadius: 14, border: `2px solid ${T.border}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.text }}><Minus size={18} /></button>
            <div style={{ position: "relative" }}>
              <input type="number" value={grams} onChange={(e) => setGrams(Math.max(0, parseInt(e.target.value) || 0))} autoFocus
                style={{ width: 90, height: 52, borderRadius: 16, border: `2px solid ${T.teal}`, textAlign: "center", fontSize: 26, fontWeight: 800, fontFamily: "inherit", color: T.text, outline: "none", background: T.tealLight }} />
              <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 700, color: T.teal, background: "#fff", padding: "0 6px" }}>grammi</div>
            </div>
            <button onClick={() => setGrams(grams + 10)} style={{ width: 44, height: 44, borderRadius: 14, border: `2px solid ${T.border}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.text }}><Plus size={18} /></button>
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 20 }}>
            {quickGrams.map((qg) => (
              <button key={qg} onClick={() => setGrams(qg)} style={{ padding: "6px 10px", borderRadius: 10, border: "none", background: grams === qg ? T.teal : "#F0F2F5", color: grams === qg ? "#fff" : T.textSec, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{qg}g</button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 16, fontSize: 12 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{pv.kcal}</div>
              <div style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>kcal</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#3B82F6" }}>{pv.protein.toFixed(1)}</div>
              <div style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>P</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#F0B429" }}>{pv.carbs.toFixed(1)}</div>
              <div style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>C</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#E85D4E" }}>{pv.fat.toFixed(1)}</div>
              <div style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>G</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: "#F0F0F0", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: T.textSec }}>Annulla</button>
            <button onClick={() => onSave(grams)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: T.gradient, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Conferma</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── CUSTOM FOOD FORM ───────────────────────────────────
const CustomFoodForm = ({ onSave, onBack, T, initialBarcode }) => {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [kcalPer100, setKcalPer100] = useState("");
  const [proteinPer100, setProteinPer100] = useState("");
  const [carbsPer100, setCarbsPer100] = useState("");
  const [fatPer100, setFatPer100] = useState("");
  const [barcode, setBarcode] = useState(initialBarcode || "");

  const canSave = name && kcalPer100;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      foodName: name,
      brand,
      kcalPer100: parseFloat(kcalPer100) || 0,
      proteinPer100: parseFloat(proteinPer100) || 0,
      carbsPer100: parseFloat(carbsPer100) || 0,
      fatPer100: parseFloat(fatPer100) || 0,
      barcode,
    });
  };

  return (
    <div style={{ padding: "20px 22px 24px", maxHeight: "85vh", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", color: T.text }}><ArrowLeft size={20} /></button>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginLeft: 12 }}>Aggiungi Alimento</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSec, marginBottom: 6 }}>Nome *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Pollo al forno"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${T.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", color: T.text, boxSizing: "border-box" }} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSec, marginBottom: 6 }}>Brand</label>
        <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Es. Azienda X"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${T.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", color: T.text, boxSizing: "border-box" }} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSec, marginBottom: 6 }}>kcal per 100g *</label>
        <input type="number" value={kcalPer100} onChange={(e) => setKcalPer100(e.target.value)} placeholder="0"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${T.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", color: T.text, boxSizing: "border-box" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 5 }}>Proteine (g)</label>
          <input type="number" value={proteinPer100} onChange={(e) => setProteinPer100(e.target.value)} placeholder="0"
            style={{ width: "100%", padding: "10px 10px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", color: T.text, boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 5 }}>Carbs (g)</label>
          <input type="number" value={carbsPer100} onChange={(e) => setCarbsPer100(e.target.value)} placeholder="0"
            style={{ width: "100%", padding: "10px 10px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", color: T.text, boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 5 }}>Grassi (g)</label>
          <input type="number" value={fatPer100} onChange={(e) => setFatPer100(e.target.value)} placeholder="0"
            style={{ width: "100%", padding: "10px 10px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", color: T.text, boxSizing: "border-box" }} />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSec, marginBottom: 6 }}>Barcode (opzionale)</label>
        <input type="text" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder=""
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${T.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", color: T.text, boxSizing: "border-box" }} />
      </div>

      <button onClick={handleSave} disabled={!canSave}
        style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", background: canSave ? T.gradient : "#ccc", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: canSave ? "pointer" : "default" }}>
        Salva Alimento
      </button>
    </div>
  );
};

// ─── CHEAT FOOD FORM ────────────────────────────────────
const CheatFoodForm = ({ onSave, onBack, T }) => {
  const [name, setName] = useState("");
  const [totalKcal, setTotalKcal] = useState("");
  const [totalProtein, setTotalProtein] = useState("");
  const [totalCarbs, setTotalCarbs] = useState("");
  const [totalFat, setTotalFat] = useState("");

  const canSave = name && totalKcal;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      foodName: name,
      brand: "",
      grams: 100,
      kcal: parseFloat(totalKcal) || 0,
      protein: parseFloat(totalProtein) || 0,
      carbs: parseFloat(totalCarbs) || 0,
      fat: parseFloat(totalFat) || 0,
      isCheat: true,
    });
  };

  return (
    <div style={{ padding: "20px 22px 24px", maxHeight: "85vh", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", color: T.text }}><ArrowLeft size={20} /></button>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginLeft: 12 }}>🍕 Aggiungi Sgarro</div>
      </div>

      <div style={{ background: "rgba(255, 179, 71, 0.1)", borderRadius: 12, padding: 12, marginBottom: 16, borderLeft: `4px solid #FF6B35` }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Sgarro</div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Inserisci i valori TOTALI del piatto, non per 100g</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSec, marginBottom: 6 }}>Nome *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Pizza al Taglio"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${T.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", color: T.text, boxSizing: "border-box" }} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSec, marginBottom: 6 }}>kcal TOTALI *</label>
        <input type="number" value={totalKcal} onChange={(e) => setTotalKcal(e.target.value)} placeholder="0"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${T.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", color: T.text, boxSizing: "border-box" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 5 }}>Proteine (g)</label>
          <input type="number" value={totalProtein} onChange={(e) => setTotalProtein(e.target.value)} placeholder="0"
            style={{ width: "100%", padding: "10px 10px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", color: T.text, boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 5 }}>Carbs (g)</label>
          <input type="number" value={totalCarbs} onChange={(e) => setTotalCarbs(e.target.value)} placeholder="0"
            style={{ width: "100%", padding: "10px 10px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", color: T.text, boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 5 }}>Grassi (g)</label>
          <input type="number" value={totalFat} onChange={(e) => setTotalFat(e.target.value)} placeholder="0"
            style={{ width: "100%", padding: "10px 10px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", color: T.text, boxSizing: "border-box" }} />
        </div>
      </div>

      <button onClick={handleSave} disabled={!canSave}
        style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", background: canSave ? "linear-gradient(135deg, #FF6B35, #FF8A50)" : "#ccc", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: canSave ? "pointer" : "default" }}>
        Salva Sgarro
      </button>
    </div>
  );
};

// ─── LOAD MEAL SHEET ────────────────────────────────────
const LoadMealSheet = ({ mealType, savedMeals, onLoad, onDelete, onClose, T }) => {
  const filtered = savedMeals.filter(m => m.mealType === mealType);

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", zIndex: 900, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", width: "100%", maxWidth: 440, borderRadius: "24px 24px 0 0", maxHeight: "70vh", display: "flex", flexDirection: "column", animation: "slideUp .3s ease-out" }} onClick={(e) => e.stopPropagation()}>
        <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        <div style={{ width: 36, height: 4, background: "#ddd", borderRadius: 2, margin: "10px auto" }} />
        <div style={{ padding: "4px 20px 12px" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Carica Pasto</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>{MEAL_CONFIG[mealType].label}</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 10px" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 30, color: T.textMuted, fontSize: 13 }}>Nessun pasto salvato</div>
          ) : (
            filtered.map((meal) => (
              <div key={meal.id} style={{ padding: "12px 0", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{meal.name}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{meal.items.length} cibi • {meal.totalKcal} kcal</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => onLoad(meal)} style={{ padding: "6px 12px", borderRadius: 10, border: "none", background: T.gradient, color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>Carica</button>
                  <button onClick={() => onDelete(meal.id)} style={{ padding: "6px 8px", borderRadius: 10, border: "none", background: "#FEE2E2", color: T.coral, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>Elimina</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ─── ADD FOOD SHEET (REPLACED renderBottomSheet) ────────
const AddFoodSheet = ({ mealType, recents, onAdd, onClose, onScannerOpen, T, initialView, initialBarcode }) => {
  const [view, setView] = useState(initialView || "main"); // "main" | "customFood" | "cheat"
  const [customBarcode, setCustomBarcode] = useState(initialBarcode || null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [selections, setSelections] = useState(new Map());
  const searchTimeoutRef = useRef(null);

  const handleSearch = useCallback((query) => {
    setSearch(query);
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    const q = query.toLowerCase();
    const localResults = FOOD_DB.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 10).map((f) => ({
      ...f, kcalPer100: f.kcal, proteinPer100: f.protein, carbsPer100: f.carbs, fatPer100: f.fat, fiberPer100: f.fiber || 0, source: "local",
    }));
    setResults(localResults);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.length >= 3) {
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&lc=it`
          );
          const data = await res.json();
          if (data.products) {
            const apiResults = data.products
              .filter((p) => p.product_name && p.nutriments)
              .map((p) => {
                const n = p.nutriments;
                return {
                  foodName: p.product_name_it || p.product_name,
                  brand: p.brands || "",
                  kcalPer100: Math.round(n["energy-kcal_100g"] || 0),
                  proteinPer100: +(n.proteins_100g || 0).toFixed(1),
                  carbsPer100: +(n.carbohydrates_100g || 0).toFixed(1),
                  fatPer100: +(n.fat_100g || 0).toFixed(1),
                  defaultPortion: 100,
                  source: "api",
                };
              });
            setResults((prev) => [...prev, ...apiResults]);
          }
        } catch (e) { /* */ }
      }, 500);
    }
  }, []);

  const toggleSelection = (food) => {
    const key = food.foodName || food.name;
    setSelections((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, { food, grams: food.defaultPortion || food.lastGrams || 100 });
      }
      return next;
    });
  };

  const handleAddSelected = () => {
    for (const [, sel] of selections) {
      onAdd(sel.food, mealType, sel.grams);
    }
    onClose();
  };

  if (view === "customFood") {
    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", zIndex: 900, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
        <div style={{ background: "#fff", width: "100%", maxWidth: 440, borderRadius: "24px 24px 0 0", maxHeight: "85vh", display: "flex", flexDirection: "column", animation: "slideUp .3s ease-out" }} onClick={(e) => e.stopPropagation()}>
          <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
          <CustomFoodForm onSave={(food) => { onAdd(food, mealType, 100); onClose(); }} onBack={() => setView("main")} T={T} initialBarcode={customBarcode} />
        </div>
      </div>
    );
  }

  if (view === "cheat") {
    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", zIndex: 900, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
        <div style={{ background: "#fff", width: "100%", maxWidth: 440, borderRadius: "24px 24px 0 0", maxHeight: "85vh", display: "flex", flexDirection: "column", animation: "slideUp .3s ease-out" }} onClick={(e) => e.stopPropagation()}>
          <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
          <CheatFoodForm onSave={(food) => { onAdd(food, mealType, food.grams); onClose(); }} onBack={() => setView("main")} T={T} />
        </div>
      </div>
    );
  }

  const list = search.length >= 2 ? results : recents;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", zIndex: 900, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", width: "100%", maxWidth: 440, borderRadius: "24px 24px 0 0", maxHeight: "85vh", display: "flex", flexDirection: "column", animation: "slideUp .3s ease-out" }} onClick={(e) => e.stopPropagation()}>
        <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        <div style={{ width: 36, height: 4, background: "#ddd", borderRadius: 2, margin: "10px auto" }} />
        <div style={{ padding: "4px 20px 12px" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 12 }}>Aggiungi Cibo</div>

          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {MEAL_TYPES.map((mt) => {
              const cfg = MEAL_CONFIG[mt];
              const sel = mealType === mt;
              return (
                <button key={mt} style={{ flex: 1, padding: "10px 4px", borderRadius: 12, border: sel ? `2px solid ${T.teal}` : "2px solid #eee", background: sel ? T.tealLight : "#fff", cursor: "pointer", textAlign: "center", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 16 }}>{cfg.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: sel ? T.teal : T.textSec, marginTop: 3 }}>{cfg.label}</div>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", background: "#F5F7FA", borderRadius: 14, padding: "10px 14px", gap: 10, marginBottom: 12 }}>
            <Search size={18} color="#bbb" />
            <input type="text" value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="Cerca alimento..." style={{ flex: 1, border: "none", background: "none", fontSize: 14, fontFamily: "inherit", outline: "none", color: T.text }} />
            <button onClick={onScannerOpen} style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: T.gradient, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Camera size={16} /></button>
          </div>

          <button onClick={() => setView("cheat")} style={{ width: "100%", padding: "10px 14px", marginBottom: 12, borderRadius: 12, border: `1.5px dashed ${T.border}`, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: T.text, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Pizza size={14} /> Aggiungi sgarro</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 10px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
            {search.length >= 2 ? "Risultati" : `Recenti per ${MEAL_CONFIG[mealType].label}`}
          </div>

          {list.length === 0 && (
            <>
              <div style={{ textAlign: "center", padding: 30, color: T.textMuted, fontSize: 13 }}>
                {search.length >= 2 ? "Nessun risultato" : "Nessun cibo recente"}
              </div>
              {search.length >= 2 && (
                <button onClick={() => setView("customFood")} style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: T.gradient, color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>Aggiungi alimento manuale</button>
              )}
            </>
          )}

          {list.map((food, idx) => {
            const key = food.foodName || food.name;
            const isSelected = selections.has(key);
            const k100 = food.kcalPer100 ?? food.kcal ?? 0;
            const portion = isSelected ? selections.get(key).grams : (food.defaultPortion || food.lastGrams || 100);

            return (
              <div key={`${key}-${idx}`} style={{ display: "flex", alignItems: "center", padding: "11px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer", gap: 10 }}>
                <div onClick={() => toggleSelection(food)} style={{ width: 22, height: 22, borderRadius: 6, border: isSelected ? `2px solid ${T.teal}` : "2px solid #ddd", background: isSelected ? T.teal : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s", color: "#fff", fontSize: 13 }}>
                  {isSelected && <Check size={14} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{key}</div>
                  {food.brand && <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>{food.brand}</div>}
                </div>
                <MacroRowCompact grams={portion} kcalPer100={k100} fatPer100={food.fatPer100 || 0} carbsPer100={food.carbsPer100 || 0} proteinPer100={food.proteinPer100 || 0} T={T} />
              </div>
            );
          })}
        </div>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}` }}>
          <button disabled={selections.size === 0} onClick={handleAddSelected} style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", background: selections.size > 0 ? T.gradient : "#ccc", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: selections.size > 0 ? "pointer" : "default", boxShadow: selections.size > 0 ? "0 4px 15px rgba(2,128,144,0.3)" : "none" }}>
            {selections.size > 0 ? `Aggiungi ${selections.size} cib${selections.size === 1 ? "o" : "i"}` : "Seleziona cibi da aggiungere"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── COMPONENT ────────────────────────────────────────────
const FoodSection = forwardRef(({ settings, weightEntries, goTo, T }, ref) => {

  // ── STATE ───────────────────────────────────────────────
  const [foodScreen, setFoodScreen] = useState("dashboard");
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date(); return d.toISOString().split("T")[0];
  });
  const [foodEntries, setFoodEntries] = useState([]);
  const [nutritionGoals, setNutritionGoals] = useState({
    kcalTarget: 2000, proteinPct: 30, carbsPct: 40, fatPct: 30,
  });
  const [expandedMeals, setExpandedMeals] = useState({ breakfast: true, lunch: false, dinner: false, snack: false });

  // Bottom sheet state
  const [showAddSheet, setShowAddSheet] = useState(null); // null or mealType
  const [addSheetMeal, setAddSheetMeal] = useState("breakfast");
  const [addSheetRecents, setAddSheetRecents] = useState([]);
  const [addSheetView, setAddSheetView] = useState("main"); // "main" | "customFood" | "cheat"
  const [customBarcode, setCustomBarcode] = useState(null);

  // Gram editor state
  const [editingEntry, setEditingEntry] = useState(null); // { id, mealType }
  const [gramPopup, setGramPopup] = useState(null); // { food, grams, source, entryId?, meal? }

  // Save/Load meal state
  const [savedMeals, setSavedMeals] = useState([]);
  const [showSavePopup, setShowSavePopup] = useState(null); // null or mealType
  const [saveMealName, setSaveMealName] = useState("");
  const [showLoadPopup, setShowLoadPopup] = useState(null); // null or mealType
  const [toast, setToast] = useState("");

  // Scanner state
  const [scannerActive, setScannerActive] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [verifyProgress, setVerifyProgress] = useState(0);

  // Goals state
  const [localGoals, setLocalGoals] = useState(nutritionGoals);
  const [useManual, setUseManual] = useState(false);
  const [manualKcal, setManualKcal] = useState(nutritionGoals.kcalTarget);
  const [goalAge, setGoalAge] = useState(25);
  const [goalSex, setGoalSex] = useState("M");
  const [goalActivity, setGoalActivity] = useState(1.55);
  const [goalWeight, setGoalWeight] = useState(settings?.goalWeight || 75);
  const [goalHeight, setGoalHeight] = useState(settings?.height || 175);

  // Refs
  const searchTimeoutRef = useRef(null);
  const scannerActiveRef = useRef(false);
  const videoRef = useRef(null);
  const scanRafRef = useRef(null);
  const scanCanvasRef = useRef(null);
  const scanCtxRef = useRef(null);
  const barcodeDetectorRef = useRef(null);
  const videoStreamRef = useRef(null);
  const verifyCountRef = useRef(0);
  const lastCodeRef = useRef(null);
  const emptyFramesRef = useRef(0);
  const lastProgressRef = useRef(0);

  // ── EXPOSE openAddFood to parent via ref ────────────────
  useImperativeHandle(ref, () => ({
    openAddFood: () => {
      setShowAddSheet("breakfast");
    },
  }));

  // ── DEXIE: Load entries when date changes ───────────────
  useEffect(() => {
    let active = true;
    getFoodEntriesByDate(selectedDate).then((entries) => {
      if (active) setFoodEntries(entries);
    });
    return () => { active = false; };
  }, [selectedDate]);

  // Load recents when bottom sheet meal changes
  useEffect(() => {
    if (!showAddSheet) return;
    let active = true;
    getRecentFoodsByMeal(showAddSheet).then((recents) => {
      if (active) setAddSheetRecents(recents);
    });
    return () => { active = false; };
  }, [showAddSheet]);

  // Sync localGoals with nutritionGoals
  useEffect(() => {
    setLocalGoals(nutritionGoals);
    setManualKcal(nutritionGoals.kcalTarget);
  }, [nutritionGoals]);

  // ── HELPERS ─────────────────────────────────────────────
  const todayStr = new Date().toISOString().split("T")[0];

  const formatDateLabel = (dateStr) => {
    const d = new Date(dateStr + "T12:00:00");
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateStr === todayStr) return "Oggi";
    if (dateStr === yesterday.toISOString().split("T")[0]) return "Ieri";
    if (dateStr === tomorrow.toISOString().split("T")[0]) return "Domani";
    return dayNames[d.getDay()];
  };

  const formatDateSub = (dateStr) => {
    const d = new Date(dateStr + "T12:00:00");
    return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  };

  const changeDate = (delta) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const getWeekDays = () => {
    const days = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(selectedDate + "T12:00:00");
      d.setDate(d.getDate() + i);
      const ds = d.toISOString().split("T")[0];
      days.push({
        date: ds,
        dayNum: d.getDate(),
        dayName: dayNamesShort[d.getDay()],
        isToday: ds === todayStr,
        isSelected: ds === selectedDate,
        hasFoodData: true,
      });
    }
    return days;
  };

  const getMealEntries = (mealType) =>
    foodEntries.filter((e) => e.mealType === mealType);

  const getMealTotals = (mealType) => {
    const entries = getMealEntries(mealType);
    return entries.reduce((acc, e) => ({
      kcal: acc.kcal + (e.kcal || 0),
      protein: acc.protein + (e.protein || 0),
      carbs: acc.carbs + (e.carbs || 0),
      fat: acc.fat + (e.fat || 0),
    }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  };

  const getDayTotals = () => {
    return foodEntries.reduce((acc, e) => ({
      kcal: acc.kcal + (e.kcal || 0),
      protein: acc.protein + (e.protein || 0),
      carbs: acc.carbs + (e.carbs || 0),
      fat: acc.fat + (e.fat || 0),
    }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  };

  const pTarget = Math.round((nutritionGoals.kcalTarget * nutritionGoals.proteinPct) / 100 / 4);
  const cTarget = Math.round((nutritionGoals.kcalTarget * nutritionGoals.carbsPct) / 100 / 4);
  const fTarget = Math.round((nutritionGoals.kcalTarget * nutritionGoals.fatPct) / 100 / 9);

  const calcForPortion = (food, grams) => {
    const m = grams / 100;
    const kcal100 = food.kcalPer100 ?? food.kcal ?? 0;
    const p100 = food.proteinPer100 ?? food.protein ?? 0;
    const c100 = food.carbsPer100 ?? food.carbs ?? 0;
    const f100 = food.fatPer100 ?? food.fat ?? 0;
    return {
      kcal: Math.round(kcal100 * m),
      protein: +(p100 * m).toFixed(1),
      carbs: +(c100 * m).toFixed(1),
      fat: +(f100 * m).toFixed(1),
    };
  };

  const getEmoji = (category) => CATEGORY_EMOJI[category] || "\uD83C\uDF7D\uFE0F";

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  // ── API: OpenFoodFacts ──────────────────────────────────
  const lookupBarcode = async (barcode) => {
    const cached = await getCachedFoodByBarcode(barcode);
    if (cached) return cached;

    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`
      );
      const data = await res.json();
      if (data.status === 1) {
        const p = data.product;
        const n = p.nutriments || {};
        const food = {
          id: `api_${barcode}`,
          name: p.product_name_it || p.product_name || "Prodotto sconosciuto",
          brand: p.brands || "",
          kcalPer100: Math.round(n["energy-kcal_100g"] || 0),
          proteinPer100: +(n.proteins_100g || 0).toFixed(1),
          carbsPer100: +(n.carbohydrates_100g || 0).toFixed(1),
          fatPer100: +(n.fat_100g || 0).toFixed(1),
          fiberPer100: +(n.fiber_100g || 0).toFixed(1),
          barcode,
          defaultPortion: parseFloat(p.serving_quantity) || 100,
          category: p.categories_tags?.[0]?.replace("en:", "") || "Altro",
          source: "api",
          image: p.image_front_small_url || null,
        };
        await cacheFood(food);
        return food;
      }
    } catch (e) { /* network error */ }
    return null;
  };

  // ── BARCODE SCANNER ─────────────────────────────────────
  const initDetector = async () => {
    if (typeof window === "undefined") return "manual";
    if ("BarcodeDetector" in window) {
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        const ean = formats.filter((f) => f.includes("ean") || f.includes("upc") || f.includes("code"));
        barcodeDetectorRef.current = new window.BarcodeDetector({
          formats: ean.length ? ean : ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
        });
        return "native";
      } catch (e) { /* fallthrough */ }
    }
    if (!window.Quagga) {
      try {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js";
          s.onload = res;
          s.onerror = rej;
          document.head.appendChild(s);
        });
      } catch (e) { return "manual"; }
    }
    return "quagga";
  };

  const torchTrackRef = useRef(null);
  const [flashOn, setFlashOn] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const emptyFramesRef = useRef(0);

  const startScanner = async () => {
    setScannerActive(true);
    scannerActiveRef.current = true;
    setScanResult(null);
    setVerifyProgress(0);
    verifyCountRef.current = 0;
    lastCodeRef.current = null;
    emptyFramesRef.current = 0;
    setManualBarcode("");
    setFlashOn(false);
    setScanStatus("Avvio fotocamera...");

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
    } catch (e) {
      setScannerActive(false);
      scannerActiveRef.current = false;
      let msg = "Errore fotocamera.";
      if (e.name === "NotAllowedError") msg = "Permesso fotocamera negato.\n\nVai su Impostazioni → Safari → Fotocamera → Consenti.";
      else if (e.name === "NotFoundError") msg = "Nessuna fotocamera trovata.";
      else if (e.name === "NotReadableError") msg = "Fotocamera occupata da altra app.";
      alert(msg);
      return;
    }

    videoStreamRef.current = stream;
    const tracks = stream.getVideoTracks();
    if (tracks.length) torchTrackRef.current = tracks[0];
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    await video.play();

    setScanStatus("Inizializzazione scanner...");
    let method;
    try { method = await initDetector(); } catch (e) { method = "manual"; }

    if (!scanCanvasRef.current) {
      scanCanvasRef.current = document.createElement("canvas");
      scanCtxRef.current = scanCanvasRef.current.getContext("2d", { willReadFrequently: true, alpha: false });
    }

    if (method === "native") {
      setScanStatus("\uD83D\uDCF7 Punta il barcode");
      const NEEDED = 2;

      const loop = async () => {
        if (!scannerActiveRef.current) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          try {
            const barcodes = await barcodeDetectorRef.current.detect(video);
            if (barcodes.length > 0 && scannerActiveRef.current) {
              const code = barcodes[0].rawValue;
              emptyFramesRef.current = 0;
              if (code === lastCodeRef.current) {
                verifyCountRef.current += 1;
              } else {
                lastCodeRef.current = code;
                verifyCountRef.current = 1;
              }
              const prog = Math.min(verifyCountRef.current, NEEDED);
              if (prog !== lastProgressRef.current) {
                lastProgressRef.current = prog;
                setVerifyProgress(prog);
                const dots = "\u25CF".repeat(prog) + "\u25CB".repeat(NEEDED - prog);
                setScanStatus(`\uD83D\uDCF7 ${dots}`);
              }
              if (verifyCountRef.current >= NEEDED) {
                setScanStatus(`\u2713 ${code}`);
                if (navigator.vibrate) navigator.vibrate([60, 40, 100]);
                stopScanner();
                handleBarcodeDetected(code);
                return;
              }
            } else {
              // No barcode in frame — reset after a few empty frames
              emptyFramesRef.current += 1;
              if (emptyFramesRef.current > 5) {
                lastCodeRef.current = null;
                verifyCountRef.current = 0;
                if (lastProgressRef.current !== 0) { lastProgressRef.current = 0; setVerifyProgress(0); }
                setScanStatus("\uD83D\uDCF7 Punta il barcode");
              }
            }
          } catch (e) { /* ignore */ }
        }
        if (scannerActiveRef.current) scanRafRef.current = requestAnimationFrame(loop);
      };
      scanRafRef.current = requestAnimationFrame(loop);

    } else if (method === "quagga") {
      setScanStatus("\uD83D\uDCF7 Punta il barcode");
      const NEEDED = 2;

      const scanLoop = () => {
        if (!scannerActiveRef.current) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          scanCanvasRef.current.width = video.videoWidth;
          scanCanvasRef.current.height = video.videoHeight;
          scanCtxRef.current.drawImage(video, 0, 0);
          window.Quagga.decodeSingle(
            {
              decoder: { readers: ["ean_reader", "ean_8_reader", "upc_reader", "code_128_reader"] },
              locate: true,
              src: scanCanvasRef.current.toDataURL("image/jpeg", 0.8),
            },
            (result) => {
              if (!scannerActiveRef.current) return;
              if (result && result.codeResult) {
                const code = result.codeResult.code;
                emptyFramesRef.current = 0;
                if (code === lastCodeRef.current) {
                  verifyCountRef.current += 1;
                } else {
                  lastCodeRef.current = code;
                  verifyCountRef.current = 1;
                }
                const prog = Math.min(verifyCountRef.current, NEEDED);
                if (prog !== lastProgressRef.current) {
                  lastProgressRef.current = prog;
                  setVerifyProgress(prog);
                  const dots = "\u25CF".repeat(prog) + "\u25CB".repeat(NEEDED - prog);
                  setScanStatus(`\uD83D\uDCF7 ${dots}`);
                }
                if (verifyCountRef.current >= NEEDED) {
                  setScanStatus(`\u2713 ${code}`);
                  if (navigator.vibrate) navigator.vibrate([60, 40, 100]);
                  stopScanner();
                  handleBarcodeDetected(code);
                  return;
                }
                if (scannerActiveRef.current) setTimeout(scanLoop, 300);
              } else {
                emptyFramesRef.current += 1;
                if (emptyFramesRef.current > 3) {
                  lastCodeRef.current = null;
                  verifyCountRef.current = 0;
                  if (lastProgressRef.current !== 0) { lastProgressRef.current = 0; setVerifyProgress(0); }
                  setScanStatus("\uD83D\uDCF7 Punta il barcode");
                }
                if (scannerActiveRef.current) setTimeout(scanLoop, 300);
              }
            }
          );
        } else {
          if (scannerActiveRef.current) setTimeout(scanLoop, 300);
        }
      };
      setTimeout(scanLoop, 500);

    } else {
      setScanStatus("Inserisci il codice manualmente");
    }
  };

  const stopScanner = () => {
    setScannerActive(false);
    scannerActiveRef.current = false;
    setVerifyProgress(0);
    verifyCountRef.current = 0;
    lastCodeRef.current = null;
    emptyFramesRef.current = 0;
    if (scanRafRef.current) { cancelAnimationFrame(scanRafRef.current); scanRafRef.current = null; }
    // Turn off flash
    if (torchTrackRef.current && flashOn) {
      torchTrackRef.current.applyConstraints?.({ advanced: [{ torch: false }] }).catch(() => {});
      setFlashOn(false);
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((t) => t.stop());
      videoStreamRef.current = null;
      torchTrackRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const toggleFlash = () => {
    if (!torchTrackRef.current) return;
    const next = !flashOn;
    torchTrackRef.current.applyConstraints?.({ advanced: [{ torch: next }] }).catch(() => {});
    setFlashOn(next);
  };

  const handleManualBarcodeSearch = () => {
    const code = manualBarcode.replace(/\D/g, "").trim();
    if (code.length >= 8) {
      stopScanner();
      handleBarcodeDetected(code);
    }
  };

  const handleBarcodeDetected = async (code) => {
    setScanLoading(true);
    const food = await lookupBarcode(code);
    setScanLoading(false);
    if (food) {
      setScanResult(food);
    } else {
      setScanResult({ notFound: true, barcode: code });
    }
  };

  // ── ACTION HANDLERS ─────────────────────────────────────
  const handleAddFood = async (food, mealType, grams) => {
    const vals = calcForPortion(food, grams);
    const entry = {
      date: selectedDate,
      mealType,
      foodName: food.foodName || food.name,
      brand: food.brand || "",
      grams: food.isCheat ? food.grams : grams,
      kcal: food.isCheat ? food.kcal : vals.kcal,
      protein: food.isCheat ? food.protein : vals.protein,
      carbs: food.isCheat ? food.carbs : vals.carbs,
      fat: food.isCheat ? food.fat : vals.fat,
      kcalPer100: food.kcalPer100 || 0,
      proteinPer100: food.proteinPer100 || 0,
      carbsPer100: food.carbsPer100 || 0,
      fatPer100: food.fatPer100 || 0,
      fiberPer100: food.fiberPer100 || 0,
      category: food.category || "Altro",
      source: food.source || "local",
      isCheat: food.isCheat || false,
    };
    await addFoodEntry(entry);
    const updated = await getFoodEntriesByDate(selectedDate);
    setFoodEntries(updated);
    showToast("Cibo aggiunto");
  };

  const handleDeleteEntry = async (id) => {
    await deleteFoodEntry(id);
    setFoodEntries((prev) => prev.filter((e) => e.id !== id));
    showToast("Eliminato");
  };

  const handleUpdateGrams = async (entryId, newGrams) => {
    const entry = foodEntries.find((e) => e.id === entryId);
    if (!entry) return;
    const food = {
      kcalPer100: entry.kcalPer100 || (entry.grams > 0 ? (entry.kcal / entry.grams) * 100 : 0),
      proteinPer100: entry.proteinPer100 || (entry.grams > 0 ? (entry.protein / entry.grams) * 100 : 0),
      carbsPer100: entry.carbsPer100 || (entry.grams > 0 ? (entry.carbs / entry.grams) * 100 : 0),
      fatPer100: entry.fatPer100 || (entry.grams > 0 ? (entry.fat / entry.grams) * 100 : 0),
    };
    const vals = calcForPortion(food, newGrams);
    await updateFoodEntry(entryId, { grams: newGrams, ...vals });
    setFoodEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, grams: newGrams, ...vals } : e))
    );
    setEditingEntry(null);
    showToast("Grammi aggiornati");
  };

  const handleSaveMeal = async (mealType) => {
    if (!saveMealName.trim()) {
      alert("Inserisci un nome per il pasto");
      return;
    }
    const items = getMealEntries(mealType);
    const totalKcal = items.reduce((s, i) => s + i.kcal, 0);
    const newMeal = {
      id: `meal_${Date.now()}`,
      name: saveMealName,
      mealType,
      items,
      totalKcal,
    };
    setSavedMeals((prev) => [...prev, newMeal]);
    setShowSavePopup(null);
    setSaveMealName("");
    showToast("Pasto salvato");
  };

  const handleLoadMeal = async (meal) => {
    for (const item of meal.items) {
      const grams = item.grams || 100;
      await handleAddFood(item, showLoadPopup, grams);
    }
    setShowLoadPopup(null);
    showToast("Pasto caricato");
  };

  // ── GOALS CALCULATIONS ──────────────────────────────────
  const calculateBMR = () => {
    if (goalSex === "M") return 10 * goalWeight + 6.25 * goalHeight - 5 * goalAge + 5;
    return 10 * goalWeight + 6.25 * goalHeight - 5 * goalAge - 161;
  };

  const calculateTDEE = () => Math.round(calculateBMR() * goalActivity);

  const handleSaveGoals = () => {
    const target = useManual ? manualKcal : calculateTDEE();
    setNutritionGoals({ ...localGoals, kcalTarget: target });
    setFoodScreen("dashboard");
  };

  // ─── RENDER FUNCTIONS ──────────────────────────────────

  const renderScanner = () => {
    if (!scannerActive && !scanResult && !scanLoading) return null;

    // Camera active — show video feed with corner viewfinder
    if (scannerActive && !scanResult) {
      return (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000", zIndex: 3000, display: "flex", flexDirection: "column" }}>
          <video ref={videoRef} playsInline autoPlay muted style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />

          {/* Top bar: close + title + flash */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 14px", zIndex: 5, background: "linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)" }}>
            <button onClick={stopScanner} style={{ width: 36, height: 36, background: "rgba(0,0,0,0.4)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "none", color: "#fff", fontSize: 18 }}>✕</button>
            <div style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>Scansiona barcode</div>
            <button onClick={toggleFlash} style={{ width: 36, height: 36, background: flashOn ? "rgba(2,192,154,0.5)" : "rgba(0,0,0,0.4)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "none", fontSize: 20 }}>🔦</button>
          </div>

          {/* Corner viewfinder */}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -55%)", width: 260, height: 140, zIndex: 3, pointerEvents: "none" }}>
            {/* Top-left corner */}
            <div style={{ position: "absolute", top: 0, left: 0, width: 22, height: 22, borderColor: "#02C39A", borderStyle: "solid", borderWidth: "3px 0 0 3px", borderRadius: "4px 0 0 0" }} />
            {/* Top-right corner */}
            <div style={{ position: "absolute", top: 0, right: 0, width: 22, height: 22, borderColor: "#02C39A", borderStyle: "solid", borderWidth: "3px 3px 0 0", borderRadius: "0 4px 0 0" }} />
            {/* Bottom-left corner */}
            <div style={{ position: "absolute", bottom: 0, left: 0, width: 22, height: 22, borderColor: "#02C39A", borderStyle: "solid", borderWidth: "0 0 3px 3px", borderRadius: "0 0 0 4px" }} />
            {/* Bottom-right corner */}
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderColor: "#02C39A", borderStyle: "solid", borderWidth: "0 3px 3px 0", borderRadius: "0 0 4px 0" }} />
            {/* "NUMERI QUI" dashed zone */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 30, background: "rgba(2,192,154,0.15)", border: "1.5px dashed rgba(2,192,154,0.7)", borderRadius: "0 0 4px 4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 9, color: "rgba(2,192,154,0.9)", fontWeight: 600, letterSpacing: 0.5 }}>NUMERI QUI</span>
            </div>
          </div>

          {/* Guide text below viewfinder */}
          <div style={{ position: "absolute", bottom: "calc(50% - 110px)", left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.7)", fontSize: 13, zIndex: 3, pointerEvents: "none" }}>Centra il barcode — i numeri nella zona verde</div>

          {/* Bottom area: status + manual input + search button */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 16px calc(env(safe-area-inset-bottom, 0px) + 20px)", zIndex: 5, background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)" }}>
            {/* Status with dots */}
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.8)", fontSize: 12, marginBottom: 12 }}>
              {scanStatus}
              <span style={{ marginLeft: 8, display: "inline-flex", gap: 5 }}>
                {[1, 2].map((step) => (
                  <span key={step} style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: verifyProgress >= step ? "#02C39A" : "rgba(255,255,255,0.25)", transition: "background 0.15s" }} />
                ))}
              </span>
            </div>

            {/* Numeric input field */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(255,255,255,0.12)", border: "0.5px solid rgba(255,255,255,0.25)", borderRadius: 12, padding: "10px 14px", marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>🔢</span>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={13}
                placeholder="Digita i numeri sotto il barcode"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => { if (e.key === "Enter" && manualBarcode.length >= 8) handleManualBarcodeSearch(); }}
                style={{ flex: 1, background: "none", border: "none", fontSize: 15, color: "#fff", fontFamily: "inherit", outline: "none", caretColor: "#02C39A" }}
              />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>{manualBarcode.length}/13</span>
            </div>

            {/* Search button */}
            <button
              onClick={handleManualBarcodeSearch}
              disabled={manualBarcode.length < 8}
              style={{ width: "100%", background: manualBarcode.length >= 8 ? T.mint : "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: 13, color: "#fff", fontSize: 14, fontWeight: 600, cursor: manualBarcode.length >= 8 ? "pointer" : "default", fontFamily: "inherit", opacity: manualBarcode.length >= 8 ? 1 : 0.5, transition: "all 0.2s" }}
            >
              🔍 Cerca prodotto
            </button>
          </div>

          <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}`}</style>
        </div>
      );
    }

    // Loading after barcode detected
    if (scanLoading) {
      return (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 3000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#02C39A", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <div style={{ color: "#fff", fontSize: 14 }}>Cercando prodotto...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }

    // No result yet
    if (!scanResult) return null;

    if (scanResult.notFound) {
      return (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 24, width: "100%", maxWidth: 340, padding: 24, textAlign: "center", boxShadow: "0 25px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 6 }}>Prodotto non trovato</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 20 }}>Il codice {scanResult.barcode} non è nel database</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => {
                const bc = scanResult.barcode;
                setScanResult(null); setScannerActive(false);
                setShowAddSheet("_barcode_"); setAddSheetView("customFood"); setCustomBarcode(bc);
              }} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: T.gradient, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                Inserisci manualmente
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setScanResult(null); startScanner(); }} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: "#F0F2F5", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: T.textSec }}>Riprova</button>
                <button onClick={() => { setScanResult(null); setScannerActive(false); }} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: "#F0F2F5", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: T.textSec }}>Chiudi</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Product found — show info + Aggiungi button that opens GramEditorModal
    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 24, width: "100%", maxWidth: 340, overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.25)" }}>
          <div style={{ background: T.gradient, padding: "20px 22px 16px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{scanResult.name}</div>
            {scanResult.brand && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{scanResult.brand}</div>}
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{scanResult.kcalPer100} kcal per 100g</div>
          </div>
          <div style={{ padding: "16px 22px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 16, textAlign: "center" }}>
              {[
                { label: "Grassi", value: scanResult.fatPer100, color: "#E85D4E" },
                { label: "Carbo", value: scanResult.carbsPer100, color: "#F0B429" },
                { label: "Proteine", value: scanResult.proteinPer100, color: "#3B82F6" },
              ].map((m) => (
                <div key={m.label}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{m.value}<span style={{ fontSize: 10, fontWeight: 500, color: T.textMuted }}>g</span></div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setScanResult(null); setScannerActive(false); }} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: "#F0F2F5", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: T.textSec }}>Annulla</button>
              <button onClick={() => {
                const food = scanResult;
                setScanResult(null); setScannerActive(false);
                setGramPopup({ food, grams: food.defaultPortion || 100, source: "scan" });
              }} style={{ flex: 1.5, padding: 12, borderRadius: 12, border: "none", background: T.gradient, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Aggiungi</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    const totals = getDayTotals();
    const remaining = nutritionGoals.kcalTarget - totals.kcal;
    const isOver = remaining < 0;
    const pct = Math.min(100, Math.round((totals.kcal / nutritionGoals.kcalTarget) * 100));
    const overPct = isOver ? Math.min(100, Math.round(((totals.kcal - nutritionGoals.kcalTarget) / nutritionGoals.kcalTarget) * 100)) : 0;
    const circumference = 2 * Math.PI * 52;
    const dashOffset = circumference - (pct / 100) * circumference;
    const ringColor = isOver ? T.coral : T.teal;
    const ringBgColor = isOver ? "#FEE2E2" : T.border;
    const weekDays = getWeekDays();
    const macros = [
      { label: "Proteine", value: Math.round(totals.protein), target: pTarget, color: "#3B82F6" },
      { label: "Carbo", value: Math.round(totals.carbs), target: cTarget, color: "#F0B429" },
      { label: "Grassi", value: Math.round(totals.fat), target: fTarget, color: "#E85D4E" },
    ];

    return (
      <div style={{ padding: "0 0 100px" }}>
        {/* ─── Date Navigator ─── */}
        <div style={{ background: T.card, paddingBottom: 6, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 8px" }}>
            <button onClick={() => changeDate(-1)} style={{ width: 36, height: 36, borderRadius: 12, background: T.tealLight, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.teal }}>
              <ChevronLeft size={18} />
            </button>
            <div style={{ textAlign: "center", cursor: "pointer" }} onClick={() => setSelectedDate(todayStr)}>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.text }}>{formatDateLabel(selectedDate)}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>{formatDateSub(selectedDate)}</div>
            </div>
            <button onClick={() => changeDate(1)} style={{ width: 36, height: 36, borderRadius: 12, background: T.tealLight, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.teal }}>
              <ChevronRight size={18} />
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 12px 8px", gap: 2 }}>
            {weekDays.map((day) => (
              <button
                key={day.date}
                onClick={() => setSelectedDate(day.date)}
                style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0 8px",
                  borderRadius: 12, border: "none", cursor: "pointer",
                  background: day.isSelected ? T.gradient : day.isToday ? T.tealLight : "transparent",
                  transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3, color: day.isSelected ? "rgba(255,255,255,0.8)" : T.textMuted }}>
                  {day.dayName}
                </span>
                <span style={{ fontSize: 15, fontWeight: day.isSelected ? 800 : 600, color: day.isSelected ? "#fff" : day.isToday ? T.teal : T.text }}>
                  {day.dayNum}
                </span>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: day.hasFoodData ? (day.isSelected ? "rgba(255,255,255,0.7)" : T.mint) : "transparent" }} />
              </button>
            ))}
          </div>
        </div>

        {/* ─── Calorie Ring Card ─── */}
        <div style={{ background: T.card, borderRadius: 20, boxShadow: T.shadow, margin: "12px 16px", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "20px 20px 14px", gap: 20 }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{ position: "relative" }}>
                <svg width={130} height={130} viewBox="0 0 130 130">
                  <circle cx={65} cy={65} r={52} fill="none" stroke={ringBgColor} strokeWidth={10} />
                  <circle cx={65} cy={65} r={52} fill="none" stroke={ringColor} strokeWidth={10} strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s" }} />
                  {isOver && (
                    <circle cx={65} cy={65} r={52} fill="none" stroke={T.coral} strokeWidth={10} strokeDasharray={circumference} strokeDashoffset={circumference - (overPct / 100) * circumference * 0.15} strokeLinecap="round" opacity={0.3} style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }} />
                  )}
                </svg>
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: isOver ? T.coral : T.text, lineHeight: 1 }}>{totals.kcal}</div>
                  <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>kcal</div>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              {macros.map((m) => {
                const pctMacro = m.target > 0 ? Math.min(100, (m.value / m.target) * 100) : 0;
                const isOverMacro = m.value > m.target;
                return (
                  <div key={m.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: m.color }}>{m.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{m.value}<span style={{ fontSize: 10, color: T.textMuted, fontWeight: 500 }}>/{m.target}g</span></span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "#F0F2F5", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 3, background: isOverMacro ? `linear-gradient(90deg, ${m.color}, ${T.coral})` : m.color, width: `${pctMacro}%`, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", borderTop: `1px solid ${T.border}` }}>
            {[
              { icon: <Target size={14} />, label: "Obiettivo", value: `${nutritionGoals.kcalTarget}`, color: T.teal },
              { icon: <Flame size={14} />, label: "Consumate", value: `${totals.kcal}`, color: isOver ? T.coral : T.gold },
              { icon: <Zap size={14} />, label: isOver ? "Eccesso" : "Rimanenti", value: isOver ? `+${Math.abs(remaining)}` : `${remaining}`, color: isOver ? T.coral : T.mint },
            ].map((stat, i) => (
              <div key={stat.label} style={{ flex: 1, textAlign: "center", padding: "12px 8px", borderLeft: i > 0 ? `1px solid ${T.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ color: stat.color }}>{stat.icon}</span>
                </div>
                <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600 }}>{stat.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginTop: 3 }}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Meal Cards ─── */}
        <div style={{ padding: "12px 16px 20px" }}>
          {MEAL_TYPES.map((mt) => {
            const cfg = MEAL_CONFIG[mt];
            const expanded = expandedMeals[mt];
            const mealEntries = getMealEntries(mt);
            const totals = getMealTotals(mt);
            const count = mealEntries.length;

            return (
              <div key={mt} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: T.card, borderRadius: 14, boxShadow: T.shadow, cursor: "pointer" }} onClick={() => setExpandedMeals((prev) => ({ ...prev, [mt]: !prev[mt] }))}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: cfg.bgColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{cfg.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{cfg.label}</span>
                      {!expanded && count > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, background: cfg.bgColor, padding: "2px 7px", borderRadius: 10 }}>{count} {count === 1 ? "cibo" : "cibi"}</span>}
                    </div>
                  </div>
                  <ValuesRow gr="" g={Math.round(totals.fat)} c={Math.round(totals.carbs)} p={Math.round(totals.protein)} kcal={totals.kcal}
                    grColor="transparent" gColor="#E85D4E" cColor="#F0B429" pColor="#3B82F6" kcalColor={totals.kcal > 0 ? T.text : T.textMuted} fontSize={11} fontWeight={700} />
                  <ChevronDown size={14} color="#ccc" style={{ transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0)", flexShrink: 0 }} />
                </div>

                {expanded && (
                  <div style={{ background: T.card, borderRadius: "0 0 14px 14px", boxShadow: T.shadow, marginTop: -1, overflow: "hidden" }}>
                    {/* Meal header with columns */}
                    <div style={{ padding: "8px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: "uppercase" }}>Alimento</div>
                      <ValuesRow gr="gr" g="G" c="C" p="P" kcal="kcal"
                        grColor={T.mint} gColor="#E85D4E" cColor="#F0B429" pColor="#3B82F6" kcalColor={T.text} fontSize={9} fontWeight={700} />
                      <div style={{ width: 22, flexShrink: 0 }} />
                    </div>

                    {mealEntries.length > 0 && (
                      <div style={{ borderTop: `1px solid ${T.border}` }}>
                        {mealEntries.map((entry) => (
                          <SwipeableItem key={entry.id} entry={entry} onDelete={handleDeleteEntry}
                            onTap={(e) => { if (!e.isCheat) setEditingEntry({ id: e.id, mealType: mt }); }} T={T} />
                        ))}
                      </div>
                    )}

                    {mealEntries.length === 0 && (
                      <div style={{ borderTop: `1px solid ${T.border}`, padding: "20px 16px", textAlign: "center" }}>
                        <div style={{ fontSize: 24, marginBottom: 6 }}>{cfg.icon}</div>
                        <div style={{ fontSize: 12, color: T.textMuted }}>Nessun cibo registrato</div>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 6, padding: "8px 12px 12px", borderTop: mealEntries.length > 0 ? `1px solid ${T.border}` : "none" }}>
                      <button onClick={(e) => { e.stopPropagation(); setShowAddSheet(mt); }} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "9px 12px", borderRadius: 10, border: `1.5px dashed ${T.border}`, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, color: T.teal }}>
                        <Plus size={14} /> Aggiungi cibo
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setShowLoadPopup(mt); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${T.border}`, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, color: T.purple }}>
                        <Download size={13} /> Carica pasto
                      </button>
                      {mealEntries.length >= 2 && (
                        <button onClick={(e) => { e.stopPropagation(); setShowSavePopup(mt); setSaveMealName(""); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "9px 10px", borderRadius: 10, border: `1.5px solid ${T.border}`, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, color: T.gold, flexShrink: 0 }}>
                          <Bookmark size={13} /> Salva
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Edit gram modal */}
        {editingEntry && foodEntries.find(e => e.id === editingEntry.id) && !foodEntries.find(e => e.id === editingEntry.id).isCheat && (
          <GramEditorModal entry={foodEntries.find(e => e.id === editingEntry.id)} onSave={(g) => handleUpdateGrams(editingEntry.id, g)} onClose={() => setEditingEntry(null)} T={T} />
        )}

        {/* Save meal popup */}
        {showSavePopup && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowSavePopup(null)}>
            <div style={{ background: "#fff", borderRadius: 22, width: "100%", maxWidth: 320, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
              <Bookmark size={28} color={T.gold} style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>Salva Pasto</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>Salva i {getMealEntries(showSavePopup).length} cibi come pasto riutilizzabile</div>
              <input type="text" value={saveMealName} onChange={(e) => setSaveMealName(e.target.value)} placeholder={`Es. "${MEAL_CONFIG[showSavePopup].label} tipo"`} autoFocus
                style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${T.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", color: T.text, marginBottom: 16, boxSizing: "border-box" }} />
              <div style={{ background: "#F8F9FB", borderRadius: 12, padding: 10, marginBottom: 16, textAlign: "left", maxHeight: 150, overflowY: "auto" }}>
                {getMealEntries(showSavePopup).map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "5px 0", alignItems: "baseline", borderBottom: i < getMealEntries(showSavePopup).length - 1 ? `1px solid ${T.border}` : "none" }}>
                    <span style={{ fontSize: 11, color: T.text, flex: 1 }}>{item.isCheat && "🍕 "}{item.foodName}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: T.mint }}>{item.grams ? `${item.grams}g` : "—"}</span>
                    <span style={{ fontSize: 10, color: T.textMuted }}>{item.kcal} kcal</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowSavePopup(null)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: "#F0F0F0", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: T.textSec }}>Annulla</button>
                <button onClick={() => handleSaveMeal(showSavePopup)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: T.gradient, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Salva</button>
              </div>
            </div>
          </div>
        )}

        {/* Load meal sheet */}
        {showLoadPopup && (
          <LoadMealSheet mealType={showLoadPopup} savedMeals={savedMeals} onLoad={handleLoadMeal}
            onDelete={(id) => { setSavedMeals((p) => p.filter((m) => m.id !== id)); showToast("Eliminato"); }}
            onClose={() => setShowLoadPopup(null)} T={T} />
        )}

        {/* Add food sheet */}
        {showAddSheet && (
          <AddFoodSheet mealType={showAddSheet === "_barcode_" ? addSheetMeal : showAddSheet} recents={addSheetRecents}
            onAdd={handleAddFood}
            onClose={() => { setShowAddSheet(null); setAddSheetView("main"); setCustomBarcode(null); }}
            onScannerOpen={() => { setShowAddSheet(null); startScanner(); }}
            T={T}
            initialView={addSheetView}
            initialBarcode={customBarcode} />
        )}

        {/* Gram editor modal for scanned products */}
        {gramPopup && gramPopup.source === "scan" && (
          <GramEditorModal
            entry={{ foodName: gramPopup.food.name || gramPopup.food.foodName, brand: gramPopup.food.brand, kcalPer100: gramPopup.food.kcalPer100, proteinPer100: gramPopup.food.proteinPer100, carbsPer100: gramPopup.food.carbsPer100, fatPer100: gramPopup.food.fatPer100, grams: gramPopup.grams }}
            onSave={async (g) => {
              const food = gramPopup.food;
              const m = g / 100;
              const meal = gramPopup.meal || addSheetMeal || "breakfast";
              const entry = {
                date: selectedDate, mealType: meal,
                foodName: food.name || food.foodName, brand: food.brand || "", grams: g,
                kcal: Math.round((food.kcalPer100||0)*m), protein: +((food.proteinPer100||0)*m).toFixed(1),
                carbs: +((food.carbsPer100||0)*m).toFixed(1), fat: +((food.fatPer100||0)*m).toFixed(1),
                kcalPer100: food.kcalPer100||0, proteinPer100: food.proteinPer100||0,
                carbsPer100: food.carbsPer100||0, fatPer100: food.fatPer100||0,
                category: food.category || "Altro", source: food.source || "api",
              };
              await addFoodEntry(entry);
              cacheFood({ id: food.id || `api_${food.barcode||Date.now()}`, name: food.name||food.foodName, brand: food.brand||"", kcalPer100: food.kcalPer100||0, proteinPer100: food.proteinPer100||0, carbsPer100: food.carbsPer100||0, fatPer100: food.fatPer100||0, defaultPortion: g, category: food.category||"Altro", barcode: food.barcode||null, source: food.source||"api" }).catch(()=>{});
              const updated = await getFoodEntriesByDate(selectedDate);
              setFoodEntries(updated);
              setGramPopup(null);
              showToast(`${food.name||food.foodName} aggiunto`);
            }}
            onClose={() => setGramPopup(null)}
            T={T}
          />
        )}

        {/* Toast */}
        {toast && (
          <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: T.text, color: "#fff", padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 30px rgba(0,0,0,0.15)", zIndex: 2000, animation: "fadeInUp 0.3s ease", whiteSpace: "nowrap" }}>
            <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
            <Check size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />{toast}
          </div>
        )}
      </div>
    );
  };

  const renderGoals = () => {
    return (
      <div style={{ padding: "20px 16px 100px", minHeight: "100vh", background: T.bg }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 20 }}>Impostazioni Obiettivi</div>

        <div style={{ background: T.card, borderRadius: 16, padding: 20, marginBottom: 20, boxShadow: T.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>Metodo di calcolo</div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 12 }}>
              <input type="radio" checked={!useManual} onChange={() => setUseManual(false)} style={{ width: 18, height: 18, cursor: "pointer" }} />
              <span style={{ fontSize: 14, color: T.text, fontWeight: 500 }}>Calcola da peso/altezza</span>
            </label>

            {!useManual && (
              <div style={{ background: T.tealLight, padding: 14, borderRadius: 12, marginLeft: 28 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 6 }}>Sesso</label>
                    <select value={goalSex} onChange={(e) => setGoalSex(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "none", fontSize: 13, fontFamily: "inherit" }}>
                      <option value="M">Uomo</option>
                      <option value="F">Donna</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 6 }}>Età</label>
                    <input type="number" value={goalAge} onChange={(e) => setGoalAge(parseInt(e.target.value) || 25)} min="10" max="120" style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "none", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 6 }}>Peso (kg)</label>
                    <input type="number" value={goalWeight} onChange={(e) => setGoalWeight(parseInt(e.target.value) || 75)} min="30" max="200" style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "none", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 6 }}>Altezza (cm)</label>
                    <input type="number" value={goalHeight} onChange={(e) => setGoalHeight(parseInt(e.target.value) || 175)} min="100" max="250" style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "none", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 6 }}>Attività fisica</label>
                  <select value={goalActivity} onChange={(e) => setGoalActivity(parseFloat(e.target.value))} style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "none", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}>
                    <option value="1.2">Sedentaria</option>
                    <option value="1.375">Lieve (1-3 giorni/sett)</option>
                    <option value="1.55">Moderata (3-5 giorni/sett)</option>
                    <option value="1.725">Intenso (6-7 giorni/sett)</option>
                    <option value="1.9">Molto intenso</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="radio" checked={useManual} onChange={() => setUseManual(true)} style={{ width: 18, height: 18, cursor: "pointer" }} />
              <span style={{ fontSize: 14, color: T.text, fontWeight: 500 }}>Inserisci manualmente</span>
            </label>

            {useManual && (
              <div style={{ background: "#F0F2F5", padding: 14, borderRadius: 12, marginLeft: 28, marginTop: 10 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 6 }}>kcal giornaliere</label>
                <input type="number" value={manualKcal} onChange={(e) => setManualKcal(parseInt(e.target.value) || 2000)} min="1000" max="10000" style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "none", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
            )}
          </div>
        </div>

        <div style={{ background: T.card, borderRadius: 16, padding: 20, marginBottom: 20, boxShadow: T.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>Distribuzione Macro</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { label: "Proteine", key: "proteinPct", color: "#3B82F6" },
              { label: "Carbs", key: "carbsPct", color: "#F0B429" },
              { label: "Grassi", key: "fatPct", color: "#E85D4E" },
            ].map((m) => (
              <div key={m.key} style={{ background: "#F0F2F5", padding: 12, borderRadius: 12 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: m.color, marginBottom: 8 }}>{m.label}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" min="0" max="100" value={localGoals[m.key]} onChange={(e) => setLocalGoals((prev) => ({ ...prev, [m.key]: parseInt(e.target.value) }))} style={{ flex: 1 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.text, minWidth: 30 }}>{localGoals[m.key]}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleSaveGoals} style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: T.gradient, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", marginBottom: 10 }}>
          Salva Obiettivi
        </button>
        <button onClick={() => setFoodScreen("dashboard")} style={{ width: "100%", padding: 16, borderRadius: 14, border: `1.5px solid ${T.border}`, background: "transparent", color: T.text, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
          Annulla
        </button>
      </div>
    );
  };

  const renderReports = () => {
    const chartData = [];
    for (let i = -6; i <= 0; i++) {
      const d = new Date(selectedDate + "T12:00:00");
      d.setDate(d.getDate() + i);
      const ds = d.toISOString().split("T")[0];
      const dayData = getFoodEntriesByDate(ds);
      const kcal = dayData.reduce((s, e) => s + (e.kcal || 0), 0);
      chartData.push({ name: dayNamesShort[d.getDay()], kcal });
    }
    chartData.reverse();

    const pieData = [];
    const dayTotals = getDayTotals();
    if (dayTotals.protein > 0) pieData.push({ name: "Proteine", value: Math.round(dayTotals.protein * 4), color: "#3B82F6" });
    if (dayTotals.carbs > 0) pieData.push({ name: "Carbs", value: Math.round(dayTotals.carbs * 4), color: "#F0B429" });
    if (dayTotals.fat > 0) pieData.push({ name: "Grassi", value: Math.round(dayTotals.fat * 9), color: "#E85D4E" });

    return (
      <div style={{ padding: "20px 16px 100px", background: T.bg }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 20 }}>Report Calorie</div>

        <div style={{ background: T.card, borderRadius: 16, padding: 16, boxShadow: T.shadow, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>
            <BarChart3 size={16} style={{ verticalAlign: "middle", marginRight: 6 }} color={T.teal} />
            Calorie Settimanali
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: T.textMuted }} />
              <YAxis tick={{ fontSize: 10, fill: T.textMuted }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: T.shadow, fontSize: 12 }} />
              <ReferenceLine y={nutritionGoals.kcalTarget} stroke={T.coral} strokeDasharray="5 5" />
              <Bar dataKey="kcal" fill={T.teal} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {pieData.length > 0 && (
          <div style={{ background: T.card, borderRadius: 16, padding: 16, boxShadow: T.shadow, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>
              Ripartizione Macros (oggi)
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <ResponsiveContainer width="50%" height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" startAngle={90} endAngle={-270}>
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {pieData.map((d) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} />
                    <span style={{ fontSize: 12, color: T.textSec }}>{d.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.text, marginLeft: "auto" }}>{d.value} kcal</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "Media kcal", value: `${Math.round(chartData.reduce((s, d) => s + d.kcal, 0) / 7)}`, icon: <Flame size={16} color={T.coral} /> },
            { label: "Obiettivo", value: `${nutritionGoals.kcalTarget}`, icon: <Target size={16} color={T.teal} /> },
            { label: "Giorno max", value: `${Math.max(...chartData.map((d) => d.kcal))}`, icon: <TrendingUp size={16} color={T.gold} /> },
            { label: "Giorno min", value: `${Math.min(...chartData.map((d) => d.kcal))}`, icon: <Activity size={16} color="#3B82F6" /> },
          ].map((stat) => (
            <div key={stat.label} style={{ background: T.card, borderRadius: 14, padding: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                {stat.icon}
                <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 600 }}>{stat.label}</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── MAIN RETURN ───────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {foodScreen === "dashboard" && renderDashboard()}
      {foodScreen === "goals" && renderGoals()}
      {foodScreen === "reports" && renderReports()}

      {renderScanner()}
    </div>
  );
});

FoodSection.displayName = "FoodSection";
export default FoodSection;
