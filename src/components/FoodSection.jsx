// FoodSection.jsx — Complete food tracking module
// Features: calorie ring, macro cards, meal diary, barcode scanner,
// OpenFoodFacts API, local caching (Dexie), bottom sheet, swipe delete,
// gram edit popup, nutrition goals, reports
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
  Clock, Star, Flame, Activity, TrendingUp, ScanLine, Settings,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
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
const monthNames = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];

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
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addSheetMeal, setAddSheetMeal] = useState("breakfast");
  const [addSheetDate, setAddSheetDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [addSheetSearch, setAddSheetSearch] = useState("");
  const [addSheetResults, setAddSheetResults] = useState([]);
  const [addSheetRecents, setAddSheetRecents] = useState([]);
  const [selections, setSelections] = useState(new Map()); // foodKey -> { food, grams, kcal, p, c, f }
  const [apiSearching, setApiSearching] = useState(false);

  // Gram popup state
  const [gramPopup, setGramPopup] = useState(null); // { food, grams, source: 'diary'|'sheet', entryId? }

  // Scanner state
  const [scannerActive, setScannerActive] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);

  // Goals state (FIXED — moved from renderGoals to component level)
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

  // ── EXPOSE openAddFood to parent via ref ────────────────
  useImperativeHandle(ref, () => ({
    openAddFood: () => {
      setAddSheetDate(selectedDate);
      setShowAddSheet(true);
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
    getRecentFoodsByMeal(addSheetMeal).then((recents) => {
      if (active) setAddSheetRecents(recents);
    });
    return () => { active = false; };
  }, [addSheetMeal, showAddSheet]);

  // Sync localGoals with nutritionGoals
  useEffect(() => {
    setLocalGoals(nutritionGoals);
    setManualKcal(nutritionGoals.kcalTarget);
  }, [nutritionGoals]);

  // ── HELPERS ─────────────────────────────────────────────
  const formatDateLabel = (dateStr) => {
    const today = new Date().toISOString().split("T")[0];
    const d = new Date(dateStr + "T12:00:00");
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === today) return "Oggi";
    if (dateStr === yesterday.toISOString().split("T")[0]) return "Ieri";
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

  // ── API: OpenFoodFacts ──────────────────────────────────
  const lookupBarcode = async (barcode) => {
    // Check local cache first
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

  const searchOpenFoodFacts = async (query) => {
    try {
      setApiSearching(true);
      const res = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&lc=it`
      );
      const data = await res.json();
      if (data.products) {
        const results = data.products
          .filter((p) => p.product_name && p.nutriments)
          .map((p) => {
            const n = p.nutriments;
            return {
              id: `api_${p.code || p._id}`,
              name: p.product_name_it || p.product_name,
              brand: p.brands || "",
              kcalPer100: Math.round(n["energy-kcal_100g"] || 0),
              proteinPer100: +(n.proteins_100g || 0).toFixed(1),
              carbsPer100: +(n.carbohydrates_100g || 0).toFixed(1),
              fatPer100: +(n.fat_100g || 0).toFixed(1),
              fiberPer100: +(n.fiber_100g || 0).toFixed(1),
              barcode: p.code || null,
              defaultPortion: parseFloat(p.serving_quantity) || 100,
              category: p.categories_tags?.[0]?.replace("en:", "") || "Altro",
              source: "api",
              image: p.image_front_small_url || null,
            };
          });
        // Cache each result
        for (const r of results) { cacheFood(r).catch(() => {}); }
        return results;
      }
    } catch (e) { /* */ }
    finally { setApiSearching(false); }
    return [];
  };

  // ── SEARCH (local + API, debounced) ─────────────────────
  const handleSearch = useCallback((query) => {
    setAddSheetSearch(query);
    if (!query || query.length < 2) {
      setAddSheetResults([]);
      return;
    }
    const q = query.toLowerCase();
    // Local database
    const localResults = FOOD_DB.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 15).map((f) => ({
      ...f, kcalPer100: f.kcal, proteinPer100: f.protein, carbsPer100: f.carbs, fatPer100: f.fat, fiberPer100: f.fiber || 0, source: "local",
    }));
    setAddSheetResults(localResults);

    // Debounced API search
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.length >= 3) {
      searchTimeoutRef.current = setTimeout(async () => {
        const cached = await searchCachedFoods(query);
        const apiResults = await searchOpenFoodFacts(query);
        // Merge, deduplicate by name
        const seen = new Set(localResults.map((r) => r.name.toLowerCase()));
        const extra = [...cached, ...apiResults].filter((r) => {
          const key = r.name.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setAddSheetResults((prev) => [...prev, ...extra]);
      }, 500);
    }
  }, []);

  // ── BARCODE SCANNER (html5-qrcode, cross-platform) ──────
  const html5QrRef = useRef(null);
  const verifyCountRef = useRef(0);
  const lastCodeRef = useRef(null);
  const [verifyProgress, setVerifyProgress] = useState(0); // 0-3

  const startScanner = async () => {
    setScannerActive(true);
    scannerActiveRef.current = true;
    setScanResult(null);
    setVerifyProgress(0);
    verifyCountRef.current = 0;
    lastCodeRef.current = null;

    // Small delay to ensure the DOM element is rendered
    await new Promise((r) => setTimeout(r, 100));

    try {
      const scanner = new Html5Qrcode("barcode-reader");
      html5QrRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 140 },
          aspectRatio: 1.5,
          formatsToSupport: [9 /* EAN_13 */, 10 /* EAN_8 */, 14 /* UPC_A */, 15 /* UPC_E */, 5 /* CODE_128 */],
        },
        // onSuccess — 3-read verification
        (decodedText) => {
          if (decodedText === lastCodeRef.current) {
            verifyCountRef.current += 1;
          } else {
            lastCodeRef.current = decodedText;
            verifyCountRef.current = 1;
          }
          setVerifyProgress(Math.min(verifyCountRef.current, 3));

          if (verifyCountRef.current >= 3) {
            // Confirmed! Stop scanner and look up product
            stopScanner();
            handleBarcodeDetected(decodedText);
          }
        },
        // onError — ignore, scanning continues
        () => {}
      );
    } catch (e) {
      setScannerActive(false);
      scannerActiveRef.current = false;
      alert("Impossibile accedere alla fotocamera. Verifica i permessi del browser.");
    }
  };

  const stopScanner = async () => {
    setScannerActive(false);
    scannerActiveRef.current = false;
    setVerifyProgress(0);
    verifyCountRef.current = 0;
    lastCodeRef.current = null;
    try {
      if (html5QrRef.current) {
        const state = html5QrRef.current.getState();
        // 2 = SCANNING, 3 = PAUSED
        if (state === 2 || state === 3) {
          await html5QrRef.current.stop();
        }
        html5QrRef.current.clear();
        html5QrRef.current = null;
      }
    } catch (e) { /* already stopped */ }
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
  const handleAddFoodsFromSheet = async () => {
    if (selections.size === 0) return;
    const newEntries = [];
    for (const [, sel] of selections) {
      const vals = calcForPortion(sel.food, sel.grams);
      newEntries.push({
        date: addSheetDate,
        mealType: addSheetMeal,
        foodName: sel.food.name || sel.food.foodName,
        grams: sel.grams,
        kcal: vals.kcal,
        protein: vals.protein,
        carbs: vals.carbs,
        fat: vals.fat,
        kcalPer100: sel.food.kcalPer100 ?? sel.food.kcal ?? 0,
        proteinPer100: sel.food.proteinPer100 ?? sel.food.protein ?? 0,
        carbsPer100: sel.food.carbsPer100 ?? sel.food.carbs ?? 0,
        fatPer100: sel.food.fatPer100 ?? sel.food.fat ?? 0,
        fiberPer100: sel.food.fiberPer100 ?? sel.food.fiber ?? 0,
        category: sel.food.category || "Altro",
        source: sel.food.source || "local",
      });
      // Cache the food for offline
      const cacheId = sel.food.id || `local_${(sel.food.name || sel.food.foodName || "").replace(/\s/g, "_")}`;
      cacheFood({
        id: cacheId,
        name: sel.food.name || sel.food.foodName,
        kcalPer100: sel.food.kcalPer100 ?? sel.food.kcal ?? 0,
        proteinPer100: sel.food.proteinPer100 ?? sel.food.protein ?? 0,
        carbsPer100: sel.food.carbsPer100 ?? sel.food.carbs ?? 0,
        fatPer100: sel.food.fatPer100 ?? sel.food.fat ?? 0,
        fiberPer100: sel.food.fiberPer100 ?? sel.food.fiber ?? 0,
        defaultPortion: sel.grams,
        category: sel.food.category || "Altro",
        barcode: sel.food.barcode || null,
        source: sel.food.source || "local",
      }).catch(() => {});
    }
    await addFoodEntries(newEntries);
    // Reload entries
    const updated = await getFoodEntriesByDate(selectedDate);
    setFoodEntries(updated);
    setShowAddSheet(false);
    setSelections(new Map());
    setAddSheetSearch("");
    setAddSheetResults([]);
  };

  const handleDeleteEntry = async (id) => {
    await deleteFoodEntry(id);
    setFoodEntries((prev) => prev.filter((e) => e.id !== id));
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
  };

  const toggleSelection = (food) => {
    const key = food.name || food.foodName;
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

  const updateSelectionGrams = (foodKey, grams) => {
    setSelections((prev) => {
      const next = new Map(prev);
      const sel = next.get(foodKey);
      if (sel) next.set(foodKey, { ...sel, grams });
      return next;
    });
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

  // ─── SWIPEABLE FOOD ITEM ───────────────────────────────
  const SwipeableItem = ({ entry, onDelete, onTap, T: theme }) => {
    const [offsetX, setOffsetX] = useState(0);
    const swipingRef = useRef(false);
    const startXRef = useRef(0);
    const baseOffsetRef = useRef(0);

    return (
      <div style={{ position: "relative", overflow: "hidden", borderBottom: `1px solid ${theme.border}` }}>
        {/* Delete background */}
        <div
          style={{
            position: "absolute", right: 0, top: 0, bottom: 0, width: 75,
            background: theme.coral, display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 1,
          }}
          onClick={() => onDelete(entry.id)}
        >
          <Trash2 size={20} color="#fff" />
        </div>
        {/* Content */}
        <div
          style={{
            display: "flex", alignItems: "center", padding: "12px 16px 12px 46px",
            background: theme.card, position: "relative", zIndex: 2,
            transform: `translateX(${-offsetX}px)`,
            transition: swipingRef.current ? "none" : "transform 0.25s ease",
            cursor: "pointer",
          }}
          onTouchStart={(e) => {
            startXRef.current = e.touches[0].clientX;
            baseOffsetRef.current = offsetX;
            swipingRef.current = true;
          }}
          onTouchMove={(e) => {
            if (!swipingRef.current) return;
            const diff = startXRef.current - e.touches[0].clientX;
            setOffsetX(Math.max(0, Math.min(75, baseOffsetRef.current + diff)));
          }}
          onTouchEnd={() => {
            swipingRef.current = false;
            setOffsetX((prev) => (prev > 35 ? 75 : 0));
          }}
          onClick={() => { if (offsetX === 0) onTap(entry); }}
        >
          <span style={{ fontSize: 18, marginRight: 10, flexShrink: 0 }}>
            {getEmoji(entry.category)}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{entry.foodName}</div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>{entry.grams}g</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.textSec }}>{entry.kcal} kcal</div>
        </div>
      </div>
    );
  };

  // ─── GRAM EDIT POPUP ───────────────────────────────────
  const renderGramPopup = () => {
    if (!gramPopup) return null;
    const { food, grams, source, entryId } = gramPopup;
    const name = food.foodName || food.name;
    const k100 = food.kcalPer100 ?? food.kcal ?? (food.grams > 0 ? (food.kcal / food.grams) * 100 : 0);
    const p100 = food.proteinPer100 ?? food.protein ?? 0;
    const c100 = food.carbsPer100 ?? food.carbs ?? 0;
    const f100 = food.fatPer100 ?? food.fat ?? 0;
    const preview = calcForPortion({ kcalPer100: k100, proteinPer100: p100, carbsPer100: c100, fatPer100: f100 }, grams);
    const defP = food.defaultPortion || food.lastGrams || 100;
    const portions = [
      Math.round(defP * 0.5), Math.round(defP * 0.75), defP,
      Math.round(defP * 1.25), Math.round(defP * 1.5),
    ].filter((v, i, a) => a.indexOf(v) === i && v > 0);

    return (
      <div
        style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.45)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}
        onClick={() => setGramPopup(null)}
      >
        <div
          style={{
            background: "#fff", borderRadius: 22, width: "100%", maxWidth: 320,
            padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", textAlign: "center",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: 36, marginBottom: 6 }}>{getEmoji(food.category)}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{name}</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2, marginBottom: 14 }}>
            {k100} kcal / 100g
          </div>

          {/* Quick portions */}
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 14, flexWrap: "wrap" }}>
            {portions.map((p) => (
              <button
                key={p}
                onClick={() => setGramPopup((prev) => ({ ...prev, grams: p }))}
                style={{
                  padding: "5px 11px", borderRadius: 20, background: grams === p ? T.tealLight : "#F5F7FA",
                  fontSize: 11, fontWeight: 600, color: grams === p ? T.teal : T.textSec,
                  cursor: "pointer", border: grams === p ? `1px solid ${T.teal}` : "1px solid transparent",
                  fontFamily: "inherit",
                }}
              >
                {p}g
              </button>
            ))}
          </div>

          {/* +/- input */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 }}>
            <button
              onClick={() => setGramPopup((prev) => ({ ...prev, grams: Math.max(1, prev.grams - 10) }))}
              style={{
                width: 38, height: 38, borderRadius: 10, border: "none",
                background: "#F0F0F0", fontSize: 18, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", color: T.text,
              }}
            >
              &minus;
            </button>
            <input
              type="number"
              value={grams}
              onChange={(e) => {
                const v = parseInt(e.target.value) || 0;
                setGramPopup((prev) => ({ ...prev, grams: Math.max(0, v) }));
              }}
              style={{
                width: 80, height: 44, borderRadius: 12, border: `2px solid ${T.teal}`,
                textAlign: "center", fontSize: 20, fontWeight: 700, fontFamily: "inherit",
                color: T.text, outline: "none",
              }}
            />
            <button
              onClick={() => setGramPopup((prev) => ({ ...prev, grams: prev.grams + 10 }))}
              style={{
                width: 38, height: 38, borderRadius: 10, border: "none",
                background: "#F0F0F0", fontSize: 18, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", color: T.text,
              }}
            >
              +
            </button>
          </div>
          <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 10 }}>grammi</div>

          <div style={{ fontSize: 18, fontWeight: 800, color: T.teal, margin: "8px 0" }}>
            {preview.kcal} kcal
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 16, fontSize: 12 }}>
            <span style={{ color: "#3B82F6", fontWeight: 600 }}>P {preview.protein}g</span>
            <span style={{ color: "#F0B429", fontWeight: 600 }}>C {preview.carbs}g</span>
            <span style={{ color: "#E85D4E", fontWeight: 600 }}>G {preview.fat}g</span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setGramPopup(null)}
              style={{
                flex: 1, padding: 12, borderRadius: 12, border: "none",
                background: "#F0F0F0", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit", color: T.textSec,
              }}
            >
              Annulla
            </button>
            <button
              onClick={() => {
                if (source === "diary" && entryId) {
                  handleUpdateGrams(entryId, grams);
                } else if (source === "sheet") {
                  const key = food.name || food.foodName;
                  updateSelectionGrams(key, grams);
                  if (!selections.has(key)) toggleSelection(food);
                }
                setGramPopup(null);
              }}
              style={{
                flex: 1, padding: 12, borderRadius: 12, border: "none",
                background: T.gradient, color: "#fff", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Salva
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── BARCODE SCANNER OVERLAY ────────────────────────────
  const renderScanner = () => {
    if (!scannerActive && !scanResult && !scanLoading) return null;
    return (
      <div
        style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "#000", zIndex: 1100, display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: 16, zIndex: 10 }}>
          <button
            onClick={() => { stopScanner(); setScanResult(null); setScanLoading(false); }}
            style={{
              background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 10,
              width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            <X size={20} color="#fff" />
          </button>
          <div style={{ flex: 1, textAlign: "center", color: "#fff", fontWeight: 700, fontSize: 16 }}>
            Scansiona Barcode
          </div>
          <div style={{ width: 36 }} />
        </div>

        {/* Camera view via html5-qrcode */}
        {scannerActive && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div id="barcode-reader" style={{ width: "100%", maxWidth: 440 }} />
            {/* Verification progress bar */}
            <div style={{
              display: "flex", gap: 8, justifyContent: "center",
              padding: 16, background: "rgba(0,0,0,0.6)", width: "100%", maxWidth: 440,
            }}>
              {[1, 2, 3].map((step) => (
                <div key={step} style={{
                  width: 50, height: 6, borderRadius: 3,
                  background: verifyProgress >= step ? "#02C39A" : "rgba(255,255,255,0.25)",
                  transition: "background 0.2s",
                }} />
              ))}
            </div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, padding: "4px 0 8px", textAlign: "center" }}>
              {verifyProgress === 0 ? "Inquadra il codice a barre"
                : verifyProgress < 3 ? `Verifica in corso... ${verifyProgress}/3`
                : "Codice confermato!"}
            </div>
            {/* Manual input button */}
            <button
              onClick={() => {
                stopScanner();
                const manualCode = prompt("Inserisci il codice a barre manualmente:");
                if (manualCode && manualCode.trim()) {
                  handleBarcodeDetected(manualCode.trim());
                }
              }}
              style={{
                background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 14, padding: "10px 20px", fontSize: 13,
                fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "inherit",
                marginBottom: 16,
              }}
            >
              Inserisci codice manualmente
            </button>
          </div>
        )}

        {/* Loading */}
        {scanLoading && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
            <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#02C39A", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <div style={{ color: "#fff", fontSize: 14 }}>Cercando prodotto...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Result */}
        {scanResult && !scanLoading && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            {scanResult.notFound ? (
              <div style={{ background: "#fff", borderRadius: 20, padding: 24, textAlign: "center", maxWidth: 320, width: "100%" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>&#10060;</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 6 }}>Prodotto non trovato</div>
                <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 16 }}>Barcode: {scanResult.barcode}</div>
                <button
                  onClick={() => { setScanResult(null); startScanner(); }}
                  style={{
                    padding: "12px 24px", borderRadius: 12, border: "none",
                    background: T.gradient, color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Riprova
                </button>
              </div>
            ) : (
              <div style={{ background: "#fff", borderRadius: 20, padding: 24, textAlign: "center", maxWidth: 320, width: "100%" }}>
                {scanResult.image && <img src={scanResult.image} alt="" style={{ width: 80, height: 80, objectFit: "contain", borderRadius: 12, marginBottom: 10 }} />}
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 2 }}>{scanResult.name}</div>
                {scanResult.brand && <div style={{ fontSize: 12, color: T.accent, fontWeight: 600, marginBottom: 8 }}>{scanResult.brand}</div>}
                <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 12 }}>{scanResult.kcalPer100} kcal / 100g</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 16, fontSize: 12 }}>
                  <span style={{ color: "#3B82F6", fontWeight: 600 }}>P {scanResult.proteinPer100}g</span>
                  <span style={{ color: "#F0B429", fontWeight: 600 }}>C {scanResult.carbsPer100}g</span>
                  <span style={{ color: "#E85D4E", fontWeight: 600 }}>G {scanResult.fatPer100}g</span>
                </div>
                <button
                  onClick={() => {
                    const food = scanResult;
                    const key = food.name;
                    setSelections((prev) => {
                      const next = new Map(prev);
                      next.set(key, { food, grams: food.defaultPortion || 100 });
                      return next;
                    });
                    setScanResult(null);
                    stopScanner();
                  }}
                  style={{
                    width: "100%", padding: 14, borderRadius: 14, border: "none",
                    background: T.gradient, color: "#fff", fontSize: 14, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Aggiungi
                </button>
              </div>
            )}
          </div>
        )}

        {/* Manual barcode input (fallback when scanner not active) */}
        {!scannerActive && !scanResult && !scanLoading && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: "#fff", borderRadius: 20, padding: 24, maxWidth: 320, width: "100%" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>Inserisci barcode manualmente</div>
              <input
                type="text" placeholder="Es. 8001505005707" inputMode="numeric"
                style={{
                  width: "100%", padding: 12, borderRadius: 12, border: `1px solid ${T.border}`,
                  fontSize: 16, fontFamily: "inherit", textAlign: "center", marginBottom: 12, outline: "none",
                  boxSizing: "border-box",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.target.value.trim()) handleBarcodeDetected(e.target.value.trim());
                }}
              />
              <button
                onClick={() => startScanner()}
                style={{
                  width: "100%", padding: 12, borderRadius: 12, border: "none",
                  background: T.gradient, color: "#fff", fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 13,
                }}
              >
                Riprova con fotocamera
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── BOTTOM SHEET ──────────────────────────────────────
  const renderBottomSheet = () => {
    if (!showAddSheet) return null;
    const list = addSheetSearch.length >= 2 ? addSheetResults : addSheetRecents;
    const selCount = selections.size;

    return (
      <div
        style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.45)", zIndex: 900,
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }}
        onClick={() => { setShowAddSheet(false); setSelections(new Map()); setAddSheetSearch(""); setAddSheetResults([]); }}
      >
        <div
          style={{
            background: "#fff", width: "100%", maxWidth: 440, borderRadius: "24px 24px 0 0",
            maxHeight: "85vh", display: "flex", flexDirection: "column",
            animation: "slideUp .3s ease-out",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

          {/* Handle */}
          <div style={{ width: 36, height: 4, background: "#ddd", borderRadius: 2, margin: "10px auto" }} />

          {/* Header */}
          <div style={{ padding: "4px 20px 12px" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 12 }}>Aggiungi Cibo</div>

            {/* Date selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => {
                  const d = new Date(addSheetDate + "T12:00:00"); d.setDate(d.getDate() - 1);
                  setAddSheetDate(d.toISOString().split("T")[0]);
                }}
                style={{
                  width: 30, height: 30, borderRadius: 8, border: "none", background: "#F0F0F0",
                  fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.teal,
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <div style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 600, color: T.text }}>
                \uD83D\uDCC5 {formatDateLabel(addSheetDate)}, {new Date(addSheetDate + "T12:00:00").getDate()} {monthNames[new Date(addSheetDate + "T12:00:00").getMonth()]}
              </div>
              <button
                onClick={() => {
                  const d = new Date(addSheetDate + "T12:00:00"); d.setDate(d.getDate() + 1);
                  setAddSheetDate(d.toISOString().split("T")[0]);
                }}
                style={{
                  width: 30, height: 30, borderRadius: 8, border: "none", background: "#F0F0F0",
                  fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.teal,
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Meal pills */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {MEAL_TYPES.map((mt) => {
                const cfg = MEAL_CONFIG[mt];
                const sel = addSheetMeal === mt;
                return (
                  <button
                    key={mt}
                    onClick={() => setAddSheetMeal(mt)}
                    style={{
                      flex: 1, padding: "10px 4px", borderRadius: 12,
                      border: sel ? `2px solid ${T.teal}` : "2px solid #eee",
                      background: sel ? T.tealLight : "#fff", cursor: "pointer",
                      textAlign: "center", fontFamily: "inherit",
                    }}
                  >
                    <div style={{ fontSize: 16 }}>{cfg.icon}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: sel ? T.teal : T.textSec, marginTop: 3 }}>
                      {cfg.label}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Search + scanner */}
            <div style={{
              display: "flex", alignItems: "center", background: "#F5F7FA",
              borderRadius: 14, padding: "10px 14px", gap: 10,
            }}>
              <Search size={18} color="#bbb" />
              <input
                type="text"
                value={addSheetSearch}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Cerca alimento..."
                style={{
                  flex: 1, border: "none", background: "none", fontSize: 14,
                  fontFamily: "inherit", outline: "none", color: T.text,
                }}
              />
              <button
                onClick={() => startScanner()}
                style={{
                  width: 36, height: 36, borderRadius: 10, border: "none",
                  background: T.gradient, color: "#fff", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Camera size={16} />
              </button>
            </div>
          </div>

          {/* Food list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 10px" }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase",
              letterSpacing: 0.8, marginBottom: 8,
            }}>
              {addSheetSearch.length >= 2
                ? `Risultati${apiSearching ? " (cercando online...)" : ""}`
                : `\u23F0 Recenti per ${MEAL_CONFIG[addSheetMeal].label}`}
            </div>

            {list.length === 0 && (
              <div style={{ textAlign: "center", padding: 30, color: T.textMuted, fontSize: 13 }}>
                {addSheetSearch.length >= 2 ? "Nessun risultato" : "Nessun cibo recente per questo pasto"}
              </div>
            )}

            {list.map((food, idx) => {
              const key = food.name || food.foodName;
              const isSelected = selections.has(key);
              const k100 = food.kcalPer100 ?? food.kcal ?? 0;
              const portion = isSelected ? selections.get(key).grams : (food.defaultPortion || food.lastGrams || 100);
              const dispKcal = Math.round((k100 * portion) / 100);

              return (
                <div
                  key={`${key}-${idx}`}
                  style={{
                    display: "flex", alignItems: "center", padding: "11px 0",
                    borderBottom: `1px solid ${T.border}`, cursor: "pointer", gap: 10,
                  }}
                >
                  {/* Checkbox */}
                  <div
                    onClick={() => toggleSelection(food)}
                    style={{
                      width: 22, height: 22, borderRadius: 6,
                      border: isSelected ? `2px solid ${T.teal}` : "2px solid #ddd",
                      background: isSelected ? T.teal : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, transition: "all 0.2s", color: "#fff", fontSize: 13,
                    }}
                  >
                    {isSelected && <Check size={14} />}
                  </div>
                  {/* Food info (tap to edit grams) */}
                  <div
                    style={{ display: "flex", alignItems: "center", flex: 1, gap: 10 }}
                    onClick={() => {
                      setGramPopup({
                        food, grams: portion, source: "sheet",
                      });
                    }}
                  >
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{getEmoji(food.category)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{key}</div>
                      <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
                        {portion}g {food.count ? `\u2022 usato ${food.count}x` : ""}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                    {dispKcal} <span style={{ fontSize: 10, fontWeight: 400, color: T.textMuted }}>kcal</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Confirm */}
          <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}` }}>
            <button
              disabled={selCount === 0}
              onClick={handleAddFoodsFromSheet}
              style={{
                width: "100%", padding: 14, borderRadius: 14, border: "none",
                background: selCount > 0 ? T.gradient : "#ccc",
                color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                cursor: selCount > 0 ? "pointer" : "default",
                boxShadow: selCount > 0 ? "0 4px 15px rgba(2,128,144,0.3)" : "none",
              }}
            >
              {selCount > 0 ? `Aggiungi ${selCount} cib${selCount === 1 ? "o" : "i"}` : "Seleziona cibi da aggiungere"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── DASHBOARD ─────────────────────────────────────────
  const renderDashboard = () => {
    const totals = getDayTotals();
    const remaining = nutritionGoals.kcalTarget - totals.kcal;
    const pct = Math.min(100, Math.round((totals.kcal / nutritionGoals.kcalTarget) * 100));
    const circumference = 2 * Math.PI * 46;
    const dashOffset = circumference - (pct / 100) * circumference;

    return (
      <div style={{ padding: "0 0 100px" }}>
        {/* Date nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 16px", gap: 16 }}>
          <button
            onClick={() => changeDate(-1)}
            style={{
              width: 32, height: 32, borderRadius: 10, background: T.card, border: "none",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              boxShadow: T.shadow, color: T.teal,
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <div style={{ textAlign: "center", cursor: "pointer" }} onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{formatDateLabel(selectedDate)}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>{formatDateSub(selectedDate)}</div>
          </div>
          <button
            onClick={() => changeDate(1)}
            style={{
              width: 32, height: 32, borderRadius: 10, background: T.card, border: "none",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              boxShadow: T.shadow, color: T.teal,
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Calorie ring card */}
        <div style={{
          background: T.card, borderRadius: 18, boxShadow: T.shadow,
          margin: "0 16px 12px", overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, padding: 20 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <svg width={110} height={110} viewBox="0 0 110 110">
                <circle cx={55} cy={55} r={46} fill="none" stroke={T.border} strokeWidth={9} />
                <circle
                  cx={55} cy={55} r={46} fill="none" stroke={T.teal} strokeWidth={9}
                  strokeDasharray={circumference} strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.8s ease" }}
                />
              </svg>
              <div style={{
                position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center",
              }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: T.text }}>{totals.kcal}</div>
                <div style={{ fontSize: 8, color: T.textMuted, fontWeight: 600, textTransform: "uppercase" }}>kcal</div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              {[
                { label: "Obiettivo", value: `${nutritionGoals.kcalTarget} kcal`, color: T.text },
                { label: "Consumate", value: `${totals.kcal} kcal`, color: T.teal },
                { label: "Rimanenti", value: `${Math.max(0, remaining)} kcal`, color: T.mint },
              ].map((row, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", padding: "6px 0",
                  borderBottom: i < 2 ? `1px solid ${T.border}` : "none",
                }}>
                  <span style={{ fontSize: 12, color: T.textSec }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Macro cards (NO dots) */}
        <div style={{ display: "flex", gap: 8, padding: "0 16px 12px" }}>
          {[
            { label: "Proteine", value: Math.round(totals.protein), target: pTarget, color: "#3B82F6" },
            { label: "Carbo", value: Math.round(totals.carbs), target: cTarget, color: "#F0B429" },
            { label: "Grassi", value: Math.round(totals.fat), target: fTarget, color: "#E85D4E" },
          ].map((m) => (
            <div
              key={m.label}
              style={{
                flex: 1, background: T.card, borderRadius: 14, padding: 12,
                textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>{m.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, margin: "4px 0 2px", color: m.color }}>{m.value}g</div>
              <div style={{ fontSize: 10, color: T.textMuted }}>/ {m.target}g</div>
              <div style={{ height: 4, borderRadius: 2, background: T.border, marginTop: 8 }}>
                <div style={{
                  height: "100%", borderRadius: 2, background: m.color,
                  width: `${Math.min(100, m.target > 0 ? (m.value / m.target) * 100 : 0)}%`,
                  transition: "width 0.5s",
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Section label + header row */}
        <div style={{
          fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase",
          letterSpacing: 0.8, margin: "8px 16px 4px",
        }}>
          Diario Alimentare
        </div>

        {/* Column header */}
        <div style={{
          display: "flex", alignItems: "center", padding: "4px 16px 6px", gap: 10,
        }}>
          <div style={{ width: 36 }} />
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 6, fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>
            <span style={{ width: 44, textAlign: "right" }}>kcal</span>
            <span style={{ width: 32, textAlign: "right", color: "#3B82F6" }}>P</span>
            <span style={{ width: 32, textAlign: "right", color: "#F0B429" }}>C</span>
            <span style={{ width: 32, textAlign: "right", color: "#E85D4E" }}>G</span>
          </div>
          <div style={{ width: 14 }} />
        </div>

        {/* Meal cards */}
        {MEAL_TYPES.map((mt) => {
          const cfg = MEAL_CONFIG[mt];
          const totals = getMealTotals(mt);
          const entries = getMealEntries(mt);
          const expanded = expandedMeals[mt];

          return (
            <div
              key={mt}
              style={{
                background: T.card, borderRadius: 16, margin: "4px 16px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)", borderLeft: `4px solid ${cfg.color}`,
                overflow: "hidden",
              }}
            >
              {/* Meal header */}
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 14px", cursor: "pointer",
                }}
                onClick={() => setExpandedMeals((prev) => ({ ...prev, [mt]: !prev[mt] }))}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 10, background: cfg.bgColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15, flexShrink: 0,
                }}>
                  {cfg.icon}
                </div>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: T.text }}>
                  {cfg.label}
                </div>
                <div style={{ display: "flex", gap: 6, fontSize: 11, fontWeight: 600, alignItems: "center" }}>
                  <span style={{ width: 44, textAlign: "right", fontWeight: 800, color: totals.kcal > 0 ? cfg.color : T.textMuted }}>
                    {totals.kcal}
                  </span>
                  <span style={{ width: 32, textAlign: "right", color: "#3B82F6" }}>{Math.round(totals.protein)}</span>
                  <span style={{ width: 32, textAlign: "right", color: "#F0B429" }}>{Math.round(totals.carbs)}</span>
                  <span style={{ width: 32, textAlign: "right", color: "#E85D4E" }}>{Math.round(totals.fat)}</span>
                </div>
                <ChevronDown
                  size={14}
                  color="#ccc"
                  style={{
                    transition: "transform 0.2s",
                    transform: expanded ? "rotate(180deg)" : "rotate(0)",
                  }}
                />
              </div>

              {/* Expanded food items */}
              {expanded && entries.length > 0 && (
                <div style={{ borderTop: `1px solid ${T.border}` }}>
                  {entries.map((entry) => (
                    <SwipeableItem
                      key={entry.id}
                      entry={entry}
                      T={T}
                      onDelete={handleDeleteEntry}
                      onTap={(e) => {
                        setGramPopup({
                          food: e,
                          grams: e.grams,
                          source: "diary",
                          entryId: e.id,
                        });
                      }}
                    />
                  ))}
                </div>
              )}
              {expanded && entries.length === 0 && (
                <div style={{
                  borderTop: `1px solid ${T.border}`, padding: "16px",
                  textAlign: "center", fontSize: 12, color: T.textMuted,
                }}>
                  Nessun cibo registrato
                </div>
              )}
            </div>
          );
        })}

        {/* Quick action buttons */}
        <div style={{ display: "flex", gap: 8, margin: "16px 16px 0", flexWrap: "wrap" }}>
          <button
            onClick={() => setFoodScreen("goals")}
            style={{
              flex: 1, padding: "12px 14px", borderRadius: 14, border: "none",
              background: T.card, boxShadow: T.shadow, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit",
            }}
          >
            <Target size={16} color={T.teal} />
            <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Obiettivi</span>
          </button>
          <button
            onClick={() => setFoodScreen("reports")}
            style={{
              flex: 1, padding: "12px 14px", borderRadius: 14, border: "none",
              background: T.card, boxShadow: T.shadow, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit",
            }}
          >
            <BarChart3 size={16} color={T.teal} />
            <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Report</span>
          </button>
        </div>
      </div>
    );
  };

  // ─── GOALS SCREEN (FIXED — no useState here) ──────────
  const renderGoals = () => {
    const tdee = calculateTDEE();
    const activityLevels = [
      { val: 1.2, label: "Sedentario" },
      { val: 1.375, label: "Leggero (1-3 gg)" },
      { val: 1.55, label: "Moderato (3-5 gg)" },
      { val: 1.725, label: "Attivo (6-7 gg)" },
      { val: 1.9, label: "Molto attivo" },
    ];

    return (
      <div style={{ padding: "0 0 100px" }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", padding: "14px 16px",
          background: T.card, borderBottom: `1px solid ${T.border}`,
        }}>
          <button
            onClick={() => setFoodScreen("dashboard")}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
          >
            <ChevronLeft size={22} color={T.teal} />
          </button>
          <div style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: 800, color: T.text }}>
            Obiettivi Nutrizionali
          </div>
          <div style={{ width: 30 }} />
        </div>

        <div style={{ padding: 16 }}>
          {/* TDEE Calculator */}
          <div style={{ background: T.card, borderRadius: 16, padding: 20, boxShadow: T.shadow, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>
              <Flame size={16} style={{ verticalAlign: "middle", marginRight: 6 }} color={T.coral} />
              Calcolo TDEE
            </div>

            {/* Sex */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>Sesso</div>
              <div style={{ display: "flex", gap: 8 }}>
                {["M", "F"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setGoalSex(s)}
                    style={{
                      flex: 1, padding: 10, borderRadius: 10,
                      border: goalSex === s ? `2px solid ${T.teal}` : `1px solid ${T.border}`,
                      background: goalSex === s ? T.tealLight : T.card,
                      fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      color: goalSex === s ? T.teal : T.textSec,
                    }}
                  >
                    {s === "M" ? "Maschio" : "Femmina"}
                  </button>
                ))}
              </div>
            </div>

            {/* Age, Weight, Height */}
            {[
              { label: "Età", value: goalAge, set: setGoalAge, unit: "anni" },
              { label: "Peso", value: goalWeight, set: setGoalWeight, unit: "kg" },
              { label: "Altezza", value: goalHeight, set: setGoalHeight, unit: "cm" },
            ].map((field) => (
              <div key={field.label} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 4 }}>{field.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number"
                    value={field.value}
                    onChange={(e) => field.set(parseInt(e.target.value) || 0)}
                    style={{
                      flex: 1, padding: "10px 14px", borderRadius: 10,
                      border: `1px solid ${T.border}`, fontSize: 15, fontWeight: 600,
                      fontFamily: "inherit", outline: "none", color: T.text,
                    }}
                  />
                  <span style={{ fontSize: 12, color: T.textMuted, minWidth: 30 }}>{field.unit}</span>
                </div>
              </div>
            ))}

            {/* Activity level */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>Livello attività</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {activityLevels.map((al) => (
                  <button
                    key={al.val}
                    onClick={() => setGoalActivity(al.val)}
                    style={{
                      padding: "10px 14px", borderRadius: 10, textAlign: "left",
                      border: goalActivity === al.val ? `2px solid ${T.teal}` : `1px solid ${T.border}`,
                      background: goalActivity === al.val ? T.tealLight : T.card,
                      fontSize: 12, fontWeight: goalActivity === al.val ? 700 : 500,
                      cursor: "pointer", fontFamily: "inherit",
                      color: goalActivity === al.val ? T.teal : T.textSec,
                    }}
                  >
                    {al.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TDEE result */}
            <div style={{
              background: T.tealLight, borderRadius: 12, padding: 14,
              textAlign: "center", marginTop: 8,
            }}>
              <div style={{ fontSize: 11, color: T.teal, fontWeight: 600 }}>TDEE stimato</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: T.teal }}>{tdee} kcal</div>
            </div>
          </div>

          {/* Manual override */}
          <div style={{ background: T.card, borderRadius: 16, padding: 20, boxShadow: T.shadow, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Obiettivo manuale</span>
              <button
                onClick={() => setUseManual(!useManual)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: "none",
                  background: useManual ? T.teal : "#D1D5DB", cursor: "pointer",
                  position: "relative", transition: "background 0.2s",
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", background: "#fff",
                  position: "absolute", top: 2, left: useManual ? 22 : 2,
                  transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </button>
            </div>
            {useManual && (
              <input
                type="number"
                value={manualKcal}
                onChange={(e) => setManualKcal(parseInt(e.target.value) || 0)}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 10,
                  border: `1px solid ${T.border}`, fontSize: 18, fontWeight: 700,
                  fontFamily: "inherit", textAlign: "center", outline: "none", color: T.text,
                }}
              />
            )}
          </div>

          {/* Macro split */}
          <div style={{ background: T.card, borderRadius: 16, padding: 20, boxShadow: T.shadow, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>
              Ripartizione Macros
            </div>
            {[
              { key: "proteinPct", label: "Proteine", color: "#3B82F6" },
              { key: "carbsPct", label: "Carboidrati", color: "#F0B429" },
              { key: "fatPct", label: "Grassi", color: "#E85D4E" },
            ].map((macro) => (
              <div key={macro.key} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: macro.color, fontWeight: 600 }}>{macro.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{localGoals[macro.key]}%</span>
                </div>
                <input
                  type="range" min={5} max={70} value={localGoals[macro.key]}
                  onChange={(e) => setLocalGoals((prev) => ({ ...prev, [macro.key]: parseInt(e.target.value) }))}
                  style={{ width: "100%", accentColor: macro.color }}
                />
              </div>
            ))}
            {localGoals.proteinPct + localGoals.carbsPct + localGoals.fatPct !== 100 && (
              <div style={{ fontSize: 11, color: T.coral, fontWeight: 600, textAlign: "center", marginTop: 4 }}>
                Totale: {localGoals.proteinPct + localGoals.carbsPct + localGoals.fatPct}% (deve essere 100%)
              </div>
            )}
          </div>

          {/* Save */}
          <button
            onClick={handleSaveGoals}
            disabled={localGoals.proteinPct + localGoals.carbsPct + localGoals.fatPct !== 100}
            style={{
              width: "100%", padding: 16, borderRadius: 14, border: "none",
              background: (localGoals.proteinPct + localGoals.carbsPct + localGoals.fatPct === 100) ? T.gradient : "#ccc",
              color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: "inherit",
              cursor: "pointer", boxShadow: "0 4px 15px rgba(2,128,144,0.3)",
            }}
          >
            Salva Obiettivi
          </button>
        </div>
      </div>
    );
  };

  // ─── REPORTS SCREEN ────────────────────────────────────
  const renderReports = () => {
    // Generate last 7 days data
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      days.push({ date: ds, label: dayNames[d.getDay()].slice(0, 3) });
    }

    // We'd load data from Dexie for each day, but for now show placeholder
    const chartData = days.map((day) => ({
      name: day.label,
      kcal: day.date === selectedDate ? getDayTotals().kcal : Math.round(Math.random() * 1200 + 800),
      target: nutritionGoals.kcalTarget,
    }));

    const totals = getDayTotals();
    const pieData = [
      { name: "Proteine", value: Math.round(totals.protein * 4), color: "#3B82F6" },
      { name: "Carbo", value: Math.round(totals.carbs * 4), color: "#F0B429" },
      { name: "Grassi", value: Math.round(totals.fat * 9), color: "#E85D4E" },
    ].filter((d) => d.value > 0);

    return (
      <div style={{ padding: "0 0 100px" }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", padding: "14px 16px",
          background: T.card, borderBottom: `1px solid ${T.border}`,
        }}>
          <button
            onClick={() => setFoodScreen("dashboard")}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
          >
            <ChevronLeft size={22} color={T.teal} />
          </button>
          <div style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: 800, color: T.text }}>
            Report Settimanale
          </div>
          <div style={{ width: 30 }} />
        </div>

        <div style={{ padding: 16 }}>
          {/* Weekly calories chart */}
          <div style={{ background: T.card, borderRadius: 16, padding: 16, boxShadow: T.shadow, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>
              <Activity size={16} style={{ verticalAlign: "middle", marginRight: 6 }} color={T.teal} />
              Calorie Settimanali
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: T.textMuted }} />
                <YAxis tick={{ fontSize: 10, fill: T.textMuted }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "none", boxShadow: T.shadow, fontSize: 12 }}
                />
                <ReferenceLine y={nutritionGoals.kcalTarget} stroke={T.coral} strokeDasharray="5 5" />
                <Bar dataKey="kcal" fill={T.teal} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Macro pie chart */}
          {pieData.length > 0 && (
            <div style={{ background: T.card, borderRadius: 16, padding: 16, boxShadow: T.shadow, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>
                Ripartizione Macros (oggi)
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <ResponsiveContainer width="50%" height={140}>
                  <PieChart>
                    <Pie
                      data={pieData} cx="50%" cy="50%"
                      innerRadius={35} outerRadius={55}
                      dataKey="value" startAngle={90} endAngle={-270}
                    >
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

          {/* Summary stats */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
          }}>
            {[
              { label: "Media kcal", value: `${Math.round(chartData.reduce((s, d) => s + d.kcal, 0) / 7)}`, icon: <Flame size={16} color={T.coral} /> },
              { label: "Obiettivo", value: `${nutritionGoals.kcalTarget}`, icon: <Target size={16} color={T.teal} /> },
              { label: "Giorno max", value: `${Math.max(...chartData.map((d) => d.kcal))}`, icon: <TrendingUp size={16} color={T.gold} /> },
              { label: "Giorno min", value: `${Math.min(...chartData.map((d) => d.kcal))}`, icon: <Activity size={16} color="#3B82F6" /> },
            ].map((stat) => (
              <div key={stat.label} style={{
                background: T.card, borderRadius: 14, padding: 14,
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  {stat.icon}
                  <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 600 }}>{stat.label}</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{stat.value}</div>
              </div>
            ))}
          </div>
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

      {renderBottomSheet()}
      {renderGramPopup()}
      {renderScanner()}
    </div>
  );
});

FoodSection.displayName = "FoodSection";
export default FoodSection;
