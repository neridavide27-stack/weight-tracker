// food-db.js — Dexie database for food tracking (separate from weight DB)
import Dexie from 'dexie';

const foodDb = new Dexie('FoodTrackerDB');

foodDb.version(3).stores({
  foodEntries: '++id, date, mealType',
  cachedFoods: 'id, barcode',
  savedMeals: '++id, mealType',
  appSettings: 'key',
});

foodDb.version(4).stores({
  foodEntries: '++id, date, mealType',
  cachedFoods: 'id, barcode',
  savedMeals: '++id, mealType',
  appSettings: 'key',
  syncQueue: null, // removed — no longer used
});

// v5 — aggiunge tabella per le attività fitness (camminata)
foodDb.version(5).stores({
  foodEntries:       '++id, date, mealType',
  cachedFoods:       'id, barcode',
  savedMeals:        '++id, mealType',
  appSettings:       'key',
  fitnessActivities: '++id, date',
});

// v6 — aggiunge tabelle per la sezione Gym
foodDb.version(6).stores({
  foodEntries:        '++id, date, mealType',
  cachedFoods:        'id, barcode',
  savedMeals:         '++id, mealType',
  appSettings:        'key',
  fitnessActivities:  '++id, date',
  gymWorkouts:        '++id, date',
  gymSets:            '++id, workoutId, exerciseId',
  gymRoutines:        '++id',
  gymCustomExercises: '++id',
});

// ========== FOOD ENTRIES ==========

export const getFoodEntriesByDate = async (date) => {
  return await foodDb.foodEntries.where('date').equals(date).toArray();
};

export const addFoodEntry = async (entry) => {
  return await foodDb.foodEntries.add(entry);
};

export const addFoodEntries = async (entries) => {
  return await foodDb.foodEntries.bulkAdd(entries);
};

export const deleteFoodEntry = async (id) => {
  return await foodDb.foodEntries.delete(id);
};

export const updateFoodEntry = async (id, changes) => {
  return await foodDb.foodEntries.update(id, changes);
};

// ========== CACHED FOODS (offline) ==========

export const cacheFood = async (food) => {
  return await foodDb.cachedFoods.put({ ...food, brand: food.brand, lastUsed: Date.now() });
};

export const getCachedFood = async (id) => {
  return await foodDb.cachedFoods.get(id);
};

export const getCachedFoodByBarcode = async (barcode) => {
  return await foodDb.cachedFoods.where('barcode').equals(barcode).first();
};

export const getAllCachedFoods = async () => {
  return await foodDb.cachedFoods.toArray();
};

export const searchCachedFoods = async (query) => {
  const all = await foodDb.cachedFoods.toArray();
  const q = query.toLowerCase();
  return all.filter(f => f.name && f.name.toLowerCase().includes(q));
};

// ========== RECENT FOODS PER MEAL ==========

export const getRecentFoodsByMeal = async (mealType, limit = 20) => {
  const entries = await foodDb.foodEntries
    .where('mealType').equals(mealType)
    .reverse().toArray();

  const foodMap = new Map();
  for (const e of entries) {
    const key = e.foodName;
    if (!foodMap.has(key)) {
      foodMap.set(key, {
        foodName: e.foodName,
        brand: e.brand,
        lastGrams: e.grams,
        kcalPer100: e.kcalPer100 || (e.grams > 0 ? (e.kcal / e.grams) * 100 : 0),
        proteinPer100: e.proteinPer100 || (e.grams > 0 ? (e.protein / e.grams) * 100 : 0),
        carbsPer100: e.carbsPer100 || (e.grams > 0 ? (e.carbs / e.grams) * 100 : 0),
        fatPer100: e.fatPer100 || (e.grams > 0 ? (e.fat / e.grams) * 100 : 0),
        fiberPer100: e.fiberPer100 || 0,
        category: e.category || 'Altro',
        defaultPortion: e.grams,
        count: 1,
        source: e.source || 'local',
      });
    } else {
      foodMap.get(key).count++;
    }
  }

  return Array.from(foodMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

// ========== LAST ENTRY LOOKUP ==========

export const getLastEntryByFoodName = async (foodName) => {
  const entries = await foodDb.foodEntries
    .filter(e => e.foodName === foodName)
    .toArray();
  if (entries.length === 0) return null;
  // Return the most recent one (highest id = latest added)
  return entries.sort((a, b) => b.id - a.id)[0];
};

// ========== AGGREGATION HELPERS (Confronti + Dettaglio cards) ==========

// Get all entries in a date range [startDate, endDate] inclusive (YYYY-MM-DD strings)
export const getFoodEntriesByDateRange = async (startDate, endDate) => {
  return await foodDb.foodEntries
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();
};

// Get daily totals for a date range → [{ date, kcal, protein, carbs, fat }]
export const getDailyTotalsForRange = async (startDate, endDate) => {
  const entries = await getFoodEntriesByDateRange(startDate, endDate);
  const byDate = {};
  for (const e of entries) {
    if (!byDate[e.date]) byDate[e.date] = { date: e.date, kcal: 0, protein: 0, carbs: 0, fat: 0, hasCheat: false };
    byDate[e.date].kcal += e.kcal || 0;
    byDate[e.date].protein += e.protein || 0;
    byDate[e.date].carbs += e.carbs || 0;
    byDate[e.date].fat += e.fat || 0;
    if (e.isCheat) byDate[e.date].hasCheat = true;
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
};

// ========== SAVED MEALS ==========

export const getSavedMeals = async () => {
  return await foodDb.savedMeals.toArray();
};

export const getSavedMealsByType = async (mealType) => {
  return await foodDb.savedMeals.where('mealType').equals(mealType).toArray();
};

export const addSavedMeal = async (meal) => {
  return await foodDb.savedMeals.add({
    name: meal.name,
    mealType: meal.mealType,
    items: meal.items,
    totalKcal: meal.totalKcal,
    createdAt: Date.now(),
  });
};

export const deleteSavedMeal = async (id) => {
  return await foodDb.savedMeals.delete(id);
};

// ========== APP SETTINGS (key-value store) ==========

export const getNutritionGoals = async () => {
  const row = await foodDb.appSettings.get('nutritionGoals');
  return row ? row.value : null;
};

export const saveNutritionGoals = async (goals) => {
  return await foodDb.appSettings.put({ key: 'nutritionGoals', value: goals });
};

// Goal history: array of { effectiveFrom: "YYYY-MM-DD", kcalTarget, proteinPct, carbsPct, fatPct }
// Sorted by effectiveFrom descending (newest first)
export const getGoalHistory = async () => {
  const row = await foodDb.appSettings.get('goalHistory');
  return row ? row.value : [];
};

export const saveGoalHistory = async (history) => {
  return await foodDb.appSettings.put({ key: 'goalHistory', value: history });
};

// Returns the goal that was active on a given date
export const getGoalForDate = (goalHistory, date) => {
  if (!goalHistory || goalHistory.length === 0) return null;
  // goalHistory sorted descending by effectiveFrom
  for (const g of goalHistory) {
    if (date >= g.effectiveFrom) return g;
  }
  // If date is before all entries, use the oldest one
  return goalHistory[goalHistory.length - 1];
};

// Returns a weighted-average goal across a period [startDate, endDate] inclusive.
// For each day in the range, looks up the active goal, then averages by days-active.
// Fallback: if no goalHistory, returns currentGoal.
// Returns an object with the same numeric fields as a goal (kcalTarget, pGrams, cGrams, fGrams, proteinPct, carbsPct, fatPct).
export const getWeightedGoalForPeriod = (goalHistory, startDate, endDate, currentGoal) => {
  const fields = ['kcalTarget', 'pGrams', 'cGrams', 'fGrams', 'proteinPct', 'carbsPct', 'fatPct'];
  const fallback = currentGoal || {};
  if (!goalHistory || goalHistory.length === 0) {
    const out = {};
    for (const f of fields) out[f] = fallback[f] || 0;
    return out;
  }
  // Iterate days
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const sums = {}; const count = {};
  for (const f of fields) { sums[f] = 0; count[f] = 0; }
  let totalDays = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const g = getGoalForDate(goalHistory, iso) || fallback;
    for (const f of fields) {
      if (g[f] != null) { sums[f] += g[f]; count[f] += 1; }
    }
    totalDays++;
  }
  const out = {};
  for (const f of fields) {
    out[f] = count[f] > 0 ? Math.round((sums[f] / count[f]) * 10) / 10 : (fallback[f] || 0);
  }
  return out;
};

// ========== RESET / DEMO DATA ==========

export const clearAllFoodData = async (alsoDatabase = true) => {
  await foodDb.foodEntries.clear();
  await foodDb.savedMeals.clear();
  if (alsoDatabase) {
    await foodDb.cachedFoods.clear();
  }
  // Keep appSettings (nutrition goals etc.)
};

// Sync reset to Google Sheets (clear Diario + Riepilogo, optionally Database)
export const syncResetToSheets = async (url, clearDatabase = false) => {
  if (!url) return;
  // Clear Diario
  await fetch(url, {
    method: "POST", redirect: "follow",
    body: JSON.stringify({ action: "clear", sheet: "Diario" }),
  });
  // Clear Riepilogo
  await fetch(url, {
    method: "POST", redirect: "follow",
    body: JSON.stringify({ action: "clear", sheet: "Riepilogo" }),
  });
  // Optionally clear Database Alimenti
  if (clearDatabase) {
    await fetch(url, {
      method: "POST", redirect: "follow",
      body: JSON.stringify({ action: "clear", sheet: "Database Alimenti" }),
    });
  }
  await saveLastSyncTime(new Date().toISOString());
};

export const populateDemoData = async () => {
  // Clear existing food entries first
  await foodDb.foodEntries.clear();

  const today = new Date();
  const entries = [];

  // Common Italian foods with realistic per-100g macros
  const foods = [
    { foodName: "Petto di pollo", kcalPer100: 165, proteinPer100: 31, carbsPer100: 0, fatPer100: 3.6, category: "Proteine" },
    { foodName: "Riso basmati", kcalPer100: 350, proteinPer100: 7.1, carbsPer100: 78, fatPer100: 0.7, category: "Cereali" },
    { foodName: "Pasta integrale", kcalPer100: 348, proteinPer100: 13, carbsPer100: 66, fatPer100: 2.5, category: "Cereali" },
    { foodName: "Uova", kcalPer100: 155, proteinPer100: 13, carbsPer100: 1.1, fatPer100: 11, category: "Proteine" },
    { foodName: "Pane integrale", kcalPer100: 250, proteinPer100: 8, carbsPer100: 46, fatPer100: 3.5, category: "Cereali" },
    { foodName: "Yogurt greco 0%", kcalPer100: 59, proteinPer100: 10, carbsPer100: 3.6, fatPer100: 0.7, category: "Latticini" },
    { foodName: "Banana", kcalPer100: 89, proteinPer100: 1.1, carbsPer100: 23, fatPer100: 0.3, category: "Frutta" },
    { foodName: "Mela", kcalPer100: 52, proteinPer100: 0.3, carbsPer100: 14, fatPer100: 0.2, category: "Frutta" },
    { foodName: "Salmone", kcalPer100: 208, proteinPer100: 20, carbsPer100: 0, fatPer100: 13, category: "Proteine" },
    { foodName: "Tonno in scatola", kcalPer100: 130, proteinPer100: 26, carbsPer100: 0, fatPer100: 2.5, category: "Proteine" },
    { foodName: "Olio EVO", kcalPer100: 884, proteinPer100: 0, carbsPer100: 0, fatPer100: 100, category: "Condimenti" },
    { foodName: "Insalata mista", kcalPer100: 20, proteinPer100: 1.5, carbsPer100: 3, fatPer100: 0.2, category: "Verdure" },
    { foodName: "Pomodori", kcalPer100: 18, proteinPer100: 0.9, carbsPer100: 3.9, fatPer100: 0.2, category: "Verdure" },
    { foodName: "Latte parzialmente scremato", kcalPer100: 46, proteinPer100: 3.3, carbsPer100: 5, fatPer100: 1.5, category: "Latticini" },
    { foodName: "Mozzarella", kcalPer100: 280, proteinPer100: 22, carbsPer100: 2.2, fatPer100: 20, category: "Latticini" },
    { foodName: "Bresaola", kcalPer100: 151, proteinPer100: 32, carbsPer100: 0, fatPer100: 2.6, category: "Proteine" },
    { foodName: "Patate", kcalPer100: 77, proteinPer100: 2, carbsPer100: 17, fatPer100: 0.1, category: "Verdure" },
    { foodName: "Mandorle", kcalPer100: 579, proteinPer100: 21, carbsPer100: 22, fatPer100: 50, category: "Frutta secca" },
    { foodName: "Avena", kcalPer100: 372, proteinPer100: 13, carbsPer100: 60, fatPer100: 7, category: "Cereali" },
    { foodName: "Parmigiano", kcalPer100: 392, proteinPer100: 36, carbsPer100: 0, fatPer100: 28, category: "Latticini" },
    { foodName: "Zucchine", kcalPer100: 17, proteinPer100: 1.2, carbsPer100: 3.1, fatPer100: 0.3, category: "Verdure" },
    { foodName: "Prosciutto cotto", kcalPer100: 145, proteinPer100: 20, carbsPer100: 1, fatPer100: 7, category: "Proteine" },
    { foodName: "Caffè", kcalPer100: 2, proteinPer100: 0.1, carbsPer100: 0, fatPer100: 0, category: "Bevande" },
    { foodName: "Cracker integrali", kcalPer100: 415, proteinPer100: 10, carbsPer100: 68, fatPer100: 12, category: "Cereali" },
  ];

  // Meal templates (indices into foods array + grams)
  const breakfastOptions = [
    [{ fi: 5, g: 170 }, { fi: 6, g: 120 }, { fi: 18, g: 40 }, { fi: 22, g: 30 }],  // yogurt + banana + avena + caffè
    [{ fi: 3, g: 120 }, { fi: 4, g: 60 }, { fi: 13, g: 200 }, { fi: 22, g: 30 }],   // uova + pane + latte + caffè
    [{ fi: 5, g: 200 }, { fi: 7, g: 150 }, { fi: 17, g: 15 }, { fi: 22, g: 30 }],   // yogurt + mela + mandorle + caffè
    [{ fi: 18, g: 50 }, { fi: 13, g: 250 }, { fi: 6, g: 100 }, { fi: 22, g: 30 }],  // avena + latte + banana + caffè
  ];
  const lunchOptions = [
    [{ fi: 0, g: 150 }, { fi: 1, g: 80 }, { fi: 11, g: 100 }, { fi: 10, g: 10 }],  // pollo + riso + insalata + olio
    [{ fi: 2, g: 80 }, { fi: 12, g: 100 }, { fi: 14, g: 60 }, { fi: 10, g: 10 }],   // pasta + pomodori + mozzarella + olio
    [{ fi: 8, g: 150 }, { fi: 16, g: 200 }, { fi: 11, g: 80 }, { fi: 10, g: 10 }],  // salmone + patate + insalata + olio
    [{ fi: 9, g: 120 }, { fi: 2, g: 80 }, { fi: 12, g: 80 }, { fi: 10, g: 8 }],     // tonno + pasta + pomodori + olio
    [{ fi: 0, g: 180 }, { fi: 20, g: 150 }, { fi: 19, g: 10 }, { fi: 10, g: 10 }],  // pollo + zucchine + parmigiano + olio
  ];
  const snackOptions = [
    [{ fi: 7, g: 180 }],           // mela
    [{ fi: 17, g: 25 }],           // mandorle
    [{ fi: 5, g: 125 }],           // yogurt
    [{ fi: 23, g: 30 }],           // cracker
    [{ fi: 6, g: 100 }],           // banana
    [{ fi: 5, g: 150 }, { fi: 17, g: 10 }], // yogurt + mandorle
  ];
  const dinnerOptions = [
    [{ fi: 0, g: 180 }, { fi: 11, g: 120 }, { fi: 12, g: 80 }, { fi: 10, g: 10 }],  // pollo + insalata + pomodori + olio
    [{ fi: 8, g: 130 }, { fi: 20, g: 200 }, { fi: 10, g: 10 }],                       // salmone + zucchine + olio
    [{ fi: 3, g: 120 }, { fi: 15, g: 60 }, { fi: 11, g: 100 }, { fi: 4, g: 40 }],    // uova + bresaola + insalata + pane
    [{ fi: 14, g: 100 }, { fi: 12, g: 120 }, { fi: 4, g: 50 }, { fi: 10, g: 8 }],    // mozzarella + pomodori + pane + olio
    [{ fi: 9, g: 100 }, { fi: 11, g: 150 }, { fi: 16, g: 150 }, { fi: 10, g: 10 }],  // tonno + insalata + patate + olio
    [{ fi: 21, g: 80 }, { fi: 2, g: 70 }, { fi: 12, g: 80 }, { fi: 19, g: 10 }],     // prosciutto + pasta + pomodori + parmigiano
  ];

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const vary = (g, pct = 0.15) => Math.round(g * (1 + (Math.random() - 0.5) * 2 * pct));

  for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
    const d = new Date(today);
    d.setDate(d.getDate() - dayOffset);
    const dateStr = d.toISOString().split("T")[0];

    // Skip ~2 random days to make it realistic
    if (dayOffset > 0 && dayOffset < 30 && Math.random() < 0.07) continue;

    const meals = [
      { type: "breakfast", items: pick(breakfastOptions) },
      { type: "lunch", items: pick(lunchOptions) },
      { type: "dinner", items: pick(dinnerOptions) },
    ];
    // Add snack ~70% of days
    if (Math.random() < 0.7) {
      meals.push({ type: "snack", items: pick(snackOptions) });
    }

    for (const meal of meals) {
      for (const item of meal.items) {
        const food = foods[item.fi];
        const g = vary(item.g);
        const m = g / 100;
        entries.push({
          date: dateStr,
          mealType: meal.type,
          foodName: food.foodName,
          brand: "",
          grams: g,
          kcal: Math.round(food.kcalPer100 * m),
          protein: +(food.proteinPer100 * m).toFixed(1),
          carbs: +(food.carbsPer100 * m).toFixed(1),
          fat: +(food.fatPer100 * m).toFixed(1),
          kcalPer100: food.kcalPer100,
          proteinPer100: food.proteinPer100,
          carbsPer100: food.carbsPer100,
          fatPer100: food.fatPer100,
          fiberPer100: 0,
          category: food.category,
          source: "demo",
          isCheat: false,
        });
      }
    }

    // Add a cheat meal ~10% of days (weekends more likely)
    const dow = d.getDay();
    if ((dow === 0 || dow === 6) ? Math.random() < 0.3 : Math.random() < 0.08) {
      const cheats = [
        { foodName: "Pizza Margherita", g: 300, kcal: 750, protein: 28, carbs: 90, fat: 28 },
        { foodName: "Tiramisù", g: 150, kcal: 450, protein: 8, carbs: 42, fat: 28 },
        { foodName: "Gelato", g: 200, kcal: 420, protein: 6, carbs: 52, fat: 20 },
        { foodName: "Hamburger", g: 250, kcal: 580, protein: 32, carbs: 40, fat: 30 },
      ];
      const cheat = pick(cheats);
      entries.push({
        date: dateStr,
        mealType: dow === 0 || dow === 6 ? "lunch" : "dinner",
        foodName: cheat.foodName,
        brand: "",
        grams: cheat.g,
        kcal: cheat.kcal,
        protein: cheat.protein,
        carbs: cheat.carbs,
        fat: cheat.fat,
        kcalPer100: Math.round((cheat.kcal / cheat.g) * 100),
        proteinPer100: +((cheat.protein / cheat.g) * 100).toFixed(1),
        carbsPer100: +((cheat.carbs / cheat.g) * 100).toFixed(1),
        fatPer100: +((cheat.fat / cheat.g) * 100).toFixed(1),
        fiberPer100: 0,
        category: "Sgarro",
        source: "demo",
        isCheat: true,
      });
    }
  }

  await foodDb.foodEntries.bulkAdd(entries);
  return entries.length;
};

// ========== GOOGLE SHEETS SYNC ==========

// Get the stored Sheets webhook URL
export const getSheetsUrl = async () => {
  const row = await foodDb.appSettings.get('sheetsUrl');
  return row ? row.value : "";
};

export const saveSheetsUrl = async (url) => {
  return await foodDb.appSettings.put({ key: 'sheetsUrl', value: url });
};

// Get last sync timestamp
export const getLastSyncTime = async () => {
  const row = await foodDb.appSettings.get('lastSyncTime');
  return row ? row.value : null;
};

export const saveLastSyncTime = async (ts) => {
  return await foodDb.appSettings.put({ key: 'lastSyncTime', value: ts });
};

// Auto-sync setting
export const getAutoSync = async () => {
  const row = await foodDb.appSettings.get('autoSync');
  return row ? row.value : false;
};

export const saveAutoSync = async (enabled) => {
  return await foodDb.appSettings.put({ key: 'autoSync', value: enabled });
};

// Ping the webhook to verify connection
export const pingSheets = async (url) => {
  try {
    const res = await fetch(url + "?action=ping");
    const json = await res.json();
    return json.success === true;
  } catch {
    return false;
  }
};

// Full sync — sends all data to Google Sheets
export const fullSyncToSheets = async (url, nutritionGoals) => {
  // 1. All food entries → Diario
  const allEntries = await foodDb.foodEntries.toArray();
  const diario = allEntries.map(e => ({
    date: e.date, mealType: e.mealType, foodName: e.foodName,
    brand: e.brand || "", grams: e.grams, kcal: e.kcal,
    protein: e.protein, carbs: e.carbs, fat: e.fat,
    category: e.category || "", isCheat: e.isCheat || false,
  }));

  // 2. Daily totals → Riepilogo (with targets)
  const byDate = {};
  for (const e of allEntries) {
    if (!byDate[e.date]) byDate[e.date] = { date: e.date, kcal: 0, protein: 0, carbs: 0, fat: 0 };
    byDate[e.date].kcal += e.kcal || 0;
    byDate[e.date].protein += e.protein || 0;
    byDate[e.date].carbs += e.carbs || 0;
    byDate[e.date].fat += e.fat || 0;
  }
  const goals = nutritionGoals || { kcalTarget: 2000, proteinPct: 30, carbsPct: 40, fatPct: 30 };
  const tKcal = goals.kcalTarget || 2000;
  const tP = (tKcal * (goals.proteinPct || 30) / 100) / 4;
  const tC = (tKcal * (goals.carbsPct || 40) / 100) / 4;
  const tG = (tKcal * (goals.fatPct || 30) / 100) / 9;
  const riepilogo = Object.values(byDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      ...d, targetKcal: tKcal, targetP: Math.round(tP), targetC: Math.round(tC), targetG: Math.round(tG),
    }));

  // 3. Cached foods + unique foods from entries → Database Alimenti
  const cached = await foodDb.cachedFoods.toArray();
  const dbMap = new Map();
  // From cache
  for (const f of cached) {
    const key = (f.name || f.foodName || "").toLowerCase();
    if (key && !dbMap.has(key)) {
      dbMap.set(key, {
        name: f.name || f.foodName, brand: f.brand || "", barcode: f.barcode || "",
        kcalPer100: f.kcalPer100 || 0, proteinPer100: f.proteinPer100 || 0,
        carbsPer100: f.carbsPer100 || 0, fatPer100: f.fatPer100 || 0,
        category: f.category || "", source: f.source || "cache",
      });
    }
  }
  // From entries (foods that might not be cached)
  for (const e of allEntries) {
    const key = (e.foodName || "").toLowerCase();
    if (key && !dbMap.has(key) && e.kcalPer100) {
      dbMap.set(key, {
        name: e.foodName, brand: e.brand || "", barcode: "",
        kcalPer100: e.kcalPer100 || 0, proteinPer100: e.proteinPer100 || 0,
        carbsPer100: e.carbsPer100 || 0, fatPer100: e.fatPer100 || 0,
        category: e.category || "", source: e.source || "entry",
      });
    }
  }
  const database = Array.from(dbMap.values());

  // Send to Google Sheets (no Content-Type header to avoid CORS preflight)
  const res = await fetch(url, {
    method: "POST",
    redirect: "follow",
    body: JSON.stringify({
      action: "sync",
      fullSync: true,
      diario,
      riepilogo,
      database,
    }),
  });
  const json = await res.json();
  if (json.success) {
    await saveLastSyncTime(Date.now());
  }
  return json;
};

// Restore from Google Sheets → local DB
export const restoreFromSheets = async (url) => {
  const res = await fetch(url + "?action=export");
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Errore nel ripristino");

  const data = json.data;
  let counts = { diario: 0, database: 0 };

  // Restore Diario → foodEntries
  if (data["Diario"] && data["Diario"].length > 0) {
    await foodDb.foodEntries.clear();
    const entries = data["Diario"].map(r => ({
      date: String(r.data || ""),
      mealType: r.pasto || "lunch",
      foodName: r.cibo || "",
      brand: r.brand || "",
      grams: Number(r.grammi) || 0,
      kcal: Number(r.kcal) || 0,
      protein: Number(r.proteine) || 0,
      carbs: Number(r.carbo) || 0,
      fat: Number(r.grassi) || 0,
      kcalPer100: 0, proteinPer100: 0, carbsPer100: 0, fatPer100: 0,
      category: r.categoria || "",
      source: "sheets",
      isCheat: r.sgarro === "SI",
    }));
    await foodDb.foodEntries.bulkAdd(entries);
    counts.diario = entries.length;
  }

  // Restore Database Alimenti → cachedFoods
  if (data["Database Alimenti"] && data["Database Alimenti"].length > 0) {
    const foods = data["Database Alimenti"];
    for (const f of foods) {
      const id = (f.nome || "").toLowerCase().replace(/\s+/g, "_") + "_" + (f.barcode || "nobc");
      await foodDb.cachedFoods.put({
        id,
        name: f.nome || "",
        foodName: f.nome || "",
        brand: f.brand || "",
        barcode: f.barcode || "",
        kcalPer100: Number(f.kcalPer100) || 0,
        proteinPer100: Number(f.proteinePer100) || 0,
        carbsPer100: Number(f.carboPer100) || 0,
        fatPer100: Number(f.grassiPer100) || 0,
        category: f.categoria || "",
        source: f.fonte || "sheets",
        lastUsed: Date.now(),
      });
    }
    counts.database = foods.length;
  }

  await saveLastSyncTime(Date.now());
  return counts;
};

// ========== FITNESS ACTIVITIES ==========

/**
 * Aggiunge una nuova sessione di camminata.
 * @param {{ date: string, distanceKm: number, durationMin: number, paceMinKm: number }} activity
 */
export const addFitnessActivity = async (activity) => {
  return await foodDb.fitnessActivities.add({
    ...activity,
    createdAt: Date.now(),
  });
};

/**
 * Restituisce tutte le attività in un intervallo di date [startDate, endDate] inclusivo.
 * @param {string} startDate  YYYY-MM-DD
 * @param {string} endDate    YYYY-MM-DD
 */
export const getFitnessActivitiesByDateRange = async (startDate, endDate) => {
  return await foodDb.fitnessActivities
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();
};

/**
 * Elimina una sessione per id.
 */
export const deleteFitnessActivity = async (id) => {
  return await foodDb.fitnessActivities.delete(id);
};

/**
 * Modifica una sessione esistente.
 */
export const updateFitnessActivity = async (id, changes) => {
  return await foodDb.fitnessActivities.update(id, changes);
};

/**
 * Restituisce l'ultima sessione inserita (per pre-compilare il form).
 */
export const getLastFitnessActivity = async () => {
  const all = await foodDb.fitnessActivities.orderBy('id').reverse().first();
  return all || null;
};

// ========== FITNESS SETTINGS ==========

/**
 * Legge l'obiettivo km settimanale (default: 20).
 */
export const getWeeklyGoalKm = async () => {
  const row = await foodDb.appSettings.get('fitnessWeeklyGoalKm');
  return row ? row.value : 20;
};

/**
 * Salva l'obiettivo km settimanale.
 */
export const saveWeeklyGoalKm = async (km) => {
  return await foodDb.appSettings.put({ key: 'fitnessWeeklyGoalKm', value: km });
};

// ========== GYM WORKOUTS ==========

export const addGymWorkout = async (workout) => {
  return await foodDb.gymWorkouts.add({ ...workout, createdAt: Date.now() });
};

export const updateGymWorkout = async (id, changes) => {
  return await foodDb.gymWorkouts.update(id, changes);
};

export const deleteGymWorkout = async (id) => {
  await foodDb.gymSets.where('workoutId').equals(id).delete();
  return await foodDb.gymWorkouts.delete(id);
};

export const getAllGymWorkouts = async () => {
  return await foodDb.gymWorkouts.orderBy('id').reverse().toArray();
};

export const getGymWorkoutsByDateRange = async (startDate, endDate) => {
  return await foodDb.gymWorkouts.where('date').between(startDate, endDate, true, true).toArray();
};

// ========== GYM SETS ==========

export const addGymSets = async (sets) => {
  return await foodDb.gymSets.bulkAdd(sets);
};

export const getGymSetsByWorkout = async (workoutId) => {
  return await foodDb.gymSets.where('workoutId').equals(workoutId).toArray();
};

export const getGymSetsByExercise = async (exerciseId) => {
  return await foodDb.gymSets.where('exerciseId').equals(exerciseId).toArray();
};

export const updateGymSet = async (id, changes) => {
  return await foodDb.gymSets.update(id, changes);
};

export const deleteGymSet = async (id) => {
  return await foodDb.gymSets.delete(id);
};

// ========== GYM ROUTINES ==========

export const getAllGymRoutines = async () => {
  return await foodDb.gymRoutines.toArray();
};

export const addGymRoutine = async (routine) => {
  return await foodDb.gymRoutines.add({ ...routine, createdAt: Date.now() });
};

export const updateGymRoutine = async (id, changes) => {
  return await foodDb.gymRoutines.update(id, changes);
};

export const deleteGymRoutine = async (id) => {
  return await foodDb.gymRoutines.delete(id);
};

// ========== GYM CUSTOM EXERCISES ==========

export const getAllGymCustomExercises = async () => {
  return await foodDb.gymCustomExercises.toArray();
};

export const addGymCustomExercise = async (exercise) => {
  return await foodDb.gymCustomExercises.add({ ...exercise, createdAt: Date.now() });
};

export const deleteGymCustomExercise = async (id) => {
  return await foodDb.gymCustomExercises.delete(id);
};

// ========== GYM SETTINGS ==========

export const getGymRestTimer = async () => {
  const row = await foodDb.appSettings.get('gymRestTimer');
  return row ? row.value : 90;
};

export const saveGymRestTimer = async (seconds) => {
  return await foodDb.appSettings.put({ key: 'gymRestTimer', value: seconds });
};

export const getAllGymSets = async () => {
  return await foodDb.gymSets.toArray();
};

export const getGymPrecMode = async () => {
  const row = await foodDb.appSettings.get('gymPrecMode');
  return row ? row.value : 'routine';
};

export const saveGymPrecMode = async (mode) => {
  return await foodDb.appSettings.put({ key: 'gymPrecMode', value: mode });
};

export default foodDb;
