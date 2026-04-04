"use client";
// FoodSection.jsx — Complete food tracking module with Card 2 Meal Cards
// Features: calorie ring, macro cards, meal diary, barcode scanner,
// OpenFoodFacts API, local caching (Dexie), bottom sheet, gram editor modal,
// custom food forms, cheat food, save/load meals, nutrition goals, reports
import React, {
  useState, useEffect, useRef, useCallback,
  forwardRef, useImperativeHandle,
} from "react";
import {
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Search, Plus, X, Check, ChevronLeft, ChevronRight, ChevronDown,
  ChevronUp, Trash2, Camera, Target, BarChart3, Calendar,
  Clock, Star, Flame, Activity, TrendingUp, ScanLine, Settings, Zap,
  Bookmark, Download, Minus, Pizza, ArrowLeft,
} from "lucide-react";
import { FOOD_DATABASE as EXTERNAL_DB } from "./food-database";
import {
  getFoodEntriesByDate, addFoodEntry,
  deleteFoodEntry, updateFoodEntry, cacheFood,
  getCachedFoodByBarcode, searchCachedFoods,
  getRecentFoodsByMeal, getAllCachedFoods, getLastEntryByFoodName,
  getDailyTotalsForRange, getFoodEntriesByDateRange, getGoalForDate,
  getSavedMeals, addSavedMeal, deleteSavedMeal,
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

// ─── MACRO COLORS ──────────────────────────────────────
const MC = { fat: "#E85D4E", carbs: "#F0B429", protein: "#3B82F6" };

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

// ─── SWIPEABLE ITEM (REPLACED) ──────────────────────────
const SwipeableItem = ({ entry, onDelete, onTap, T }) => {
  const [offsetX, setOffsetX] = useState(0);
  const swipingRef = useRef(false);
  const startXRef = useRef(0);
  const baseRef = useRef(0);

  return (
    <div style={{ position: "relative", overflow: "hidden", borderBottom: `1px solid ${T.border}` }}>
      <div role="button" aria-label="Elimina alimento" style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 75, background: T.coral, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }} onClick={() => onDelete(entry.id)}>
        <Trash2 size={18} color="#fff" />
      </div>
      <div
        style={{ display: "flex", alignItems: "center", padding: "10px 14px 10px 12px", background: T.card, position: "relative", zIndex: 2, transform: `translateX(${-offsetX}px)`, transition: swipingRef.current ? "none" : "transform 0.25s ease", cursor: "pointer" }}
        onTouchStart={(e) => { startXRef.current = e.touches[0].clientX; baseRef.current = offsetX; swipingRef.current = true; }}
        onTouchMove={(e) => { if (!swipingRef.current) return; setOffsetX(Math.max(0, Math.min(75, baseRef.current + (startXRef.current - e.touches[0].clientX)))); }}
        onTouchEnd={() => { swipingRef.current = false; setOffsetX((prev) => (prev > 35 ? 75 : 0)); }}
        onClick={() => { if (offsetX === 0 && onTap) onTap(entry); }}
      >
        {entry.isCheat && <span style={{ fontSize: 14, marginRight: 4, flexShrink: 0 }}>🍕</span>}
        <span style={{ fontSize: 12, fontWeight: 700, color: T.mint, width: 36, textAlign: "right", flexShrink: 0, marginRight: 10 }}>{entry.grams ? `${entry.grams}g` : "—"}</span>
        <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.foodName}
          {entry.brand && <span style={{ fontSize: 10, fontWeight: 400, color: T.textMuted, marginLeft: 5 }}>{entry.brand}</span>}
        </div>
        <div style={{ display: "flex", gap: 0, flexShrink: 0 }}>
          <span style={{ width: 28, textAlign: "right", fontSize: 11, fontWeight: 700, color: "#3B82F6" }}>{Math.round(entry.protein)}</span>
          <span style={{ width: 28, textAlign: "right", fontSize: 11, fontWeight: 700, color: "#F0B429" }}>{Math.round(entry.carbs)}</span>
          <span style={{ width: 28, textAlign: "right", fontSize: 11, fontWeight: 700, color: "#E85D4E" }}>{Math.round(entry.fat)}</span>
          <span style={{ width: 40, textAlign: "right", fontSize: 12, fontWeight: 800, color: T.text }}>{entry.kcal}</span>
        </div>
      </div>
    </div>
  );
};

// ─── GRAM EDITOR MODAL (REPLACED renderGramPopup) ───────
const GramEditorModal = ({ entry, onSave, onClose, onMoveMeal, currentMealType, T }) => {
  const [grams, setGrams] = useState(entry.grams || entry.lastGrams || 100);
  const [showNumpad, setShowNumpad] = useState(false);
  const [numpadBuf, setNumpadBuf] = useState("");
  const [showMovePicker, setShowMovePicker] = useState(false);
  const m = grams / 100;
  const pv = { kcal: Math.round((entry.kcalPer100||0)*m), protein: +((entry.proteinPer100||0)*m).toFixed(1), carbs: +((entry.carbsPer100||0)*m).toFixed(1), fat: +((entry.fatPer100||0)*m).toFixed(1) };

  const openNumpad = () => { setShowNumpad(true); setNumpadBuf(String(grams)); };
  const numpadType = (digit) => {
    const next = numpadBuf === "0" ? digit : (numpadBuf + digit).slice(0, 5);
    setNumpadBuf(next); setGrams(parseInt(next) || 0);
  };
  const numpadDel = () => {
    const next = numpadBuf.slice(0, -1);
    setNumpadBuf(next); setGrams(parseInt(next) || 0);
  };
  const numpadDone = () => { if (grams < 1) setGrams(1); setShowNumpad(false); };

  const stepBtnStyle = (big) => ({
    width: big ? 40 : 36, height: big ? 40 : 36, borderRadius: big ? 12 : 10,
    border: `1.5px solid ${T.border}`, background: "#fff", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: big ? 11 : 16, fontWeight: big ? 700 : 600, color: big ? T.textMuted : T.text,
    fontFamily: "inherit",
  });

  const numBtnStyle = { height: 44, borderRadius: 12, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 18, fontWeight: 600, color: T.text, cursor: "pointer", fontFamily: "inherit" };

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
          {/* Gram controls: -10, -1, [number], +1, +10 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 18 }}>
            <button onClick={() => setGrams(Math.max(1, grams - 10))} aria-label="-10g" style={stepBtnStyle(true)}>-10</button>
            <button onClick={() => setGrams(Math.max(1, grams - 1))} aria-label="-1g" style={stepBtnStyle(false)}>−</button>
            <div style={{ position: "relative" }}>
              <div onClick={openNumpad} style={{
                width: 90, height: 52, borderRadius: 16, border: `2px solid ${showNumpad ? T.mint : T.teal}`,
                textAlign: "center", fontSize: 26, fontWeight: 800, color: T.text,
                background: showNumpad ? `${T.mint}18` : T.tealLight,
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                boxShadow: showNumpad ? `0 0 0 3px ${T.mint}22` : "none", transition: "all 0.2s",
              }}>{grams}</div>
              <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 700, color: T.teal, background: "#fff", padding: "0 6px" }}>grammi</div>
            </div>
            <button onClick={() => setGrams(grams + 1)} aria-label="+1g" style={stepBtnStyle(false)}>+</button>
            <button onClick={() => setGrams(grams + 10)} aria-label="+10g" style={stepBtnStyle(true)}>+10</button>
          </div>

          {/* Numpad — only shown when tapping the number */}
          {showNumpad && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, maxWidth: 220, margin: "0 auto 16px" }}>
              {["1","2","3","4","5","6","7","8","9"].map(d => (
                <button key={d} onClick={() => numpadType(d)} style={numBtnStyle}>{d}</button>
              ))}
              <button onClick={numpadDel} style={{ ...numBtnStyle, fontSize: 14, color: T.coral }}>⌫</button>
              <button onClick={() => numpadType("0")} style={numBtnStyle}>0</button>
              <button onClick={numpadDone} style={{ ...numBtnStyle, background: T.gradient, color: "#fff", border: "none", fontSize: 14, fontWeight: 700 }}>OK</button>
            </div>
          )}

          {/* Macro preview */}
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

          {/* Move to meal picker */}
          {onMoveMeal && currentMealType && (
            showMovePicker ? (
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {MEAL_TYPES.filter(mt => mt !== currentMealType).map((mt) => {
                  const cfg = MEAL_CONFIG[mt];
                  return (
                    <button key={mt} onClick={() => { onMoveMeal(entry.id, mt); }} style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: `1.5px solid ${cfg.color}`, background: cfg.bgColor, cursor: "pointer", textAlign: "center", fontFamily: "inherit" }}>
                      <div style={{ fontSize: 14 }}>{cfg.icon}</div>
                      <div style={{ fontSize: 8, fontWeight: 600, color: cfg.color, marginTop: 2 }}>{cfg.label}</div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <button onClick={() => setShowMovePicker(true)} style={{ width: "100%", padding: "8px 14px", marginBottom: 14, borderRadius: 10, border: `1.5px dashed ${T.border}`, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, color: T.textSec, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                ↔ Sposta in altro pasto
              </button>
            )
          )}

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
        <button onClick={onBack} aria-label="Torna indietro" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", color: T.text }}><ArrowLeft size={20} /></button>
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
        <input type="tel" inputMode="numeric" pattern="[0-9]*" value={kcalPer100} onChange={(e) => setKcalPer100(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${T.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", color: T.text, boxSizing: "border-box" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 5 }}>Proteine (g)</label>
          <input type="tel" inputMode="numeric" pattern="[0-9]*" value={proteinPer100} onChange={(e) => setProteinPer100(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0"
            style={{ width: "100%", padding: "10px 10px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", color: T.text, boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 5 }}>Carbs (g)</label>
          <input type="tel" inputMode="numeric" pattern="[0-9]*" value={carbsPer100} onChange={(e) => setCarbsPer100(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0"
            style={{ width: "100%", padding: "10px 10px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", color: T.text, boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 5 }}>Grassi (g)</label>
          <input type="tel" inputMode="numeric" pattern="[0-9]*" value={fatPer100} onChange={(e) => setFatPer100(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0"
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
        <button onClick={onBack} aria-label="Torna indietro" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", color: T.text }}><ArrowLeft size={20} /></button>
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
        <input type="tel" inputMode="numeric" pattern="[0-9]*" value={totalKcal} onChange={(e) => setTotalKcal(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${T.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", color: T.text, boxSizing: "border-box" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 5 }}>Proteine (g)</label>
          <input type="tel" inputMode="numeric" pattern="[0-9]*" value={totalProtein} onChange={(e) => setTotalProtein(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0"
            style={{ width: "100%", padding: "10px 10px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", color: T.text, boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 5 }}>Carbs (g)</label>
          <input type="tel" inputMode="numeric" pattern="[0-9]*" value={totalCarbs} onChange={(e) => setTotalCarbs(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0"
            style={{ width: "100%", padding: "10px 10px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", color: T.text, boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 5 }}>Grassi (g)</label>
          <input type="tel" inputMode="numeric" pattern="[0-9]*" value={totalFat} onChange={(e) => setTotalFat(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0"
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
  // Show all saved meals, sorted: current mealType first, then the rest
  const sorted = [...savedMeals].sort((a, b) => {
    if (a.mealType === mealType && b.mealType !== mealType) return -1;
    if (a.mealType !== mealType && b.mealType === mealType) return 1;
    return 0;
  });

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", zIndex: 900, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", width: "100%", maxWidth: 440, borderRadius: "24px 24px 0 0", maxHeight: "70vh", display: "flex", flexDirection: "column", animation: "slideUp .3s ease-out" }} onClick={(e) => e.stopPropagation()}>
        <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        <div style={{ width: 36, height: 4, background: "#ddd", borderRadius: 2, margin: "10px auto" }} />
        <div style={{ padding: "4px 20px 12px" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Carica Pasto</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Tutti i pasti salvati</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 10px" }}>
          {sorted.length === 0 ? (
            <div style={{ textAlign: "center", padding: 30, color: T.textMuted, fontSize: 13 }}>Nessun pasto salvato</div>
          ) : (
            sorted.map((meal) => {
              const totP = meal.items.reduce((s, i) => s + (i.protein || 0), 0);
              const totC = meal.items.reduce((s, i) => s + (i.carbs || 0), 0);
              const totG = meal.items.reduce((s, i) => s + (i.fat || 0), 0);
              const cfg = MEAL_CONFIG[meal.mealType] || { emoji: "🍽️", label: meal.mealType };
              const isCurrent = meal.mealType === mealType;
              return (
                <div key={meal.id} style={{ padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{meal.name}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: isCurrent ? `${T.teal}18` : "#f3f4f6", color: isCurrent ? T.teal : T.textMuted }}>{cfg.emoji} {cfg.label}</span>
                      </div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{meal.items.length} cibi • {meal.totalKcal} kcal</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#E85D4E" }}>{Math.round(totG)}G</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#F0B429" }}>{Math.round(totC)}C</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#3B82F6" }}>{Math.round(totP)}P</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => onLoad(meal)} aria-label={`Carica pasto ${meal.name}`} style={{ padding: "6px 12px", borderRadius: 10, border: "none", background: T.gradient, color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>Carica</button>
                      <button onClick={() => onDelete(meal.id)} aria-label={`Elimina pasto ${meal.name}`} style={{ padding: "6px 8px", borderRadius: 10, border: "none", background: "#FEE2E2", color: T.coral, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>Elimina</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// ─── COPY DAY SHEET ─────────────────────────────────────

// ─── ADD FOOD SHEET (REPLACED renderBottomSheet) ────────
const AddFoodSheet = ({ mealType: initialMealType, recents, onAdd, onClose, onScannerOpen, T, initialView, initialBarcode }) => {
  const [activeMeal, setActiveMeal] = useState(initialMealType);
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
            // Deduplicate: skip API results whose name matches a local result
            setResults((prev) => {
              const existingNames = new Set(prev.map(r => (r.foodName || r.name || "").toLowerCase()));
              const unique = apiResults.filter(r => !existingNames.has((r.foodName || "").toLowerCase()));
              return [...prev, ...unique];
            });
          }
        } catch (e) { /* */ }
      }, 500);
    }
  }, []);

  const [editingFood, setEditingFood] = useState(null); // key of food being gram-edited

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

  const updateGramsForFood = (key, newGrams) => {
    setSelections((prev) => {
      const next = new Map(prev);
      const entry = next.get(key);
      if (entry) next.set(key, { ...entry, grams: Math.max(1, newGrams) });
      return next;
    });
  };

  const handleAddSelected = () => {
    haptic(15);
    for (const [, sel] of selections) {
      onAdd(sel.food, activeMeal, sel.grams);
    }
    onClose();
  };

  if (view === "customFood") {
    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", zIndex: 900, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
        <div style={{ background: "#fff", width: "100%", maxWidth: 440, borderRadius: "24px 24px 0 0", maxHeight: "85vh", display: "flex", flexDirection: "column", animation: "slideUp .3s ease-out" }} onClick={(e) => e.stopPropagation()}>
          <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
          <CustomFoodForm onSave={(food) => { onAdd(food, activeMeal, 100); onClose(); }} onBack={() => setView("main")} T={T} initialBarcode={customBarcode} />
        </div>
      </div>
    );
  }

  if (view === "cheat") {
    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", zIndex: 900, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
        <div style={{ background: "#fff", width: "100%", maxWidth: 440, borderRadius: "24px 24px 0 0", maxHeight: "85vh", display: "flex", flexDirection: "column", animation: "slideUp .3s ease-out" }} onClick={(e) => e.stopPropagation()}>
          <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
          <CheatFoodForm onSave={(food) => { onAdd(food, activeMeal, food.grams); onClose(); }} onBack={() => setView("main")} T={T} />
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Aggiungi Cibo</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setView("cheat")} aria-label="Aggiungi sgarro" style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${T.coral}`, background: "rgba(232,93,78,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, flexShrink: 0 }}>🍕</button>
              <button onClick={onClose} aria-label="Chiudi" style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: "#F0F2F5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.textSec }}><X size={16} /></button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {MEAL_TYPES.map((mt) => {
              const cfg = MEAL_CONFIG[mt];
              const sel = activeMeal === mt;
              return (
                <button key={mt} onClick={() => setActiveMeal(mt)} style={{ flex: 1, padding: "10px 4px", borderRadius: 12, border: sel ? `2px solid ${T.teal}` : "2px solid #eee", background: sel ? T.tealLight : "#fff", cursor: "pointer", textAlign: "center", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 16 }}>{cfg.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: sel ? T.teal : T.textSec, marginTop: 3 }}>{cfg.label}</div>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", background: "#F5F7FA", borderRadius: 14, padding: "10px 14px", gap: 10, marginBottom: 12 }}>
            <Search size={18} color="#bbb" />
            <input type="text" value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="Cerca alimento..." style={{ flex: 1, border: "none", background: "none", fontSize: 14, fontFamily: "inherit", outline: "none", color: T.text }} />
            <button onClick={onScannerOpen} aria-label="Scansiona codice a barre" style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: T.gradient, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Camera size={16} /></button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 10px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
            {search.length >= 2 ? "Risultati" : `Recenti per ${MEAL_CONFIG[activeMeal].label}`}
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
            const pm = portion / 100;
            const isEditing = editingFood === `${key}-${idx}`;

            return (
              <div key={`${key}-${idx}`} style={{ borderBottom: `1px solid ${T.border}` }}>
                {/* Main row: grams | name+brand | P C G kcal | checkbox */}
                <div style={{ display: "flex", alignItems: "center", padding: "10px 0", gap: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.mint, width: 36, textAlign: "right", flexShrink: 0, marginRight: 10 }}>{portion}g</span>
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => {
                    // Clicking food name: auto-select if not selected, then open gram editor
                    if (!isSelected) toggleSelection(food);
                    setEditingFood(isEditing ? null : `${key}-${idx}`);
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {key}
                      {food.brand && <span style={{ fontSize: 10, fontWeight: 400, color: T.textMuted, marginLeft: 5 }}>{food.brand}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 0, flexShrink: 0 }}>
                    <span style={{ width: 28, textAlign: "right", fontSize: 11, fontWeight: 700, color: "#3B82F6" }}>{Math.round((food.proteinPer100 || 0) * pm)}</span>
                    <span style={{ width: 28, textAlign: "right", fontSize: 11, fontWeight: 700, color: "#F0B429" }}>{Math.round((food.carbsPer100 || 0) * pm)}</span>
                    <span style={{ width: 28, textAlign: "right", fontSize: 11, fontWeight: 700, color: "#E85D4E" }}>{Math.round((food.fatPer100 || 0) * pm)}</span>
                    <span style={{ width: 40, textAlign: "right", fontSize: 12, fontWeight: 800, color: T.text }}>{Math.round(k100 * pm)}</span>
                  </div>
                  <div onClick={() => toggleSelection(food)} style={{
                    width: 22, height: 22, borderRadius: 6, marginLeft: 10,
                    border: isSelected ? `2px solid ${T.teal}` : "2px solid #ddd",
                    background: isSelected ? T.teal : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, cursor: "pointer", transition: "all 0.2s", color: "#fff", fontSize: 13,
                  }}>
                    {isSelected && <Check size={14} />}
                  </div>
                </div>

                {/* Inline gram editor (opens when tapping food name) */}
                {isEditing && isSelected && (() => {
                  const sel = selections.get(key);
                  const g = sel ? sel.grams : portion;
                  const em = g / 100;
                  const stepBtn = (big) => ({
                    width: big ? 36 : 30, height: big ? 36 : 30, borderRadius: big ? 10 : 8,
                    border: `1.5px solid ${T.border}`, background: "#fff", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: big ? 10 : 14, fontWeight: big ? 700 : 600, color: big ? T.textMuted : T.text,
                    fontFamily: "inherit",
                  });
                  return (
                    <div style={{ padding: "6px 0 12px", background: `${T.teal}04`, borderRadius: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: 8 }}>
                        <button onClick={() => updateGramsForFood(key, g - 10)} style={stepBtn(true)}>-10</button>
                        <button onClick={() => updateGramsForFood(key, g - 1)} style={stepBtn(false)}>−</button>
                        <input type="tel" inputMode="numeric" value={g}
                          onChange={(e) => { const v = parseInt(e.target.value.replace(/\D/g, "")) || 0; updateGramsForFood(key, v); }}
                          style={{ width: 68, height: 38, borderRadius: 10, border: `2px solid ${T.teal}`, textAlign: "center", fontSize: 20, fontWeight: 800, fontFamily: "inherit", color: T.text, outline: "none", background: T.tealLight }} />
                        <button onClick={() => updateGramsForFood(key, g + 1)} style={stepBtn(false)}>+</button>
                        <button onClick={() => updateGramsForFood(key, g + 10)} style={stepBtn(true)}>+10</button>
                      </div>
                      <div style={{ display: "flex", justifyContent: "center", gap: 14 }}>
                        <div style={{ textAlign: "center" }}><div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{Math.round(k100 * em)}</div><div style={{ fontSize: 8, color: T.textMuted }}>kcal</div></div>
                        <div style={{ textAlign: "center" }}><div style={{ fontSize: 14, fontWeight: 700, color: "#3B82F6" }}>{((food.proteinPer100||0)*em).toFixed(1)}</div><div style={{ fontSize: 8, color: T.textMuted }}>P</div></div>
                        <div style={{ textAlign: "center" }}><div style={{ fontSize: 14, fontWeight: 700, color: "#F0B429" }}>{((food.carbsPer100||0)*em).toFixed(1)}</div><div style={{ fontSize: 8, color: T.textMuted }}>C</div></div>
                        <div style={{ textAlign: "center" }}><div style={{ fontSize: 14, fontWeight: 700, color: "#E85D4E" }}>{((food.fatPer100||0)*em).toFixed(1)}</div><div style={{ fontSize: 8, color: T.textMuted }}>G</div></div>
                      </div>
                    </div>
                  );
                })()}
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

// ─── HAPTIC FEEDBACK HELPER ───────────────────────────────
const haptic = (ms = 10) => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };

// ─── COMPONENT ────────────────────────────────────────────
const FoodSection = forwardRef(({ settings, weightEntries, goTo, T, nutritionGoals: nutritionGoalsProp, goalHistory = [], onDataChange }, ref) => {

  // ── STATE ───────────────────────────────────────────────
  const [foodScreen, setFoodScreen] = useState("dashboard");
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date(); return d.toISOString().split("T")[0];
  });
  const [foodEntries, setFoodEntries] = useState([]);
  // nutritionGoals comes from parent (persisted in Dexie via profile)
  const nutritionGoals = nutritionGoalsProp || { kcalTarget: 2000, proteinPct: 30, carbsPct: 40, fatPct: 30 };
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

  // Dettaglio card + Report state
  const [detailPeriod, setDetailPeriod] = useState("week");
  const [reportWeekIdx, setReportWeekIdx] = useState(0);
  const [detailWeekIdx, setDetailWeekIdx] = useState(0);
  const [detailMonthIdx, setDetailMonthIdx] = useState(0);
  const [detailMetric, setDetailMetric] = useState("kcal");
  const [compData, setCompData] = useState({ weeks: [], months: [] });
  const [detailData, setDetailData] = useState({ weeks: [], months: [] });

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

  // ── Disable pinch-to-zoom across entire food section ────
  useEffect(() => {
    const prevent = (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); };
    const preventGesture = (e) => e.preventDefault();
    document.addEventListener("touchmove", prevent, { passive: false });
    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);
    // Also set viewport meta
    let meta = document.querySelector('meta[name="viewport"]');
    const origContent = meta ? meta.content : null;
    if (meta) { meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"; }
    else { meta = document.createElement("meta"); meta.name = "viewport"; meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"; document.head.appendChild(meta); }
    return () => {
      document.removeEventListener("touchmove", prevent);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      if (origContent !== null && meta) meta.content = origContent;
    };
  }, []);

  // ── DEXIE: Load entries when date changes ───────────────
  useEffect(() => {
    let active = true;
    getFoodEntriesByDate(selectedDate).then((entries) => {
      if (active) setFoodEntries(entries);
    });
    return () => { active = false; };
  }, [selectedDate]);

  // ── DEXIE: Load saved meals on mount ───────────────────
  useEffect(() => {
    getSavedMeals().then((meals) => setSavedMeals(meals));
  }, []);

  // Load recents when bottom sheet meal changes
  useEffect(() => {
    if (!showAddSheet) return;
    let active = true;
    getRecentFoodsByMeal(showAddSheet).then((recents) => {
      if (active) setAddSheetRecents(recents);
    });
    return () => { active = false; };
  }, [showAddSheet]);

  // ── Load Dettaglio data ─────────────────────────────────
  useEffect(() => {
    let active = true;
    const loadComparisonData = async () => {
      const today = new Date();
      const toISO = (d) => d.toISOString().split("T")[0];

      // Helper: get Monday of a week containing date d
      const getMonday = (d) => {
        const dt = new Date(d);
        const day = dt.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        dt.setDate(dt.getDate() + diff);
        return dt;
      };

      // Generate last N weeks starting from this week
      const weeks = [];
      const weekLabels = ["Questa settimana", "Settimana scorsa", "2 settimane fa", "3 settimane fa", "4 settimane fa", "5 settimane fa", "6 settimane fa", "7 settimane fa"];
      const dayLabelsShort = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
      for (let w = 0; w < 8; w++) {
        const mon = getMonday(today);
        mon.setDate(mon.getDate() - w * 7);
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        const start = toISO(mon);
        const end = toISO(sun);
        const dailyTotals = await getDailyTotalsForRange(start, end);
        const daysWithData = dailyTotals.length;
        const totalKcal = dailyTotals.reduce((s, d) => s + d.kcal, 0);
        const totalP = dailyTotals.reduce((s, d) => s + d.protein, 0);
        const totalC = dailyTotals.reduce((s, d) => s + d.carbs, 0);
        const totalG = dailyTotals.reduce((s, d) => s + d.fat, 0);
        const divisor = daysWithData || 1;

        // Meal distribution for week
        const weekEntries = await getFoodEntriesByDateRange(start, end);
        const mealKcal = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
        weekEntries.forEach(e => { if (mealKcal[e.mealType] !== undefined) mealKcal[e.mealType] += (e.kcal || 0); });

        // Build per-day chart data (Mon-Sun)
        const chartDays = [];
        for (let di = 0; di < 7; di++) {
          const dayDate = new Date(mon);
          dayDate.setDate(mon.getDate() + di);
          const ds = toISO(dayDate);
          const dayEntry = dailyTotals.find(d => d.date === ds);
          chartDays.push({
            label: dayLabelsShort[di],
            date: ds,
            kcal: dayEntry ? Math.round(dayEntry.kcal) : 0,
            p: dayEntry ? Math.round(dayEntry.protein) : 0,
            c: dayEntry ? Math.round(dayEntry.carbs) : 0,
            g: dayEntry ? Math.round(dayEntry.fat) : 0,
            hasCheat: dayEntry ? dayEntry.hasCheat || false : false,
            hasData: !!dayEntry,
          });
        }

        const cheatCount = chartDays.filter(d => d.hasCheat).length;
        const dateLabel = `${mon.getDate()} ${monthNames[mon.getMonth()]} – ${sun.getDate()} ${monthNames[sun.getMonth()]}`;
        weeks.push({
          label: weekLabels[w] || `${w} settimane fa`,
          dateLabel,
          isCurrent: w === 0,
          avg: { kcal: Math.round(totalKcal / divisor), p: Math.round(totalP / divisor), c: Math.round(totalC / divisor), g: Math.round(totalG / divisor) },
          days: chartDays,
          periodLabel: dateLabel,
          mealKcal,
          cheatCount,
        });
      }

      // Generate last N months
      const months = [];
      const monthLabelsFull = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
      const monthLabelsRel = ["Questo mese", "Mese scorso", "2 mesi fa", "3 mesi fa", "4 mesi fa", "5 mesi fa"];
      for (let m = 0; m < 6; m++) {
        const dt = new Date(today.getFullYear(), today.getMonth() - m, 1);
        const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0);
        const start = toISO(dt);
        const end = toISO(lastDay);
        const dailyTotals = await getDailyTotalsForRange(start, end);
        const daysWithData = dailyTotals.length;
        const totalKcal = dailyTotals.reduce((s, d) => s + d.kcal, 0);
        const totalP = dailyTotals.reduce((s, d) => s + d.protein, 0);
        const totalC = dailyTotals.reduce((s, d) => s + d.carbs, 0);
        const totalG = dailyTotals.reduce((s, d) => s + d.fat, 0);
        const divisor = daysWithData || 1;

        // Build per-week chart data for this month
        const chartWeeks = [];
        let weekStart = new Date(dt);
        let wNum = 1;
        while (weekStart <= lastDay) {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          if (weekEnd > lastDay) weekEnd.setTime(lastDay.getTime());
          const ws = toISO(weekStart);
          const we = toISO(weekEnd);
          const weekEntries = dailyTotals.filter(d => d.date >= ws && d.date <= we);
          const wk = weekEntries.reduce((s, d) => s + d.kcal, 0);
          const wp = weekEntries.reduce((s, d) => s + d.protein, 0);
          const wc = weekEntries.reduce((s, d) => s + d.carbs, 0);
          const wg = weekEntries.reduce((s, d) => s + d.fat, 0);
          chartWeeks.push({ label: `Sett ${wNum}`, kcal: Math.round(wk), p: Math.round(wp), c: Math.round(wc), g: Math.round(wg) });
          weekStart = new Date(weekEnd);
          weekStart.setDate(weekStart.getDate() + 1);
          wNum++;
        }

        // Meal distribution for month
        const monthEntries = await getFoodEntriesByDateRange(start, end);
        const monthMealKcal = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
        monthEntries.forEach(e => { if (monthMealKcal[e.mealType] !== undefined) monthMealKcal[e.mealType] += (e.kcal || 0); });

        // Count cheat days in month (days that have at least one cheat entry)
        const monthCheatDays = new Set();
        monthEntries.forEach(e => { if (e.isCheat) monthCheatDays.add(e.date); });

        const dateLabel = `${monthLabelsFull[dt.getMonth()]} ${dt.getFullYear()}`;
        months.push({
          label: monthLabelsRel[m] || `${m} mesi fa`,
          dateLabel,
          isCurrent: m === 0,
          avg: { kcal: Math.round(totalKcal / divisor), p: Math.round(totalP / divisor), c: Math.round(totalC / divisor), g: Math.round(totalG / divisor) },
          weeks: chartWeeks,
          periodLabel: dateLabel,
          daysTracked: daysWithData,
          mealKcal: monthMealKcal,
          cheatCount: monthCheatDays.size,
        });
      }

      if (active) {
        setCompData({ weeks, months });
        setDetailData({ weeks, months });
      }
    };
    loadComparisonData();
    return () => { active = false; };
  }, [foodEntries]); // re-fetch when entries change

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

  // Get the Monday of the week containing a given date
  const getMonday = (dateStr) => {
    const d = new Date(dateStr + "T12:00:00");
    const day = d.getDay(); // 0=Sun, 1=Mon, ...
    const diff = day === 0 ? -6 : 1 - day; // if Sunday go back 6, else go back to Monday
    d.setDate(d.getDate() + diff);
    return d.toISOString().split("T")[0];
  };

  const [viewWeekMonday, setViewWeekMonday] = useState(() => getMonday(selectedDate));

  const changeWeek = (delta) => {
    setViewWeekMonday((prev) => {
      const d = new Date(prev + "T12:00:00");
      d.setDate(d.getDate() + delta * 7);
      return d.toISOString().split("T")[0];
    });
  };

  // Track which dates have food data + daily totals for week bar chart
  const [datesWithData, setDatesWithData] = useState(new Set());
  const [weekBarData, setWeekBarData] = useState([]);
  useEffect(() => {
    let active = true;
    const loadWeekData = async () => {
      const dates = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(viewWeekMonday + "T12:00:00");
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().split("T")[0]);
      }
      const start = dates[0], end = dates[dates.length - 1];
      const totals = await getDailyTotalsForRange(start, end);
      const totMap = {};
      totals.forEach(t => { totMap[t.date] = t; });
      const bars = dates.map((ds, i) => {
        const t = totMap[ds];
        return {
          date: ds,
          label: dayNamesShort[new Date(ds + "T12:00:00").getDay()].charAt(0),
          kcal: t ? Math.round(t.kcal) : 0,
          hasData: !!t,
          hasCheat: t ? t.hasCheat || false : false,
        };
      });
      if (active) {
        setDatesWithData(new Set(totals.map(t => t.date)));
        setWeekBarData(bars);
      }
    };
    loadWeekData();
    return () => { active = false; };
  }, [viewWeekMonday, foodEntries]);

  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(viewWeekMonday + "T12:00:00");
      d.setDate(d.getDate() + i);
      const ds = d.toISOString().split("T")[0];
      days.push({
        date: ds,
        dayNum: d.getDate(),
        dayName: dayNamesShort[d.getDay()],
        isToday: ds === todayStr,
        isSelected: ds === selectedDate,
        hasFoodData: datesWithData.has(ds),
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
    haptic(25);
    setScanLoading(true);
    const food = await lookupBarcode(code);
    setScanLoading(false);
    if (food) {
      // Skip confirmation — go straight to gram editor
      // Check if this product was used before to pre-fill grams
      const foodName = food.foodName || food.name;
      const lastEntry = await getLastEntryByFoodName(foodName);
      const prefillGrams = lastEntry ? lastEntry.grams : (food.defaultPortion || 100);
      setScanResult(null);
      setScannerActive(false);
      setGramPopup({ food, grams: prefillGrams, source: "scan" });
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
    onDataChange?.();
  };

  const handleDeleteEntry = async (id) => {
    haptic(20);
    await deleteFoodEntry(id);
    setFoodEntries((prev) => prev.filter((e) => e.id !== id));
    showToast("Eliminato");
    onDataChange?.();
  };

  const handleMoveMeal = async (entryId, newMealType) => {
    await updateFoodEntry(entryId, { mealType: newMealType });
    setFoodEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, mealType: newMealType } : e));
    setEditingEntry(null);
    showToast(`Spostato in ${MEAL_CONFIG[newMealType].label}`);
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
    onDataChange?.();
  };

  const handleSaveMeal = async (mealType) => {
    if (!saveMealName.trim()) {
      showToast("Inserisci un nome per il pasto");
      return;
    }
    haptic(15);
    const items = getMealEntries(mealType);
    const totalKcal = items.reduce((s, i) => s + i.kcal, 0);
    const newMeal = { name: saveMealName, mealType, items, totalKcal };
    const id = await addSavedMeal(newMeal);
    setSavedMeals((prev) => [...prev, { ...newMeal, id }]);
    setShowSavePopup(null);
    setSaveMealName("");
    showToast("Pasto salvato");
  };

  const handleLoadMeal = async (meal) => {
    haptic(15);
    for (const item of meal.items) {
      const grams = item.grams || 100;
      await handleAddFood(item, showLoadPopup, grams);
    }
    setShowLoadPopup(null);
    showToast("Pasto caricato");
    onDataChange?.();
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
            <button onClick={stopScanner} aria-label="Chiudi scanner" style={{ width: 36, height: 36, background: "rgba(0,0,0,0.4)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "none", color: "#fff", fontSize: 18 }}>✕</button>
            <div style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>Scansiona barcode</div>
            <button onClick={toggleFlash} aria-label={flashOn ? "Disattiva flash" : "Attiva flash"} style={{ width: 36, height: 36, background: flashOn ? "rgba(2,192,154,0.5)" : "rgba(0,0,0,0.4)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "none", fontSize: 20 }}>🔦</button>
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

    // Product found — handled directly in handleBarcodeDetected (skips to gram editor)
    return null;
  };

  // ── DETTAGLIO BAR CHART CARD ───────────────────────────
  const renderDettaglioCard = () => {
    const idx = detailPeriod === "week" ? detailWeekIdx : detailMonthIdx;
    const setIdx = detailPeriod === "week" ? setDetailWeekIdx : setDetailMonthIdx;
    const allData = detailPeriod === "week" ? detailData.weeks : detailData.months;
    if (!allData || allData.length === 0) return null;
    const maxIdx = allData.length - 1;
    const safeIdx = Math.min(idx, maxIdx);

    const currentPeriod = allData[safeIdx];
    const data = detailPeriod === "week" ? currentPeriod.days : currentPeriod.weeks;
    if (!data || data.length === 0) return null;

    const metricColor = { kcal: T.teal, p: "#3B82F6", c: "#F0B429", g: "#E85D4E" }[detailMetric];
    const maxVal = Math.max(...data.map(d => d[detailMetric]), 1);
    const avgVal = Math.round(data.reduce((s, d) => s + d[detailMetric], 0) / (data.filter(d => d[detailMetric] > 0).length || 1));
    const canPrev = safeIdx < maxIdx;
    const canNext = safeIdx > 0;

    return (
      <div style={{ background: T.card, borderRadius: 18, padding: 16, boxShadow: T.shadow }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Dettaglio</div>
          <div style={{ display: "flex", gap: 4 }}>
            {[["week", "Sett."], ["month", "Mese"]].map(([key, label]) => (
              <button key={key} onClick={() => { setDetailPeriod(key); }} style={{
                padding: "4px 10px", borderRadius: 8, border: "none", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                background: detailPeriod === key ? T.teal : "#F0F2F5", color: detailPeriod === key ? "#fff" : T.textSec,
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Navigation arrows */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={() => canPrev && setIdx(safeIdx + 1)} aria-label="Periodo precedente" style={{
            width: 30, height: 30, borderRadius: 8, border: "none", cursor: canPrev ? "pointer" : "default",
            background: canPrev ? "#F0F2F5" : "transparent", color: canPrev ? T.text : "#ddd",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontFamily: "inherit",
          }}>‹</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{currentPeriod.periodLabel || currentPeriod.dateLabel}</div>
            {safeIdx === 0 && <div style={{ fontSize: 9, color: T.mint, fontWeight: 600 }}>Corrente</div>}
          </div>
          <button onClick={() => canNext && setIdx(safeIdx - 1)} aria-label="Periodo successivo" style={{
            width: 30, height: 30, borderRadius: 8, border: "none", cursor: canNext ? "pointer" : "default",
            background: canNext ? "#F0F2F5" : "transparent", color: canNext ? T.text : "#ddd",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontFamily: "inherit",
          }}>›</button>
        </div>

        {/* Metric selector */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[
            { key: "kcal", label: "kcal", color: T.teal },
            { key: "p", label: "P", color: "#3B82F6" },
            { key: "c", label: "C", color: "#F0B429" },
            { key: "g", label: "G", color: "#E85D4E" },
          ].map(m => (
            <button key={m.key} onClick={() => setDetailMetric(m.key)} style={{
              flex: 1, padding: "6px 4px", borderRadius: 8,
              border: detailMetric === m.key ? `2px solid ${m.color}` : "2px solid #eee",
              background: detailMetric === m.key ? `${m.color}15` : "#fff",
              cursor: "pointer", fontFamily: "inherit",
              fontSize: 10, fontWeight: 700, color: detailMetric === m.key ? m.color : T.textSec, textAlign: "center",
            }}>{m.label}</button>
          ))}
        </div>

        {/* Bar chart */}
        <div style={{ display: "flex", gap: detailPeriod === "week" ? 4 : 8, alignItems: "flex-end", height: 100, marginBottom: 10, padding: "0 2px" }}>
          {data.map((d, i) => {
            const h = maxVal > 0 ? (d[detailMetric] / maxVal) * 100 : 0;
            const isAboveTarget = detailMetric === "kcal" && d[detailMetric] > nutritionGoals.kcalTarget;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: metricColor }}>{d[detailMetric] || ""}</div>
                <div style={{ width: "100%", height: 80, position: "relative" }}>
                  <div style={{
                    position: "absolute", bottom: 0, left: "10%", width: "80%",
                    height: `${Math.max(h, d[detailMetric] > 0 ? 2 : 0)}%`,
                    background: isAboveTarget ? `${T.coral}CC` : metricColor, borderRadius: 4, opacity: 0.85,
                    transition: "height 0.3s",
                  }} />
                </div>
                <div style={{ fontSize: 8, color: T.textMuted, fontWeight: 600 }}>{d.label}</div>
              </div>
            );
          })}
        </div>

        {detailMetric === "kcal" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 6 }}>
            <div style={{ width: 16, height: 1.5, background: T.coral, borderRadius: 1 }} />
            <span style={{ fontSize: 9, color: T.textMuted }}>Obiettivo: {nutritionGoals.kcalTarget} kcal</span>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 0", borderTop: `1px solid ${T.border}` }}>
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: metricColor }}>{avgVal}</span>
            <span style={{ fontSize: 10, color: T.textMuted, marginLeft: 4 }}>
              {detailMetric === "kcal" ? "kcal/giorno media" : `${detailMetric.toUpperCase()} media/giorno`}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Helper: get the kcal target for a specific date using goal history
  const getKcalTargetForDate = (date) => {
    if (goalHistory.length > 0) {
      const goal = getGoalForDate(goalHistory, date);
      if (goal) return goal.kcalTarget;
    }
    return nutritionGoals.kcalTarget;
  };

  const renderDashboard = () => {
    const totals = getDayTotals();
    const todayHasCheat = foodEntries.some(e => e.isCheat);
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

    // Weekly bars: compute max for scaling, color each bar by goal
    const maxBarKcal = Math.max(nutritionGoals.kcalTarget, ...weekBarData.map(d => d.kcal), 1);
    const barMaxH = 50;

    return (
      <div style={{ padding: "0 0 100px" }}>
        {/* ─── Date Navigator ─── */}
        <div style={{ background: T.card, paddingBottom: 6, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 8px" }}>
            <button onClick={() => changeWeek(-1)} aria-label="Settimana precedente" style={{ width: 36, height: 36, borderRadius: 12, background: T.tealLight, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.teal }}>
              <ChevronLeft size={18} />
            </button>
            <div style={{ textAlign: "center", cursor: "pointer" }} onClick={() => { setSelectedDate(todayStr); setViewWeekMonday(getMonday(todayStr)); }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.text }}>{formatDateLabel(selectedDate)}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>{formatDateSub(selectedDate)}</div>
            </div>
            <button onClick={() => changeWeek(1)} aria-label="Settimana successiva" style={{ width: 36, height: 36, borderRadius: 12, background: T.tealLight, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.teal }}>
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
                {todayHasCheat && (
                  <div style={{ position: "absolute", top: 2, right: 2, width: 28, height: 28, borderRadius: "50%", background: "#FFF", boxShadow: "0 1px 4px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, lineHeight: 1 }}>🍕</div>
                )}
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

          {/* ─── Weekly Trend Bars (Style D) ─── */}
          <div style={{ padding: "14px 16px 16px", borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Settimana</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
              {weekBarData.map((day) => {
                const todayStr2 = today();
                const isFuture = day.date > todayStr2;
                const isToday = day.date === todayStr2;
                const dayTarget = getKcalTargetForDate(day.date);
                const isOverTarget = day.kcal > dayTarget;
                const barH = day.kcal > 0 ? Math.max(4, (day.kcal / maxBarKcal) * barMaxH) : 0;
                let barColor = T.teal;
                if (isFuture || !day.hasData) barColor = "#E5E7EB";
                else if (isToday) barColor = T.mint;
                if (isOverTarget && day.hasData && !isFuture) barColor = T.coral;

                return (
                  <div key={day.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: (isFuture || !day.hasData) ? "#D1D5DB" : isOverTarget ? T.coral : T.text, lineHeight: 1 }}>
                      {day.hasData && !isFuture ? day.kcal : ""}
                    </div>
                    <div style={{ width: "100%", height: barMaxH, position: "relative" }}>
                      <div style={{
                        position: "absolute", bottom: 0, left: "15%", width: "70%",
                        height: barH, borderRadius: 4,
                        background: isToday && !isOverTarget ? `linear-gradient(180deg, ${T.mint}, ${T.teal})` : barColor,
                        transition: "height 0.4s ease",
                        boxShadow: isToday ? `0 2px 8px ${T.mint}44` : "none",
                      }} />
                      {/* cheat badge on top-right of bar */}
                      {day.hasCheat && day.hasData && !isFuture && barH > 0 && (
                        <div style={{
                          position: "absolute",
                          bottom: barH - 6,
                          right: "5%",
                          width: 16, height: 16, borderRadius: "50%",
                          background: "#FFF", boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, lineHeight: 1, zIndex: 2,
                        }}>🍕</div>
                      )}
                      {/* target line */}
                      {day.hasData && !isFuture && (
                        <div style={{
                          position: "absolute", bottom: Math.max(0, (dayTarget / maxBarKcal) * barMaxH),
                          left: "5%", width: "90%", height: 1, background: `${T.coral}55`, borderRadius: 1,
                        }} />
                      )}
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: isToday ? 800 : 600,
                      color: isToday ? T.teal : T.textMuted, lineHeight: 1,
                      width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                      background: isToday ? T.tealLight : "transparent",
                    }}>
                      {day.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── Meal Cards (Style 5C) ─── */}
        <div style={{ padding: "12px 16px 20px" }}>
          {MEAL_TYPES.map((mt) => {
            const cfg = MEAL_CONFIG[mt];
            const expanded = expandedMeals[mt];
            const mealEntries = getMealEntries(mt);
            const totals = getMealTotals(mt);
            const count = mealEntries.length;

            return (
              <div key={mt} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", background: T.card, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
                  {/* Colored left bar */}
                  <div style={{ width: 4, background: cfg.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 12px 12px", cursor: "pointer" }} onClick={() => setExpandedMeals((prev) => ({ ...prev, [mt]: !prev[mt] }))}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{cfg.icon} {cfg.label}</span>
                      {!expanded && count > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, background: cfg.bgColor, padding: "2px 7px", borderRadius: 10 }}>{count}</span>}
                      <span style={{ marginLeft: "auto", fontSize: 17, fontWeight: 900, color: totals.kcal > 0 ? T.text : T.textMuted }}>{totals.kcal}</span>
                      <span style={{ fontSize: 9, color: T.textMuted }}>kcal</span>
                      <ChevronDown size={14} color="#ccc" style={{ transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0)", flexShrink: 0 }} />
                    </div>

                    {expanded && (
                      <div>
                        {/* Column header with P, C, G letters */}
                        {mealEntries.length > 0 && (
                          <div style={{ display: "flex", alignItems: "center", padding: "5px 14px 5px 12px", borderTop: `1px solid ${T.border}`, background: `${T.teal}06` }}>
                            <span style={{ width: 36, marginRight: 10 }} />
                            <span style={{ flex: 1, fontSize: 9, fontWeight: 600, color: T.textMuted, textTransform: "uppercase" }}>Alimento</span>
                            <div style={{ display: "flex", gap: 0, flexShrink: 0 }}>
                              <span style={{ width: 28, textAlign: "right", fontSize: 9, fontWeight: 700, color: "#3B82F6" }}>P</span>
                              <span style={{ width: 28, textAlign: "right", fontSize: 9, fontWeight: 700, color: "#F0B429" }}>C</span>
                              <span style={{ width: 28, textAlign: "right", fontSize: 9, fontWeight: 700, color: "#E85D4E" }}>G</span>
                              <span style={{ width: 40, textAlign: "right", fontSize: 9, fontWeight: 700, color: T.textMuted }}>kcal</span>
                            </div>
                          </div>
                        )}

                        {/* Food entries */}
                        {mealEntries.length > 0 && (
                          <div>
                            {mealEntries.map((entry) => (
                              <SwipeableItem key={entry.id} entry={entry} onDelete={handleDeleteEntry}
                                onTap={(e) => { if (!e.isCheat) setEditingEntry({ id: e.id, mealType: mt }); }} T={T} />
                            ))}
                          </div>
                        )}

                        {mealEntries.length === 0 && (
                          <div style={{ borderTop: `1px solid ${T.border}`, padding: "24px 16px", textAlign: "center", background: `${cfg.bgColor}40` }}>
                            <div style={{ fontSize: 28, marginBottom: 6, opacity: 0.7 }}>{cfg.icon}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>Nessun cibo registrato</div>
                            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4, opacity: 0.7 }}>Tocca "Aggiungi cibo" per iniziare</div>
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
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Dettaglio Card ─── */}
        <div style={{ padding: "0 16px 12px" }}>
          {renderDettaglioCard()}
        </div>

        {/* ─── Action Buttons ─── */}
        <div style={{ padding: "0 16px 16px", display: "flex", gap: 10 }}>
          <button onClick={() => setFoodScreen("reports")} aria-label="Vedi report calorie" style={{
            flex: 1, padding: 14, borderRadius: 14, border: `1.5px solid ${T.border}`,
            background: T.card, cursor: "pointer", fontFamily: "inherit", boxShadow: T.shadow,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <BarChart3 size={16} color={T.teal} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Report</span>
            <ChevronRight size={14} color={T.textMuted} />
          </button>
        </div>

        {/* Edit gram modal */}
        {editingEntry && foodEntries.find(e => e.id === editingEntry.id) && !foodEntries.find(e => e.id === editingEntry.id).isCheat && (
          <GramEditorModal entry={foodEntries.find(e => e.id === editingEntry.id)} onSave={(g) => handleUpdateGrams(editingEntry.id, g)} onClose={() => setEditingEntry(null)} onMoveMeal={handleMoveMeal} currentMealType={editingEntry.mealType} T={T} />
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
              {(() => {
                const items = getMealEntries(showSavePopup);
                const totK = items.reduce((s, i) => s + (i.kcal || 0), 0);
                const totP = items.reduce((s, i) => s + (i.protein || 0), 0);
                const totC = items.reduce((s, i) => s + (i.carbs || 0), 0);
                const totG = items.reduce((s, i) => s + (i.fat || 0), 0);
                return (
                  <div style={{ background: "#F8F9FB", borderRadius: 12, padding: 10, marginBottom: 16, textAlign: "left", maxHeight: 180, overflowY: "auto" }}>
                    {items.map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: 6, padding: "5px 0", alignItems: "baseline", borderBottom: i < items.length - 1 ? `1px solid ${T.border}` : "none" }}>
                        <span style={{ fontSize: 11, color: T.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.isCheat && "🍕 "}{item.foodName}</span>
                        <span style={{ fontSize: 9, fontWeight: 600, color: T.mint, flexShrink: 0 }}>{item.grams ? `${item.grams}g` : "—"}</span>
                        <span style={{ fontSize: 9, color: "#E85D4E", flexShrink: 0 }}>{Math.round(item.fat || 0)}G</span>
                        <span style={{ fontSize: 9, color: "#F0B429", flexShrink: 0 }}>{Math.round(item.carbs || 0)}C</span>
                        <span style={{ fontSize: 9, color: "#3B82F6", flexShrink: 0 }}>{Math.round(item.protein || 0)}P</span>
                        <span style={{ fontSize: 9, fontWeight: 600, color: T.text, flexShrink: 0 }}>{item.kcal}</span>
                      </div>
                    ))}
                    {/* Totals row */}
                    <div style={{ display: "flex", gap: 6, padding: "8px 0 2px", alignItems: "baseline", borderTop: `2px solid ${T.border}`, marginTop: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.text, flex: 1 }}>Totale</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#E85D4E", flexShrink: 0 }}>{Math.round(totG)}G</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#F0B429", flexShrink: 0 }}>{Math.round(totC)}C</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#3B82F6", flexShrink: 0 }}>{Math.round(totP)}P</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: T.text, flexShrink: 0 }}>{Math.round(totK)} kcal</span>
                    </div>
                  </div>
                );
              })()}
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
            onDelete={async (id) => { await deleteSavedMeal(id); setSavedMeals((p) => p.filter((m) => m.id !== id)); showToast("Eliminato"); }}
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
        <div role="status" aria-live="polite" style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", zIndex: 2000, pointerEvents: "none" }}>
          {toast && (
            <div style={{ background: T.text, color: "#fff", padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 30px rgba(0,0,0,0.15)", animation: "fadeInUp 0.3s ease", whiteSpace: "nowrap" }}>
              <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
              <Check size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />{toast}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderReports = () => {
    // Use real data from compData with week navigation
    const weeks = compData.weeks || [];
    const maxWeekIdx = weeks.length - 1;
    const safeIdx = Math.min(reportWeekIdx, Math.max(0, maxWeekIdx));
    const currentWeek = weeks[safeIdx];
    const chartData = currentWeek ? currentWeek.days : dayNamesShort.slice(1).concat(dayNamesShort[0]).map(n => ({ label: n, kcal: 0, p: 0, c: 0, g: 0 }));
    const canPrev = safeIdx < maxWeekIdx;
    const canNext = safeIdx > 0;

    // Identify today's day-of-week index (Mon=0) for highlight
    const todayDow = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();

    return (
      <div style={{ padding: "0 0 100px", background: T.bg }}>
        {/* Sticky header with back button */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, background: T.bg, display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 12px" }}>
          <button onClick={() => { setFoodScreen("dashboard"); setReportWeekIdx(0); }} aria-label="Torna alla dashboard" style={{
            width: 36, height: 36, borderRadius: 12, background: T.tealLight, border: "none",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.teal,
          }}><ChevronLeft size={18} /></button>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Report Calorie</div>
        </div>

        <div style={{ padding: "0 16px" }}>
          {/* Week navigation */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button onClick={() => canPrev && setReportWeekIdx(safeIdx + 1)} aria-label="Settimana precedente" style={{
              width: 30, height: 30, borderRadius: 8, border: "none", cursor: canPrev ? "pointer" : "default",
              background: canPrev ? "#F0F2F5" : "transparent", color: canPrev ? T.text : "#ddd",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontFamily: "inherit",
            }}>‹</button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{currentWeek ? currentWeek.periodLabel : "—"}</div>
              {safeIdx === 0 && <div style={{ fontSize: 9, color: T.mint, fontWeight: 600 }}>Settimana corrente</div>}
            </div>
            <button onClick={() => canNext && setReportWeekIdx(safeIdx - 1)} aria-label="Settimana successiva" style={{
              width: 30, height: 30, borderRadius: 8, border: "none", cursor: canNext ? "pointer" : "default",
              background: canNext ? "#F0F2F5" : "transparent", color: canNext ? T.text : "#ddd",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontFamily: "inherit",
            }}>›</button>
          </div>

          {/* Weekly kcal bar chart with today highlight */}
          <div style={{ background: T.card, borderRadius: 16, padding: 16, boxShadow: T.shadow, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>
              <BarChart3 size={16} style={{ verticalAlign: "middle", marginRight: 6 }} color={T.teal} />
              Calorie Settimanali
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: T.textMuted }} />
                <YAxis tick={{ fontSize: 10, fill: T.textMuted }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: T.shadow, fontSize: 12 }} />
                <ReferenceLine y={nutritionGoals.kcalTarget} stroke={T.coral} strokeDasharray="5 5" label={{ value: "Obiettivo", fontSize: 9, fill: T.coral }} />
                <Bar dataKey="kcal" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={safeIdx === 0 && i === todayDow ? T.mint : T.teal} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Macro stacked bar chart for the week */}
          <div style={{ background: T.card, borderRadius: 16, padding: 16, boxShadow: T.shadow, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>
              Macro Settimanali (g)
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: T.textMuted }} />
                <YAxis tick={{ fontSize: 10, fill: T.textMuted }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: T.shadow, fontSize: 12 }} />
                <Bar dataKey="p" name="Proteine" stackId="macro" fill={MC.protein} radius={[0, 0, 0, 0]} />
                <Bar dataKey="c" name="Carbs" stackId="macro" fill={MC.carbs} radius={[0, 0, 0, 0]} />
                <Bar dataKey="g" name="Grassi" stackId="macro" fill={MC.fat} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8 }}>
              {[{ label: "Proteine", color: MC.protein }, { label: "Carbs", color: MC.carbs }, { label: "Grassi", color: MC.fat }].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                  <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 600 }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── 1. Week vs Week Comparison ─── */}
          {(() => {
            const thisWeek = weeks[safeIdx];
            const lastWeek = weeks[safeIdx + 1];
            if (!thisWeek || !lastWeek) return null;
            const metrics = [
              { label: "Kcal/giorno", key: "kcal", color: T.teal },
              { label: "Proteine", key: "p", color: MC.protein },
              { label: "Carbo", key: "c", color: MC.carbs },
              { label: "Grassi", key: "g", color: MC.fat },
            ];
            return (
              <div style={{ background: T.card, borderRadius: 16, padding: 16, boxShadow: T.shadow, marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>
                  <TrendingUp size={16} style={{ verticalAlign: "middle", marginRight: 6 }} color={T.teal} />
                  Confronto Settimanale
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {metrics.map((m) => {
                    const curr = thisWeek.avg[m.key];
                    const prev = lastWeek.avg[m.key];
                    const diff = curr - prev;
                    const pctChange = prev > 0 ? Math.round((diff / prev) * 100) : 0;
                    const isUp = diff > 0;
                    return (
                      <div key={m.key} style={{ flex: 1, background: `${m.color}0A`, borderRadius: 12, padding: "10px 6px", textAlign: "center" }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: T.textMuted, marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{curr}</div>
                        <div style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>vs {prev}</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, marginTop: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: m.key === "kcal" ? (isUp ? T.coral : T.mint) : (isUp ? T.mint : T.coral) }}>
                            {isUp ? "↑" : diff < 0 ? "↓" : "="}{Math.abs(pctChange)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Cheat days row */}
                {(thisWeek.cheatCount > 0 || lastWeek.cheatCount > 0) && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, padding: "8px 10px", background: `${T.coral}08`, borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14 }}>🍕</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>Sgarri</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: T.coral }}>{thisWeek.cheatCount}x</span>
                      <span style={{ fontSize: 10, color: T.textMuted }}>vs</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.textMuted }}>{lastWeek.cheatCount}x</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ─── 2. Month vs Month Comparison ─── */}
          {(() => {
            const monthsData = compData.months || [];
            const thisMonth = monthsData[0];
            const lastMonth = monthsData[1];
            if (!thisMonth || !lastMonth) return null;
            const metrics = [
              { label: "Kcal/giorno", key: "kcal", color: T.teal },
              { label: "Proteine", key: "p", color: MC.protein },
              { label: "Carbo", key: "c", color: MC.carbs },
              { label: "Grassi", key: "g", color: MC.fat },
            ];
            return (
              <div style={{ background: T.card, borderRadius: 16, padding: 16, boxShadow: T.shadow, marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6 }}>
                  <Calendar size={16} style={{ verticalAlign: "middle", marginRight: 6 }} color={T.purple} />
                  Confronto Mensile
                </div>
                <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 12 }}>
                  {thisMonth.periodLabel} vs {lastMonth.periodLabel}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {metrics.map((m) => {
                    const curr = thisMonth.avg[m.key];
                    const prev = lastMonth.avg[m.key];
                    const diff = curr - prev;
                    const pctChange = prev > 0 ? Math.round((diff / prev) * 100) : 0;
                    const isUp = diff > 0;
                    return (
                      <div key={m.key} style={{ flex: 1, background: `${m.color}0A`, borderRadius: 12, padding: "10px 6px", textAlign: "center" }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: T.textMuted, marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{curr}</div>
                        <div style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>vs {prev}</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, marginTop: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: m.key === "kcal" ? (isUp ? T.coral : T.mint) : (isUp ? T.mint : T.coral) }}>
                            {isUp ? "↑" : diff < 0 ? "↓" : "="}{Math.abs(pctChange)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Cheat days row */}
                {(thisMonth.cheatCount > 0 || lastMonth.cheatCount > 0) && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, padding: "8px 10px", background: `${T.coral}08`, borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14 }}>🍕</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>Sgarri</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: T.coral }}>{thisMonth.cheatCount}x</span>
                      <span style={{ fontSize: 10, color: T.textMuted }}>vs</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.textMuted }}>{lastMonth.cheatCount}x</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ─── 3. Streak & Consistency ─── */}
          {(() => {
            // Calculate streak: consecutive days under kcal target ending today (or most recent tracked day)
            const allDays = [];
            weeks.forEach(w => w.days.forEach(d => { if (d.hasData) allDays.push(d); }));
            allDays.sort((a, b) => b.date.localeCompare(a.date)); // newest first

            let streak = 0;
            for (const d of allDays) {
              const dayTarget = getKcalTargetForDate(d.date);
              if (d.kcal <= dayTarget) streak++;
              else break;
            }

            // Days in target this week
            const thisWeekDays = currentWeek ? currentWeek.days.filter(d => d.hasData) : [];
            const daysInTarget = thisWeekDays.filter(d => {
              const dayTarget = getKcalTargetForDate(d.date);
              return d.kcal <= dayTarget;
            }).length;
            const totalTracked = thisWeekDays.length;
            const consistencyPct = totalTracked > 0 ? Math.round((daysInTarget / totalTracked) * 100) : 0;

            // Total days tracked across all weeks
            const totalDaysTracked = allDays.length;

            return (
              <div style={{ background: T.card, borderRadius: 16, padding: 16, boxShadow: T.shadow, marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>
                  <Flame size={16} style={{ verticalAlign: "middle", marginRight: 6 }} color={T.gold} />
                  Streak & Costanza
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {/* Streak */}
                  <div style={{ flex: 1, background: `${T.gold}0A`, borderRadius: 14, padding: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 30, fontWeight: 900, color: T.gold, lineHeight: 1 }}>{streak}</div>
                    <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, marginTop: 4 }}>giorni consecutivi</div>
                    <div style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>sotto obiettivo</div>
                  </div>
                  {/* Consistency ring */}
                  <div style={{ flex: 1, background: `${T.mint}0A`, borderRadius: 14, padding: 14, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ position: "relative", width: 56, height: 56 }}>
                      <svg width={56} height={56} viewBox="0 0 56 56">
                        <circle cx={28} cy={28} r={22} fill="none" stroke={T.border} strokeWidth={5} />
                        <circle cx={28} cy={28} r={22} fill="none" stroke={T.mint} strokeWidth={5}
                          strokeDasharray={2 * Math.PI * 22}
                          strokeDashoffset={2 * Math.PI * 22 - (consistencyPct / 100) * 2 * Math.PI * 22}
                          strokeLinecap="round"
                          style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }} />
                      </svg>
                      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 14, fontWeight: 800, color: T.mint }}>{consistencyPct}%</div>
                    </div>
                    <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, marginTop: 6 }}>{daysInTarget}/{totalTracked} giorni</div>
                    <div style={{ fontSize: 9, color: T.textMuted }}>in obiettivo</div>
                  </div>
                  {/* Total tracked */}
                  <div style={{ flex: 1, background: `${T.teal}0A`, borderRadius: 14, padding: 14, textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ fontSize: 30, fontWeight: 900, color: T.teal, lineHeight: 1 }}>{totalDaysTracked}</div>
                    <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, marginTop: 4 }}>giorni tracciati</div>
                    <div style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>totale</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ─── 4. Meal Distribution ─── */}
          {(() => {
            const mealKcal = currentWeek ? currentWeek.mealKcal : null;
            if (!mealKcal) return null;
            const totalMealKcal = Object.values(mealKcal).reduce((s, v) => s + v, 0);
            if (totalMealKcal === 0) return null;
            const mealItems = [
              { key: "breakfast", label: "Colazione", icon: "\u2615", color: "#F0B429" },
              { key: "lunch", label: "Pranzo", icon: "\u2600\uFE0F", color: "#028090" },
              { key: "dinner", label: "Cena", icon: "\uD83C\uDF19", color: "#7C5CFC" },
              { key: "snack", label: "Snack", icon: "\uD83C\uDF4E", color: "#E85D4E" },
            ];
            const maxMeal = Math.max(...Object.values(mealKcal));
            return (
              <div style={{ background: T.card, borderRadius: 16, padding: 16, boxShadow: T.shadow, marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>
                  <Activity size={16} style={{ verticalAlign: "middle", marginRight: 6 }} color={MC.protein} />
                  Distribuzione Pasti
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {mealItems.map((m) => {
                    const val = Math.round(mealKcal[m.key]);
                    const pct = totalMealKcal > 0 ? Math.round((val / totalMealKcal) * 100) : 0;
                    const barW = maxMeal > 0 ? Math.max(2, (val / maxMeal) * 100) : 0;
                    return (
                      <div key={m.key}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 14 }}>{m.icon}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{m.label}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: m.color }}>{val}</span>
                            <span style={{ fontSize: 10, color: T.textMuted }}>kcal</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, marginLeft: 4 }}>{pct}%</span>
                          </div>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: "#F0F2F5", overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 3, background: m.color, width: `${barW}%`, transition: "width 0.4s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  // ─── MAIN RETURN ───────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {foodScreen === "dashboard" && renderDashboard()}
      {foodScreen === "reports" && renderReports()}

      {renderScanner()}
    </div>
  );
});

FoodSection.displayName = "FoodSection";
export default FoodSection;
