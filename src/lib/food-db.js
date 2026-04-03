// food-db.js — Dexie database for food tracking (separate from weight DB)
import Dexie from 'dexie';

const foodDb = new Dexie('FoodTrackerDB');

foodDb.version(3).stores({
  foodEntries: '++id, date, mealType',
  cachedFoods: 'id, barcode',
  savedMeals: '++id, mealType',
  appSettings: 'key',
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
    if (!byDate[e.date]) byDate[e.date] = { date: e.date, kcal: 0, protein: 0, carbs: 0, fat: 0 };
    byDate[e.date].kcal += e.kcal || 0;
    byDate[e.date].protein += e.protein || 0;
    byDate[e.date].carbs += e.carbs || 0;
    byDate[e.date].fat += e.fat || 0;
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

export default foodDb;
