import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import {
  Utensils, Plus, Search, Star, Clock, ChevronLeft, ChevronRight, Trash2, Edit3,
  Check, X, Target, Zap, Activity, BarChart3, Calendar, Camera, Bookmark,
  Coffee, Sun as LunchIcon, Moon as DinnerIcon, Cookie, Info, Settings,
  Heart, Flame, Droplets, Award, TrendingUp, TrendingDown, ScanLine, ChevronUp,
  ChevronDown, Home,
} from 'lucide-react';
import { FOOD_DATABASE as EXTERNAL_DB } from './food-database';

// Fallback food database if import fails
const FALLBACK_DB = [
  { id: 1, name: 'Petto di pollo (cotto)', kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, category: 'Proteine' },
  { id: 2, name: 'Riso bianco (cotto)', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, category: 'Cereali' },
  { id: 3, name: 'Broccoli (cotto)', kcal: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.4, category: 'Verdure' },
  { id: 4, name: 'Olio di oliva', kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, category: 'Grassi' },
  { id: 5, name: 'Banana', kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, category: 'Frutta' },
  { id: 6, name: 'Uovo intero', kcal: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0, category: 'Proteine' },
  { id: 7, name: 'Pane integrale', kcal: 247, protein: 8.7, carbs: 41, fat: 3.3, fiber: 6.8, category: 'Cereali' },
  { id: 8, name: 'Mela', kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, category: 'Frutta' },
  { id: 9, name: 'Salmone (cotto)', kcal: 280, protein: 25, carbs: 0, fat: 20, fiber: 0, category: 'Proteine' },
  { id: 10, name: 'Pasta bianca (cotta)', kcal: 131, protein: 5, carbs: 25, fat: 1.1, fiber: 1.8, category: 'Cereali' },
  { id: 11, name: 'Formaggio cheddar', kcal: 403, protein: 23, carbs: 3.3, fat: 33, fiber: 0, category: 'Latticini' },
  { id: 12, name: 'Latte intero', kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0, category: 'Latticini' },
  { id: 13, name: 'Yogurt greco (natura)', kcal: 59, protein: 10, carbs: 3.3, fat: 0.4, fiber: 0, category: 'Latticini' },
  { id: 14, name: 'Bistecca di manzo', kcal: 250, protein: 26, carbs: 0, fat: 15, fiber: 0, category: 'Proteine' },
  { id: 15, name: 'Carota (cruda)', kcal: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8, category: 'Verdure' },
  { id: 16, name: 'Avocado', kcal: 160, protein: 2, carbs: 9, fat: 15, fiber: 7, category: 'Frutta' },
  { id: 17, name: 'Melanzana (cotta)', kcal: 35, protein: 0.8, carbs: 9, fat: 0.2, fiber: 3, category: 'Verdure' },
  { id: 18, name: 'Noci', kcal: 654, protein: 9.3, carbs: 14, fat: 65, fiber: 6.7, category: 'Noci' },
  { id: 19, name: 'Miele', kcal: 304, protein: 0.3, carbs: 82, fat: 0, fiber: 0.2, category: 'Dolcificanti' },
  { id: 20, name: 'Caffè (nero)', kcal: 2, protein: 0.2, carbs: 0, fat: 0, fiber: 0, category: 'Bevande' },
];

// Use external DB if available, fallback to inline
const FOOD_DATABASE = (typeof EXTERNAL_DB !== 'undefined' && EXTERNAL_DB.length > 0) ? EXTERNAL_DB : FALLBACK_DB;

// Sample data generator
const generateSampleData = () => {
  const today = new Date();
  const data = [];
  const meals = [
    { type: 'breakfast', name: 'Colazione', icon: Coffee },
    { type: 'lunch', name: 'Pranzo', icon: LunchIcon },
    { type: 'dinner', name: 'Cena', icon: DinnerIcon },
    { type: 'snack', name: 'Spuntini', icon: Cookie },
  ];

  for (let i = 0; i < 3; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    // Add 2-3 meals per day
    if (i === 0 || i === 1) {
      data.push(
        { id: `${dateStr}-1`, date: dateStr, mealType: 'breakfast', foodName: 'Petto di pollo (cotto)', grams: 150, kcal: 248, protein: 46.5, carbs: 0, fat: 5.4 },
        { id: `${dateStr}-2`, date: dateStr, mealType: 'breakfast', foodName: 'Riso bianco (cotto)', grams: 150, kcal: 195, protein: 4.05, carbs: 42, fat: 0.45 },
        { id: `${dateStr}-3`, date: dateStr, mealType: 'lunch', foodName: 'Salmone (cotto)', grams: 120, kcal: 336, protein: 30, carbs: 0, fat: 24 },
        { id: `${dateStr}-4`, date: dateStr, mealType: 'lunch', foodName: 'Broccoli (cotto)', grams: 200, kcal: 68, protein: 5.6, carbs: 14, fat: 0.8 },
        { id: `${dateStr}-5`, date: dateStr, mealType: 'snack', foodName: 'Banana', grams: 120, kcal: 107, protein: 1.32, carbs: 27.6, fat: 0.36 },
      );
    }
  }

  return data;
};

export default function FoodSection({ settings, weightEntries, goTo, T }) {
  const [foodScreen, setFoodScreen] = useState('dashboard');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [foodEntries, setFoodEntries] = useState(generateSampleData());
  const [customFoods, setCustomFoods] = useState([]);
  const [savedMeals, setSavedMeals] = useState([]);
  const [nutritionGoals, setNutritionGoals] = useState({
    kcalTarget: 2000,
    proteinPct: 30,
    carbsPct: 40,
    fatPct: 30,
    age: 30,
    sex: 'M',
    activityLevel: 'moderate',
  });
  const [expandedMeals, setExpandedMeals] = useState({
    breakfast: true,
    lunch: false,
    dinner: false,
    snack: false,
  });
  const [selectedFood, setSelectedFood] = useState(null);
  const [selectedMealType, setSelectedMealType] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('search');
  const [portionGrams, setPortionGrams] = useState(100);
  const [recentsView, setRecentsView] = useState([]);
  const [favorites, setFavorites] = useState(new Set());
  const [barcodeScannerActive, setBarcodeScannerActive] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const cameraRef = useRef(null);

  const mealTypes = [
    { type: 'breakfast', name: 'Colazione', icon: Coffee },
    { type: 'lunch', name: 'Pranzo', icon: LunchIcon },
    { type: 'dinner', name: 'Cena', icon: DinnerIcon },
    { type: 'snack', name: 'Spuntini', icon: Cookie },
  ];

  // Utility functions
  const getTodayString = () => new Date().toISOString().split('T')[0];
  const getDayString = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date(getTodayString() + 'T00:00:00');
    const diff = today - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Oggi';
    if (days === 1) return 'Ieri';
    return date.toLocaleDateString('it-IT', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getTodaysMeals = (dateStr = selectedDate) => {
    return foodEntries.filter((entry) => entry.date === dateStr);
  };

  const getMealsByType = (dateStr, mealType) => {
    return getTodaysMeals(dateStr).filter((entry) => entry.mealType === mealType);
  };

  const getDailyTotals = (dateStr = selectedDate) => {
    const meals = getTodaysMeals(dateStr);
    const totals = {
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
    meals.forEach((meal) => {
      totals.kcal += meal.kcal;
      totals.protein += meal.protein;
      totals.carbs += meal.carbs;
      totals.fat += meal.fat;
    });
    return totals;
  };

  const handleAddFood = (food, grams, mealType) => {
    const kcal = Math.round((food.kcal * grams) / 100);
    const protein = Math.round((food.protein * grams) / 100 * 10) / 10;
    const carbs = Math.round((food.carbs * grams) / 100 * 10) / 10;
    const fat = Math.round((food.fat * grams) / 100 * 10) / 10;

    const newEntry = {
      id: `${Date.now()}-${Math.random()}`,
      date: selectedDate,
      mealType,
      foodName: food.name,
      grams,
      kcal,
      protein,
      carbs,
      fat,
    };

    setFoodEntries([...foodEntries, newEntry]);
    setRecentsView([food, ...recentsView.filter((f) => f.id !== food.id)].slice(0, 20));
    setFoodScreen('dashboard');
    setSelectedFood(null);
  };

  const handleDeleteEntry = (entryId) => {
    setFoodEntries(foodEntries.filter((entry) => entry.id !== entryId));
  };

  const handleNextDay = () => {
    const date = new Date(selectedDate + 'T00:00:00');
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handlePrevDay = () => {
    const date = new Date(selectedDate + 'T00:00:00');
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(getTodayString());
  };

  const toggleFavorite = (foodId) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(foodId)) {
      newFavorites.delete(foodId);
    } else {
      newFavorites.add(foodId);
    }
    setFavorites(newFavorites);
  };

  const getCalorieRemaining = () => {
    const totals = getDailyTotals();
    return Math.max(0, nutritionGoals.kcalTarget - totals.kcal);
  };

  const getProteingTarget = () => {
    return Math.round((nutritionGoals.kcalTarget * (nutritionGoals.proteinPct / 100)) / 4);
  };

  const getCarbsTarget = () => {
    return Math.round((nutritionGoals.kcalTarget * (nutritionGoals.carbsPct / 100)) / 4);
  };

  const getFatTarget = () => {
    return Math.round((nutritionGoals.kcalTarget * (nutritionGoals.fatPct / 100)) / 9);
  };

  // SCREENS

  // Dashboard Screen
  const renderDashboard = () => {
    const totals = getDailyTotals();
    const remaining = getCalorieRemaining();
    const proteinTarget = getProteingTarget();
    const carbsTarget = getCarbsTarget();
    const fatTarget = getFatTarget();

    return (
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
        {/* Date Navigation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            gap: '8px',
          }}
        >
          <button
            onClick={handlePrevDay}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              color: T.teal,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: T.text,
                fontFamily: "'Inter', -apple-system, sans-serif",
              }}
            >
              {getDayString(selectedDate)}
            </div>
            <div
              style={{
                fontSize: 11,
                color: T.textMuted,
                fontFamily: "'Inter', -apple-system, sans-serif",
              }}
            >
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('it-IT', {
                month: 'short',
                day: 'numeric',
              })}
            </div>
          </div>
          <button
            onClick={handleNextDay}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              color: T.teal,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {selectedDate !== getTodayString() && (
          <div style={{ padding: '0 16px 8px' }}>
            <button
              onClick={handleToday}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: 12,
                border: `1px solid ${T.teal}`,
                background: 'transparent',
                color: T.teal,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "'Inter', -apple-system, sans-serif",
                cursor: 'pointer',
              }}
            >
              Torna a Oggi
            </button>
          </div>
        )}

        {/* Calorie Ring */}
        <div style={{ padding: '16px' }}>
          <div
            style={{
              background: T.card,
              borderRadius: 18,
              padding: '24px',
              boxShadow: T.shadow,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <svg width="160" height="160" viewBox="0 0 160 160" style={{ marginBottom: '12px' }}>
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke={T.border}
                strokeWidth="10"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke={T.teal}
                strokeWidth="10"
                strokeDasharray={`${(totals.kcal / nutritionGoals.kcalTarget) * 439.8} 439.8`}
                strokeLinecap="round"
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
              />
            </svg>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: T.text,
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                {totals.kcal}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: T.textMuted,
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  marginTop: '4px',
                }}
              >
                Rimanenti: {remaining} kcal
              </div>
            </div>
          </div>
        </div>

        {/* Macro Bars */}
        <div style={{ padding: '16px' }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: T.text,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: '12px',
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}
          >
            Macronutrienti
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Protein */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.textMuted,
                  marginBottom: '6px',
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                Proteine: {Math.round(totals.protein)}g / {proteinTarget}g
              </div>
              <div
                style={{
                  height: 8,
                  background: T.border,
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (totals.protein / proteinTarget) * 100)}%`,
                    background: '#3B82F6',
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>

            {/* Carbs */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.textMuted,
                  marginBottom: '6px',
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                Carboidrati: {Math.round(totals.carbs)}g / {carbsTarget}g
              </div>
              <div
                style={{
                  height: 8,
                  background: T.border,
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (totals.carbs / carbsTarget) * 100)}%`,
                    background: T.gold,
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>

            {/* Fat */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.textMuted,
                  marginBottom: '6px',
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                Grassi: {Math.round(totals.fat)}g / {fatTarget}g
              </div>
              <div
                style={{
                  height: 8,
                  background: T.border,
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (totals.fat / fatTarget) * 100)}%`,
                    background: T.coral,
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Meal Diary */}
        <div style={{ padding: '16px' }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: T.text,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: '12px',
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}
          >
            Diario Alimentare
          </div>

          {mealTypes.map((meal) => {
            const meals = getMealsByType(selectedDate, meal.type);
            const mealTotals = {
              kcal: meals.reduce((sum, m) => sum + m.kcal, 0),
            };
            const IconComponent = meal.icon;
            const isExpanded = expandedMeals[meal.type];

            return (
              <div
                key={meal.type}
                style={{
                  background: T.card,
                  borderRadius: 14,
                  marginBottom: '8px',
                  overflow: 'hidden',
                  boxShadow: T.shadow,
                }}
              >
                <button
                  onClick={() => {
                    setExpandedMeals({
                      ...expandedMeals,
                      [meal.type]: !isExpanded,
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <IconComponent size={18} color={T.teal} />
                    <div style={{ textAlign: 'left' }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: T.text,
                          fontFamily: "'Inter', -apple-system, sans-serif",
                        }}
                      >
                        {meal.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: T.textMuted,
                          fontFamily: "'Inter', -apple-system, sans-serif",
                        }}
                      >
                        {mealTotals.kcal} kcal · {meals.length} {meals.length === 1 ? 'cibo' : 'cibi'}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      color: T.textMuted,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </button>

                {isExpanded && (
                  <div style={{ padding: '0 16px 12px' }}>
                    {meals.length === 0 ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: T.textMuted,
                          fontStyle: 'italic',
                          padding: '8px 0',
                          fontFamily: "'Inter', -apple-system, sans-serif",
                        }}
                      >
                        Nessun cibo aggiunto
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {meals.map((mealEntry) => (
                          <div
                            key={mealEntry.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 0',
                              borderBottom: `1px solid ${T.border}`,
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: T.text,
                                  fontFamily: "'Inter', -apple-system, sans-serif",
                                }}
                              >
                                {mealEntry.foodName}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: T.textMuted,
                                  fontFamily: "'Inter', -apple-system, sans-serif",
                                }}
                              >
                                {mealEntry.grams}g · {mealEntry.kcal} kcal
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteEntry(mealEntry.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '6px',
                                color: T.coral,
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setSelectedMealType(meal.type);
                        setFoodScreen('addFood');
                      }}
                      style={{
                        marginTop: '8px',
                        width: '100%',
                        padding: '8px 12px',
                        background: T.tealLight,
                        border: 'none',
                        borderRadius: 10,
                        color: T.teal,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: "'Inter', -apple-system, sans-serif",
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <Plus size={14} />
                      Aggiungi cibo
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={() => setFoodScreen('goals')}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              border: 'none',
              background: T.gradient,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}
          >
            <Target size={14} style={{ display: 'inline', marginRight: '6px' }} />
            Obiettivi Nutrizionali
          </button>
          <button
            onClick={() => setFoodScreen('reports')}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              background: T.card,
              color: T.teal,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}
          >
            <BarChart3 size={14} style={{ display: 'inline', marginRight: '6px' }} />
            Rapporti
          </button>
        </div>
      </div>
    );
  };

  // Add Food Screen
  const renderAddFood = () => {
    const searchResults = selectedTab === 'search'
      ? [...FOOD_DATABASE, ...customFoods]
          .filter((food) =>
            food.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
      : [];

    const recents =
      selectedTab === 'recenti' ? recentsView : [];

    const favoritesList =
      selectedTab === 'preferiti'
        ? [...FOOD_DATABASE, ...customFoods].filter((food) =>
            favorites.has(food.id)
          )
        : [];

    const categories = Array.from(
      new Set([...FOOD_DATABASE, ...customFoods].map((f) => f.category || 'Altro'))
    ).sort();

    return (
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
        {/* Header */}
        <div
          style={{
            padding: '16px',
            background: T.card,
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <button
            onClick={() => setFoodScreen('dashboard')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              color: T.teal,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: T.text,
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}
          >
            Aggiungi Cibo a {
              mealTypes.find((m) => m.type === selectedMealType)?.name || 'Pasto'
            }
          </div>
        </div>

        {/* Tab Bar */}
        <div
          style={{
            display: 'flex',
            gap: '0',
            padding: '0',
            background: T.card,
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          {['search', 'recenti', 'preferiti', 'quick'].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setSelectedTab(tab);
                setSearchQuery('');
              }}
              style={{
                flex: 1,
                padding: '12px 8px',
                border: 'none',
                background:
                  selectedTab === tab ? T.gradient : 'transparent',
                color: selectedTab === tab ? '#fff' : T.textMuted,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Inter', -apple-system, sans-serif",
                borderBottom:
                  selectedTab === tab
                    ? `3px solid ${T.teal}`
                    : 'none',
                borderRadius: '0',
              }}
            >
              {tab === 'search' && 'Cerca'}
              {tab === 'recenti' && 'Recenti'}
              {tab === 'preferiti' && 'Preferiti'}
              {tab === 'quick' && 'Quick Add'}
            </button>
          ))}
        </div>

        {/* Search Tab */}
        {selectedTab === 'search' && (
          <div style={{ padding: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: T.border,
                borderRadius: 10,
                padding: '8px 12px',
                marginBottom: '12px',
              }}
            >
              <Search size={16} color={T.textMuted} style={{ marginRight: '8px' }} />
              <input
                type="text"
                placeholder="Cerca cibo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  fontSize: 13,
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  outline: 'none',
                  color: T.text,
                }}
              />
            </div>

            {/* Category Chips */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                marginBottom: '12px',
                paddingBottom: '8px',
              }}
            >
              {categories.map((cat) => (
                <button
                  key={cat}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 16,
                    border: `1px solid ${T.border}`,
                    background: T.card,
                    fontSize: 11,
                    fontWeight: 600,
                    color: T.textMuted,
                    cursor: 'pointer',
                    fontFamily: "'Inter', -apple-system, sans-serif",
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Results */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {searchResults.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '24px 16px',
                    color: T.textMuted,
                    fontSize: 12,
                    fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                >
                  Nessun risultato trovato
                </div>
              ) : (
                searchResults.map((food) => (
                  <button
                    key={food.id}
                    onClick={() => {
                      setSelectedFood(food);
                      setPortionGrams(food.defaultPortion || 100);
                      setFoodScreen('portionSelect');
                    }}
                    style={{
                      background: T.card,
                      borderRadius: 12,
                      padding: '12px',
                      border: `1px solid ${T.border}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: T.text,
                        fontFamily: "'Inter', -apple-system, sans-serif",
                      }}
                    >
                      {food.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: T.textMuted,
                        fontFamily: "'Inter', -apple-system, sans-serif",
                      }}
                    >
                      {food.kcal} kcal/100g · P: {food.protein}g C: {food.carbs}g G:{' '}
                      {food.fat}g
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Recenti Tab */}
        {selectedTab === 'recenti' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recents.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '24px',
                  color: T.textMuted,
                  fontSize: 12,
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                Nessun cibo recente
              </div>
            ) : (
              recents.map((food) => (
                <button
                  key={food.id}
                  onClick={() => {
                    setSelectedFood(food);
                    setPortionGrams(food.defaultPortion || 100);
                    setFoodScreen('portionSelect');
                  }}
                  style={{
                    background: T.card,
                    borderRadius: 12,
                    padding: '12px',
                    border: `1px solid ${T.border}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: T.text,
                      fontFamily: "'Inter', -apple-system, sans-serif",
                    }}
                  >
                    {food.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: T.textMuted,
                      fontFamily: "'Inter', -apple-system, sans-serif",
                    }}
                  >
                    {food.kcal} kcal/100g
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Preferiti Tab */}
        {selectedTab === 'preferiti' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {favoritesList.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '24px',
                  color: T.textMuted,
                  fontSize: 12,
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                Nessun cibo preferito
              </div>
            ) : (
              favoritesList.map((food) => (
                <button
                  key={food.id}
                  onClick={() => {
                    setSelectedFood(food);
                    setPortionGrams(food.defaultPortion || 100);
                    setFoodScreen('portionSelect');
                  }}
                  style={{
                    background: T.card,
                    borderRadius: 12,
                    padding: '12px',
                    border: `1px solid ${T.border}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: T.text,
                      fontFamily: "'Inter', -apple-system, sans-serif",
                    }}
                  >
                    {food.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: T.textMuted,
                      fontFamily: "'Inter', -apple-system, sans-serif",
                    }}
                  >
                    {food.kcal} kcal/100g
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Quick Add Tab */}
        {selectedTab === 'quick' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => setFoodScreen('customFood')}
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                border: 'none',
                background: T.gradient,
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Inter', -apple-system, sans-serif",
              }}
            >
              <Plus size={14} style={{ display: 'inline', marginRight: '6px' }} />
              Crea Cibo Personalizzato
            </button>

            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: T.text,
                  display: 'block',
                  marginBottom: '6px',
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                Codice a Barre (Scanner)
              </label>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                }}
              >
                <button
                  onClick={() => setBarcodeScannerActive(!barcodeScannerActive)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 10,
                    border: `1px solid ${T.border}`,
                    background: barcodeScannerActive ? T.tealLight : T.card,
                    color: barcodeScannerActive ? T.teal : T.teal,
                    cursor: 'pointer',
                    fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                >
                  <Camera size={16} style={{ display: 'inline', marginRight: '4px' }} />
                  Scansiona
                </button>
                <input
                  type="text"
                  placeholder="o inserisci codice"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1px solid ${T.border}`,
                    fontSize: 12,
                    fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: T.textMuted,
                  marginTop: '6px',
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                Nota: I codici a barre si collegano al database OpenFoodFacts (non ancora implementato)
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Portion Select Screen
  const renderPortionSelect = () => {
    if (!selectedFood) return null;

    const kcal = Math.round((selectedFood.kcal * portionGrams) / 100);
    const protein = Math.round((selectedFood.protein * portionGrams) / 100 * 10) / 10;
    const carbs = Math.round((selectedFood.carbs * portionGrams) / 100 * 10) / 10;
    const fat = Math.round((selectedFood.fat * portionGrams) / 100 * 10) / 10;

    return (
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
        {/* Header */}
        <div
          style={{
            padding: '16px',
            background: T.card,
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <button
            onClick={() => {
              setFoodScreen('addFood');
              setSelectedFood(null);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              color: T.teal,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: T.text,
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}
          >
            Porzione
          </div>
        </div>

        {/* Food Info */}
        <div style={{ padding: '16px' }}>
          <div
            style={{
              background: T.card,
              borderRadius: 14,
              padding: '16px',
              boxShadow: T.shadow,
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: T.text,
                marginBottom: '8px',
                fontFamily: "'Inter', -apple-system, sans-serif",
              }}
            >
              {selectedFood.name}
            </div>
            <div
              style={{
                fontSize: 12,
                color: T.textMuted,
                marginBottom: '12px',
                fontFamily: "'Inter', -apple-system, sans-serif",
              }}
            >
              {selectedFood.kcal} kcal per 100g
            </div>

            {/* Gram Input */}
            <div
              style={{
                marginBottom: '12px',
              }}
            >
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: T.text,
                  display: 'block',
                  marginBottom: '8px',
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                Grammi
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <button
                  onClick={() => setPortionGrams(Math.max(1, portionGrams - 10))}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: T.card,
                    cursor: 'pointer',
                    fontSize: 18,
                    color: T.teal,
                    fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                >
                  −
                </button>
                <input
                  type="number"
                  value={portionGrams}
                  onChange={(e) => setPortionGrams(Math.max(1, parseInt(e.target.value) || 0))}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    fontSize: 13,
                    textAlign: 'center',
                    fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                />
                <button
                  onClick={() => setPortionGrams(portionGrams + 10)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: T.card,
                    cursor: 'pointer',
                    fontSize: 18,
                    color: T.teal,
                    fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Quick Portion Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              {[50, 100, 150, 200].map((g) => (
                <button
                  key={g}
                  onClick={() => setPortionGrams(g)}
                  style={{
                    padding: '8px',
                    borderRadius: 10,
                    border:
                      portionGrams === g
                        ? 'none'
                        : `1px solid ${T.border}`,
                    background:
                      portionGrams === g ? T.gradient : T.card,
                    color:
                      portionGrams === g ? '#fff' : T.text,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                >
                  {g}g
                </button>
              ))}
            </div>

            {/* Nutrition Facts */}
            <div
              style={{
                background: T.bg,
                borderRadius: 10,
                padding: '12px',
                marginBottom: '12px',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: T.text,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: '8px',
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                Valori Nutrizionali
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: T.teal,
                      fontFamily: "'Inter', -apple-system, sans-serif",
                    }}
                  >
                    {kcal}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: T.textMuted,
                      fontFamily: "'Inter', -apple-system, sans-serif",
                    }}
                  >
                    Kcal
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#3B82F6',
                      fontFamily: "'Inter', -apple-system, sans-serif",
                    }}
                  >
                    P: {protein}g
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: T.textMuted,
                      fontFamily: "'Inter', -apple-system, sans-serif",
                    }}
                  >
                    Proteine
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: T.gold,
                      fontFamily: "'Inter', -apple-system, sans-serif",
                    }}
                  >
                    C: {carbs}g
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: T.textMuted,
                      fontFamily: "'Inter', -apple-system, sans-serif",
                    }}
                  >
                    Carboidrati
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: T.coral,
                      fontFamily: "'Inter', -apple-system, sans-serif",
                    }}
                  >
                    G: {fat}g
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: T.textMuted,
                      fontFamily: "'Inter', -apple-system, sans-serif",
                    }}
                  >
                    Grassi
                  </div>
                </div>
              </div>
            </div>

            {/* Favorite Button */}
            <button
              onClick={() => toggleFavorite(selectedFood.id)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                background: T.card,
                color: favorites.has(selectedFood.id) ? T.coral : T.textMuted,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Inter', -apple-system, sans-serif",
                marginBottom: '8px',
              }}
            >
              <Star
                size={14}
                style={{
                  display: 'inline',
                  marginRight: '6px',
                  fill: favorites.has(selectedFood.id) ? T.coral : 'transparent',
                }}
              />
              {favorites.has(selectedFood.id) ? 'Rimosso dai Preferiti' : 'Aggiungi ai Preferiti'}
            </button>
          </div>
        </div>

        {/* Add Button */}
        <div style={{ padding: '16px' }}>
          <button
            onClick={() => {
              handleAddFood(selectedFood, portionGrams, selectedMealType);
            }}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              border: 'none',
              background: T.gradient,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}
          >
            <Check size={14} style={{ display: 'inline', marginRight: '6px' }} />
            Aggiungi a{' '}
            {mealTypes.find((m) => m.type === selectedMealType)?.name ||
              'Pasto'}
          </button>
        </div>
      </div>
    );
  };

  // Custom Food Screen
  const renderCustomFood = () => {
    const [name, setName] = useState('');
    const [kcalPer100, setKcalPer100] = useState('');
    const [proteinPer100, setProteinPer100] = useState('');
    const [carbsPer100, setCarbsPer100] = useState('');
    const [fatPer100, setFatPer100] = useState('');
    const [defaultPortion, setDefaultPortion] = useState('100');

    const handleSaveCustomFood = () => {
      if (!name || !kcalPer100) return;

      const newFood = {
        id: `custom-${Date.now()}`,
        name,
        kcal: parseFloat(kcalPer100),
        protein: parseFloat(proteinPer100) || 0,
        carbs: parseFloat(carbsPer100) || 0,
        fat: parseFloat(fatPer100) || 0,
        fiber: 0,
        defaultPortion: parseFloat(defaultPortion) || 100,
        category: 'Personalizzato',
      };

      setCustomFoods([...customFoods, newFood]);
      setFoodScreen('addFood');
    };

    return (
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
        {/* Header */}
        <div
          style={{
            padding: '16px',
            background: T.card,
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <button
            onClick={() => setFoodScreen('addFood')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              color: T.teal,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: T.text,
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}
          >
            Cibo Personalizzato
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: T.text,
                display: 'block',
                marginBottom: '6px',
                fontFamily: "'Inter', -apple-system, sans-serif",
              }}
            >
              Nome Cibo
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. Petto di pollo"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                fontSize: 13,
                fontFamily: "'Inter', -apple-system, sans-serif",
              }}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: T.text,
                  display: 'block',
                  marginBottom: '6px',
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                Kcal / 100g
              </label>
              <input
                type="number"
                value={kcalPer100}
                onChange={(e) => setKcalPer100(e.target.value)}
                placeholder="250"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  fontSize: 13,
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: T.text,
                  display: 'block',
                  marginBottom: '6px',
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                Proteine / 100g
              </label>
              <input
                type="number"
                value={proteinPer100}
                onChange={(e) => setProteinPer100(e.target.value)}
                placeholder="25"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  fontSize: 13,
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: T.text,
                  display: 'block',
                  marginBottom: '6px',
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                Carboidrati / 100g
              </label>
              <input
                type="number"
                value={carbsPer100}
                onChange={(e) => setCarbsPer100(e.target.value)}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  fontSize: 13,
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: T.text,
                  display: 'block',
                  marginBottom: '6px',
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                Grassi / 100g
              </label>
              <input
                type="number"
                value={fatPer100}
                onChange={(e) => setFatPer100(e.target.value)}
                placeholder="15"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  fontSize: 13,
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: T.text,
                display: 'block',
                marginBottom: '6px',
                fontFamily: "'Inter', -apple-system, sans-serif",
              }}
            >
              Porzione Predefinita (grammi)
            </label>
            <input
              type="number"
              value={defaultPortion}
              onChange={(e) => setDefaultPortion(e.target.value)}
              placeholder="100"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                fontSize: 13,
                fontFamily: "'Inter', -apple-system, sans-serif",
              }}
            />
          </div>

          <button
            onClick={handleSaveCustomFood}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              border: 'none',
              background: T.gradient,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}
          >
            <Check size={14} style={{ display: 'inline', marginRight: '6px' }} />
            Salva Cibo Personalizzato
          </button>
        </div>
      </div>
    );
  };

  // Nutrition Goals Screen
  const renderGoals = () => {
    const [localGoals, setLocalGoals] = useState(nutritionGoals);
    const [useManual, setUseManual] = useState(false);
    const [manualKcal, setManualKcal] = useState(nutritionGoals.kcalTarget);

    const calculateBMR = () => {
      const weight = settings.startWeight || 70;
      const height = settings.height || 175;
      const age = localGoals.age;

      let bmr = 0;
      if (localGoals.sex === 'M') {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
      } else {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
      }

      const activityMultipliers = {
        sedentario: 1.2,
        leggero: 1.375,
        moderato: 1.55,
        attivo: 1.725,
        'molto attivo': 1.9,
      };

      const tdee = bmr * (activityMultipliers[localGoals.activityLevel] || 1.55);
      return Math.round(tdee);
    };

    const tdee = calculateBMR();

    const handleSaveGoals = () => {
      setNutritionGoals({
        ...localGoals,
        kcalTarget: useManual ? manualKcal : tdee,
      });
      setFoodScreen('dashboard');
    };

    return (
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
        {/* Header */}
        <div
          style={{
            padding: '16px',
            background: T.card,
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <button
            onClick={() => setFoodScreen('dashboard')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              color: T.teal,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: T.text,
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}
          >
            Obiettivi Nutrizionali
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          {/* TDEE Calculator */}
          <div
            style={{
              background: T.card,
              borderRadius: 14,
              padding: '16px',
              marginBottom: '16px',
              boxShadow: T.shadow,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: T.text,
                marginBottom: '12px',
                fontFamily: "'Inter', -apple-system, sans-serif",
              }}
            >
              Calcolatore TDEE
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.textMuted,
                    display: 'block',
                    marginBottom: '4px',
                    fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                >
                  Età
                </label>
                <input
                  type="number"
                  value={localGoals.age}
                  onChange={(e) =>
                    setLocalGoals({
                      ...localGoals,
                      age: parseInt(e.target.value) || 0,
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    fontSize: 12,
                    fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.textMuted,
                    display: 'block',
                    marginBottom: '4px',
                    fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                >
                  Sesso
                </label>
                <select
                  value={localGoals.sex}
                  onChange={(e) =>
                    setLocalGoals({
                      ...localGoals,
                      sex: e.target.value,
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    fontSize: 12,
                    fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                >
                  <option value="M">Uomo</option>
                  <option value="F">Donna</option>
                </select>
              </div>
            </div>

            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.textMuted,
                  display: 'block',
                  marginBottom: '4px',
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                Livello di Attività
              </label>
              <select
                value={localGoals.activityLevel}
                onChange={(e) =>
                  setLocalGoals({
                    ...localGoals,
                    activityLevel: e.target.value,
                  })
                }
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  fontSize: 12,
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  marginBottom: '12px',
                }}
              >
                <option value="sedentario">Sedentario</option>
                <option value="leggero">Leggero</option>
                <option value="moderato">Moderato</option>
                <option value="attivo">Attivo</option>
                <option value="molto attivo">Molto Attivo</option>
              </select>
            </div>

            <div
              style={{
                background: T.bg,
                borderRadius: 10,
                padding: '12px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: T.textMuted,
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                TDEE Calcolato
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: T.teal,
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                {tdee} kcal
              </div>
            </div>
          </div>

          {/* Manual Override */}
          <div
            style={{
              background: T.card,
              borderRadius: 14,
              padding: '16px',
              marginBottom: '16px',
              boxShadow: T.shadow,
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                marginBottom: '12px',
              }}
            >
              <input
                type="checkbox"
                checked={useManual}
                onChange={(e) => setUseManual(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: T.text,
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                Inserisci Manualmente
              </span>
            </label>

            {useManual && (
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.textMuted,
                    display: 'block',
                    marginBottom: '4px',
                    fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                >
                  Target Giornaliero (kcal)
                </label>
                <input
                  type="number"
                  value={manualKcal}
                  onChange={(e) => setManualKcal(parseInt(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    fontSize: 12,
                    fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                />
              </div>
            )}
          </div>

          {/* Macro Split */}
          <div
            style={{
              background: T.card,
              borderRadius: 14,
              padding: '16px',
              marginBottom: '16px',
              boxShadow: T.shadow,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: T.text,
                marginBottom: '12px',
                fontFamily: "'Inter', -apple-system, sans-serif",
              }}
            >
              Distribuzione Macronutrienti
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}
              >
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.textMuted,
                    fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                >
                  Proteine
                </label>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#3B82F6',
                    fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                >
                  {localGoals.proteinPct}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={localGoals.proteinPct}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  const remaining = 100 - val;
                  const carbPct = Math.round((localGoals.carbsPct / (localGoals.carbsPct + localGoals.fatPct)) * remaining);
                  setLocalGoals({
                    ...localGoals,
                    proteinPct: val,
                    carbsPct: carbPct,
                    fatPct: remaining - carbPct,
                  });
                }}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}
              >
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.textMuted,
                    fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                >
                  Carboidrati
                </label>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.gold,
                    fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                >
                  {localGoals.carbsPct}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={localGoals.carbsPct}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  const remaining = 100 - val;
                  const proteinPct = Math.round((localGoals.proteinPct / (localGoals.proteinPct + localGoals.fatPct)) * remaining);
                  setLocalGoals({
                    ...localGoals,
                    carbsPct: val,
                    proteinPct: proteinPct,
                    fatPct: remaining - proteinPct,
                  });
                }}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}
              >
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.textMuted,
                    fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                >
                  Grassi
                </label>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.coral,
                    fontFamily: "'Inter', -apple-system, sans-serif",
                  }}
                >
                  {localGoals.fatPct}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={localGoals.fatPct}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  const remaining = 100 - val;
                  const proteinPct = Math.round((localGoals.proteinPct / (localGoals.proteinPct + localGoals.carbsPct)) * remaining);
                  setLocalGoals({
                    ...localGoals,
                    fatPct: val,
                    proteinPct: proteinPct,
                    carbsPct: remaining - proteinPct,
                  });
                }}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <button
            onClick={handleSaveGoals}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              border: 'none',
              background: T.gradient,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}
          >
            <Check size={14} style={{ display: 'inline', marginRight: '6px' }} />
            Salva Obiettivi
          </button>
        </div>
      </div>
    );
  };

  // Reports Screen
  const renderReports = () => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayTotal = getDailyTotals(dateStr);
      last7Days.push({
        day: date.toLocaleDateString('it-IT', { weekday: 'short' }),
        kcal: dayTotal.kcal,
        target: nutritionGoals.kcalTarget,
      });
    }

    const macroData = [
      { name: 'Proteine', value: getProteingTarget(), fill: '#3B82F6' },
      { name: 'Carboidrati', value: getCarbsTarget(), fill: T.gold },
      { name: 'Grassi', value: getFatTarget(), fill: T.coral },
    ];

    const weightCalorieData = weightEntries
      .slice(-30)
      .map((entry) => {
        const dateStr = entry.date;
        const dayTotal = getDailyTotals(dateStr);
        return {
          date: new Date(dateStr + 'T00:00:00').toLocaleDateString('it-IT', {
            month: 'short',
            day: 'numeric',
          }),
          weight: entry.weight,
          kcal: dayTotal.kcal,
        };
      });

    const getAdherenceColor = (kcal) => {
      const target = nutritionGoals.kcalTarget;
      const diff = Math.abs(kcal - target);
      const tolerance = target * 0.1;
      if (diff < tolerance) return T.gold;
      if (kcal < target) return T.teal;
      return T.coral;
    };

    return (
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
        {/* Header */}
        <div
          style={{
            padding: '16px',
            background: T.card,
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <button
            onClick={() => setFoodScreen('dashboard')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              color: T.teal,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: T.text,
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}
          >
            Rapporti
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          {/* Weekly Calorie Chart */}
          <div
            style={{
              background: T.card,
              borderRadius: 14,
              padding: '16px',
              marginBottom: '16px',
              boxShadow: T.shadow,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: T.text,
                marginBottom: '12px',
                fontFamily: "'Inter', -apple-system, sans-serif",
              }}
            >
              Calorie Settimanali
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={last7Days}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: T.textMuted }}
                />
                <YAxis tick={{ fontSize: 11, fill: T.textMuted }} />
                <Tooltip
                  contentStyle={{
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                  }}
                />
                <ReferenceLine
                  y={nutritionGoals.kcalTarget}
                  stroke={T.teal}
                  strokeDasharray="3 3"
                  label={{ value: 'Target', position: 'insideTopRight', fill: T.teal, fontSize: 11 }}
                />
                <Bar dataKey="kcal" fill={T.gradient} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Macro Breakdown */}
          <div
            style={{
              background: T.card,
              borderRadius: 14,
              padding: '16px',
              marginBottom: '16px',
              boxShadow: T.shadow,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: T.text,
                marginBottom: '12px',
                fontFamily: "'Inter', -apple-system, sans-serif",
              }}
            >
              Distribuzione Macronutrienti
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={macroData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name} ${value}g`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {macroData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Weight vs Calories */}
          {weightCalorieData.length > 0 && (
            <div
              style={{
                background: T.card,
                borderRadius: 14,
                padding: '16px',
                marginBottom: '16px',
                boxShadow: T.shadow,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: T.text,
                  marginBottom: '12px',
                  fontFamily: "'Inter', -apple-system, sans-serif",
                }}
              >
                Peso vs Calorie (30 giorni)
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={weightCalorieData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: T.textMuted }}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: T.textMuted }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: T.textMuted }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: T.card,
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="weight"
                    stroke={T.teal}
                    strokeWidth={2}
                    dot={false}
                    name="Peso (kg)"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="kcal"
                    fill={T.tealLight}
                    stroke={T.gold}
                    name="Calorie"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Diet Calendar */}
          <div
            style={{
              background: T.card,
              borderRadius: 14,
              padding: '16px',
              boxShadow: T.shadow,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: T.text,
                marginBottom: '12px',
                fontFamily: "'Inter', -apple-system, sans-serif",
              }}
            >
              Calendario (Ultimi 30 giorni)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {Array.from({ length: 30 }).map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (29 - i));
                const dateStr = date.toISOString().split('T')[0];
                const dayTotal = getDailyTotals(dateStr);
                const color =
                  dayTotal.kcal === 0
                    ? T.border
                    : getAdherenceColor(dayTotal.kcal);

                return (
                  <div
                    key={i}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: 8,
                      background: color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      fontWeight: 700,
                      color: color === T.border ? T.textMuted : '#fff',
                      fontFamily: "'Inter', -apple-system, sans-serif",
                    }}
                    title={dateStr}
                  >
                    {date.getDate()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Main Component
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: T.bg,
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      {foodScreen === 'dashboard' && renderDashboard()}
      {foodScreen === 'addFood' && renderAddFood()}
      {foodScreen === 'portionSelect' && renderPortionSelect()}
      {foodScreen === 'customFood' && renderCustomFood()}
      {foodScreen === 'goals' && renderGoals()}
      {foodScreen === 'reports' && renderReports()}
    </div>
  );
}
