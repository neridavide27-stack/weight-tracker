"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  getDailyTotalsForRange, getFitnessActivitiesByDateRange,
  getGymWorkoutsByDateRange, getGymSetsByWorkout,
  getWeightedGoalForPeriod,
} from "../lib/food-db";
// Recharts available if needed for future charts:
// import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, ReferenceLine } from "recharts";
import {
  ChevronLeft, Activity, Target, Award, Zap, Flame, Brain,
  Dumbbell, Footprints, Heart, Lightbulb, CheckCircle2,
  Star, BarChart3,
} from "lucide-react";

/* ═══════════════════════════════════════════
   DESIGN TOKENS (received as props)
   ═══════════════════════════════════════════ */

const MC = { protein: "#3B82F6", carbs: "#F0B429", fat: "#E85D4E" };

/* ═══════════════════════════════════════════
   UTILITY FUNCTIONS
   ═══════════════════════════════════════════ */

const toISO = (d) => new Date(d).toISOString().split("T")[0];
const today = () => toISO(new Date());
const getMonday = (dateStr) => {
  const d = new Date(dateStr);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return toISO(d);
};
const addDays = (dateStr, n) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const round1 = (v) => Math.round(v * 10) / 10;
const round0 = (v) => Math.round(v);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const dayOfWeek = (dateStr) => (new Date(dateStr).getDay() + 6) % 7; // 0=Mon

/* ═══════════════════════════════════════════
   COMPUTE BMR / TDEE (same as main app)
   ═══════════════════════════════════════════ */

const computeBMR = ({ sex, weight, height, age }) => {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return sex === "M" ? base + 5 : base - 161;
};

const ACT_MULT = { sedentario: 1.2, leggero: 1.375, moderato: 1.55, attivo: 1.725, molto_attivo: 1.9 };

/* ═══════════════════════════════════════════
   WEEKLY DATA BUILDER
   ═══════════════════════════════════════════ */

function buildWeeklyData(foodTotals, weightEntries, fitnessData, gymWorkouts, gymSetsMap, nutritionGoals, goalHistory, settings) {
  // Find date range
  const allDates = [
    ...foodTotals.map(f => f.date),
    ...weightEntries.map(w => w.date),
  ].sort();
  if (allDates.length === 0) return [];

  const firstMonday = getMonday(allDates[0]);
  const lastMonday = getMonday(today());
  const weeks = [];
  let monday = firstMonday;

  // Build lookup maps
  const foodByDate = {};
  foodTotals.forEach(f => { foodByDate[f.date] = f; });
  const weightByDate = {};
  weightEntries.forEach(w => { weightByDate[w.date] = w.weight; });
  const fitnessByDate = {};
  fitnessData.forEach(f => {
    if (!fitnessByDate[f.date]) fitnessByDate[f.date] = [];
    fitnessByDate[f.date].push(f);
  });
  const gymByDate = {};
  gymWorkouts.forEach(g => {
    if (!gymByDate[g.date]) gymByDate[g.date] = [];
    gymByDate[g.date].push(g);
  });

  while (monday <= lastMonday) {
    const sunday = addDays(monday, 6);
    const days = [];
    for (let i = 0; i < 7; i++) days.push(addDays(monday, i));

    const foodDays = days.filter(d => foodByDate[d]);
    const weightDays = days.filter(d => weightByDate[d] != null);
    const fitDays = days.flatMap(d => fitnessByDate[d] || []);
    const gymDays = days.flatMap(d => gymByDate[d] || []);

    // Kcal & macros
    const kcalArr = foodDays.map(d => foodByDate[d].kcal);
    const protArr = foodDays.map(d => foodByDate[d].protein);
    const carbArr = foodDays.map(d => foodByDate[d].carbs);
    const fatArr = foodDays.map(d => foodByDate[d].fat);
    const cheatDays = foodDays.filter(d => foodByDate[d].hasCheat).length;

    const avgKcal = kcalArr.length > 0 ? kcalArr.reduce((s, v) => s + v, 0) / kcalArr.length : null;
    const avgProt = protArr.length > 0 ? protArr.reduce((s, v) => s + v, 0) / protArr.length : null;
    const avgCarbs = carbArr.length > 0 ? carbArr.reduce((s, v) => s + v, 0) / carbArr.length : null;
    const avgFat = fatArr.length > 0 ? fatArr.reduce((s, v) => s + v, 0) / fatArr.length : null;
    const kcalStd = kcalArr.length > 1 ? Math.sqrt(kcalArr.reduce((s, v) => s + (v - avgKcal) ** 2, 0) / (kcalArr.length - 1)) : 0;

    // Weekend vs weekday
    const weekdayKcal = foodDays.filter(d => dayOfWeek(d) < 5).map(d => foodByDate[d].kcal);
    const weekendKcal = foodDays.filter(d => dayOfWeek(d) >= 5).map(d => foodByDate[d].kcal);
    const avgWeekday = weekdayKcal.length > 0 ? weekdayKcal.reduce((s, v) => s + v, 0) / weekdayKcal.length : null;
    const avgWeekend = weekendKcal.length > 0 ? weekendKcal.reduce((s, v) => s + v, 0) / weekendKcal.length : null;

    // Weight at start/end of week (use EMA trend if available, else raw)
    const startWeight = weightDays.length > 0 ? weightByDate[weightDays[0]] : null;
    const endWeight = weightDays.length > 0 ? weightByDate[weightDays[weightDays.length - 1]] : null;
    const deltaWeight = (startWeight != null && endWeight != null) ? round1(endWeight - startWeight) : null;

    // Fitness
    const kmTotal = fitDays.reduce((s, f) => s + (f.distance || 0), 0);
    const fitCalories = fitDays.reduce((s, f) => s + (f.calories || 0), 0);
    const fitMinutes = fitDays.reduce((s, f) => s + (f.duration || 0), 0);

    // Gym
    const gymCount = gymDays.length;
    const gymMinutes = gymDays.reduce((s, g) => s + (g.duration || 0), 0);
    let gymVolume = 0;
    gymDays.forEach(g => {
      const sets = gymSetsMap[g.id] || [];
      sets.forEach(s => { gymVolume += (s.weight || 0) * (s.reps || 0); });
    });

    // Target for this week
    const weekGoal = getWeightedGoalForPeriod(goalHistory, monday, sunday, nutritionGoals);
    const kcalTarget = weekGoal?.kcalTarget || nutritionGoals.kcalTarget || 2000;

    // Observation weight for WLS
    const foodCompleteness = foodDays.length / 7;
    const weightCompleteness = weightDays.length >= 2 ? 1.0 : weightDays.length / 2;
    const rawObsWeight = Math.sqrt(foodCompleteness * weightCompleteness);
    let obsWeight = rawObsWeight;
    if (foodDays.length < 3) obsWeight = rawObsWeight * 0.3;
    else if (foodDays.length < 5) obsWeight = rawObsWeight * 0.7;

    weeks.push({
      monday, sunday,
      daysWithFoodData: foodDays.length,
      daysWithWeightData: weightDays.length,
      avgKcal, avgProt, avgCarbs, avgFat, kcalStd,
      avgWeekday, avgWeekend,
      cheats: cheatDays,
      startWeight, endWeight, deltaWeight,
      kmTotal, fitCalories, fitMinutes,
      gymCount, gymMinutes, gymVolume: round1(gymVolume / 1000), // in tonnellate
      kcalTarget,
      obsWeight,
      isCurrent: monday === lastMonday,
    });

    monday = addDays(monday, 7);
  }
  return weeks;
}

/* ═══════════════════════════════════════════
   SCORECARD COMPUTATION
   ═══════════════════════════════════════════ */

function computeScorecard(week, nutritionGoals, currentWeight) {
  if (!week || week.avgKcal == null) return null;
  const target = week.kcalTarget;
  const pTarget = nutritionGoals.pGrams || 140;

  // Kcal adherence
  const kcalDiff = Math.abs(week.avgKcal - target) / target * 100;
  const kcalColor = kcalDiff <= 5 ? "green" : kcalDiff <= 15 ? "yellow" : "red";
  const kcalNote = kcalColor === "green" ? "In linea con il target" :
    week.avgKcal > target ? "Sopra il target" : "Sotto il target";

  // Protein
  const protPct = pTarget > 0 ? (week.avgProt || 0) / pTarget * 100 : 100;
  const protColor = protPct >= 90 ? "green" : protPct >= 70 ? "yellow" : "red";

  // Training — assume target 3/week
  const gymTarget = 3;
  const gymDiff = week.gymCount - gymTarget;
  const gymColor = gymDiff >= 0 ? "green" : gymDiff >= -1 ? "yellow" : "red";

  // Cardio — assume target 15km/week
  const kmTarget = 15;
  const kmPct = kmTarget > 0 ? week.kmTotal / kmTarget * 100 : 100;
  const kmColor = kmPct >= 80 ? "green" : kmPct >= 50 ? "yellow" : "red";

  // Tracking consistency
  const trackColor = week.daysWithFoodData >= 6 ? "green" : week.daysWithFoodData >= 4 ? "yellow" : "red";

  return {
    kcal: { value: round0(week.avgKcal), target, pct: round0(100 - kcalDiff), color: kcalColor, note: kcalNote },
    protein: { value: round0(week.avgProt || 0), target: pTarget, pct: round0(protPct), color: protColor },
    gym: { value: week.gymCount, target: gymTarget, color: gymColor },
    cardio: { value: round1(week.kmTotal), target: kmTarget, pct: round0(kmPct), color: kmColor },
    tracking: { value: week.daysWithFoodData, target: 7, color: trackColor },
  };
}

/* ═══════════════════════════════════════════
   ENERGY BALANCE COMPUTATION
   ═══════════════════════════════════════════ */

function computeEnergyBalance(week, tdee) {
  if (!week || week.avgKcal == null || week.deltaWeight == null) return null;
  const deficitTeorico = tdee - week.avgKcal;
  const deficitReale = (-week.deltaWeight * 7700) / 7; // kcal/day
  const discrepanza = deficitReale - deficitTeorico;
  const fitBonus = week.fitCalories > 0 ? round0(week.fitCalories / 7) : 0;
  const deficitTeoricoCorretto = deficitTeorico + fitBonus;
  const discrepanzaCorrected = deficitReale - deficitTeoricoCorretto;

  let insight = "";
  if (discrepanzaCorrected > 200) {
    insight = "Stai perdendo peso più velocemente del previsto. Possibili cause: sottostimi le calorie bruciate, o le porzioni sono più piccole di quanto registrato.";
  } else if (discrepanzaCorrected < -200) {
    insight = "Stai perdendo peso più lentamente del previsto. Possibili cause: porzioni non pesate con precisione, condimenti non conteggiati, o adattamento metabolico.";
  } else {
    insight = "Il tuo tracking è preciso! Il deficit reale corrisponde a quello teorico.";
  }

  return {
    deficitTeorico: round0(deficitTeorico),
    deficitTeoricoCorretto: round0(deficitTeoricoCorretto),
    deficitReale: round0(deficitReale),
    discrepanza: round0(discrepanzaCorrected),
    fitBonus,
    insight,
  };
}

/* ═══════════════════════════════════════════
   PATTERN ANALYSIS
   ═══════════════════════════════════════════ */

function computePatterns(weeks, currentWeek) {
  if (!currentWeek || currentWeek.avgWeekday == null) return null;
  const target = currentWeek.kcalTarget;
  const wdAvg = round0(currentWeek.avgWeekday || 0);
  const weAvg = round0(currentWeek.avgWeekend || 0);
  const surplus = weAvg - target;
  const surplusTotal = surplus > 0 ? surplus * 2 : 0;
  const deficitWeek = (target - (currentWeek.avgKcal || 0)) * 7;
  const deficitLostPct = deficitWeek > 0 ? round0(surplusTotal / Math.abs(deficitWeek) * 100) : 0;

  // Multi-week pattern: average surplus per weekend across last 4 weeks
  const recent4 = weeks.filter(w => !w.isCurrent).slice(-4);
  const avgWeekendSurplus = recent4.length > 0
    ? round0(recent4.reduce((s, w) => s + ((w.avgWeekend || 0) - w.kcalTarget), 0) / recent4.length)
    : null;

  return {
    weekday: wdAvg,
    weekend: weAvg,
    target,
    surplusWeekend: surplus > 0 ? round0(surplus) : 0,
    surplusTotal,
    deficitLostPct: clamp(deficitLostPct, 0, 100),
    avgWeekendSurplus,
  };
}

/* ═══════════════════════════════════════════
   PROJECTION COMPUTATION
   ═══════════════════════════════════════════ */

function computeProjection(weightEntries, settings, weeklyData, tdee) {
  if (!settings.goalWeight || weightEntries.length < 7) return null;
  const current = weightEntries[weightEntries.length - 1].weight;
  const gap = Math.abs(current - settings.goalWeight);
  if (gap < 0.1) return null;

  // Current rate from last 14 days
  const recent = weightEntries.slice(-14);
  const n = recent.length;
  if (n < 5) return null;
  const xArr = recent.map((_, i) => i);
  const yArr = recent.map(e => e.weight);
  const xMean = xArr.reduce((s, v) => s + v, 0) / n;
  const yMean = yArr.reduce((s, v) => s + v, 0) / n;
  const num = xArr.reduce((s, x, i) => s + (x - xMean) * (yArr[i] - yMean), 0);
  const den = xArr.reduce((s, x) => s + (x - xMean) ** 2, 0);
  const slope = den > 0 ? num / den : 0; // kg/day
  const weeklyRate = round1(slope * 7);

  const losing = current > settings.goalWeight;

  // Scenario 1: current rate
  const daysAtCurrentRate = slope !== 0 ? Math.abs(gap / Math.abs(slope)) : null;
  const scenario1 = daysAtCurrentRate != null && daysAtCurrentRate < 730
    ? { weeks: round0(daysAtCurrentRate / 7), rate: weeklyRate }
    : null;

  // Scenario 2: optimal (500 kcal deficit)
  const optimalRate = 500 * 7 / 7700;
  const daysOptimal = gap / optimalRate;
  const scenario2 = { weeks: round0(daysOptimal / 7), rate: round1(-optimalRate * 7) };

  // Scenario 3: improved (fix weekend + better tracking)
  const recentWeeks = weeklyData.slice(-4);
  const avgWeekendSurplus = recentWeeks.length > 0
    ? recentWeeks.reduce((s, w) => s + Math.max(0, (w.avgWeekend || 0) - w.kcalTarget), 0) / recentWeeks.length * 2
    : 0;
  const savedKcal = avgWeekendSurplus / 7; // spread over 7 days
  const improvedDeficit = Math.abs(tdee - (weeklyData.slice(-1)[0]?.avgKcal || tdee)) + savedKcal;
  const improvedRate = improvedDeficit * 7 / 7700;
  const daysImproved = gap / improvedRate;
  const scenario3 = improvedRate > 0
    ? { weeks: round0(daysImproved / 7), rate: round1(-improvedRate * 7) }
    : null;

  return { current, goal: settings.goalWeight, gap: round1(gap), scenario1, scenario2, scenario3 };
}

/* ═══════════════════════════════════════════
   ACTIVITY IMPACT
   ═══════════════════════════════════════════ */

function computeActivityImpact(weeklyData) {
  const complete = weeklyData.filter(w => w.daysWithFoodData >= 4 && w.deltaWeight != null);
  if (complete.length < 4) return null;

  const highGym = complete.filter(w => w.gymCount >= 3);
  const lowGym = complete.filter(w => w.gymCount < 3);
  const highKm = complete.filter(w => w.kmTotal >= 15);
  const lowKm = complete.filter(w => w.kmTotal < 15);

  const avg = arr => arr.length > 0 ? round1(arr.reduce((s, w) => s + (w.deltaWeight || 0), 0) / arr.length) : null;

  return {
    highGymDelta: avg(highGym), lowGymDelta: avg(lowGym),
    highKmDelta: avg(highKm), lowKmDelta: avg(lowKm),
    highGymCount: highGym.length, lowGymCount: lowGym.length,
    highKmCount: highKm.length, lowKmCount: lowKm.length,
    totalCalBurned: round0(complete.slice(-1)[0]?.fitCalories || 0),
    gymCalEstimate: round0((complete.slice(-1)[0]?.gymVolume || 0) * 50 + (complete.slice(-1)[0]?.gymMinutes || 0) * 5),
  };
}

/* ═══════════════════════════════════════════
   MACRO CHECK
   ═══════════════════════════════════════════ */

function computeMacroCheck(week, nutritionGoals, currentWeight) {
  if (!week || week.avgProt == null || !currentWeight) return null;
  const protPerKg = round1((week.avgProt || 0) / currentWeight);
  const fatPerKg = round1((week.avgFat || 0) / currentWeight);
  const cutting = (week.avgKcal || 0) < week.kcalTarget;

  const idealProtMin = cutting ? 1.8 : 1.6;
  const idealProtMax = cutting ? 2.2 : 2.0;
  const idealFatMin = 0.8;

  const issues = [];
  if (protPerKg < idealProtMin) {
    const deficit = round0((idealProtMin - protPerKg) * currentWeight);
    issues.push({
      type: "protein_low", priority: "high",
      text: `Proteine basse: ${protPerKg} g/kg (target ${idealProtMin}-${idealProtMax} g/kg). Aumenta di ~${deficit}g/giorno.`,
      tip: "Un uovo = 6g, 100g pollo = 31g, uno yogurt greco = 10g",
    });
  }
  if (fatPerKg < idealFatMin) {
    issues.push({
      type: "fat_low", priority: "medium",
      text: `Grassi troppo bassi: ${fatPerKg} g/kg (minimo ${idealFatMin} g/kg). Rischio impatto ormonale.`,
    });
  }
  if (cutting && protPerKg >= idealProtMin) {
    issues.push({
      type: "protein_ok", priority: "positive",
      text: `Proteine adeguate (${protPerKg} g/kg). Stai proteggendo la massa muscolare.`,
    });
  }

  return { protPerKg, fatPerKg, cutting, issues };
}

/* ═══════════════════════════════════════════
   RECOVERY CHECK
   ═══════════════════════════════════════════ */

function computeRecoveryCheck(weeklyData) {
  const recent = weeklyData.slice(-3);
  if (recent.length < 2) return null;
  const current = recent[recent.length - 1];
  const avg4w = weeklyData.slice(-4).reduce((s, w) => s + w.gymVolume, 0) / Math.min(4, weeklyData.slice(-4).length);

  const signals = [];
  if (current.gymCount > 6) {
    signals.push({ type: "overtraining", text: `${current.gymCount} allenamenti questa settimana. Assicurati di riposare.`, severity: "warning" });
  }
  if (current.gymVolume < avg4w * 0.7 && current.gymCount >= 3) {
    signals.push({ type: "volume_drop", text: `Volume in calo del ${round0((1 - current.gymVolume / avg4w) * 100)}% rispetto alla media. Possibile fatica accumulata.`, severity: "warning" });
  }
  if (current.gymCount === 0 && weeklyData.length > 1) {
    signals.push({ type: "no_training", text: "Nessun allenamento questa settimana. Anche 1 sessione aiuta a preservare il muscolo in deficit.", severity: "info" });
  }
  if (signals.length === 0) {
    signals.push({ type: "ok", text: `${current.gymCount} allenamenti, volume nella norma. Recupero adeguato.`, severity: "ok" });
  }
  return { signals, gymCount: current.gymCount, volume: current.gymVolume, avgVolume: round1(avg4w) };
}

/* ═══════════════════════════════════════════
   PERIOD COMPARISON (4-week blocks)
   ═══════════════════════════════════════════ */

function computePeriodComparison(weeklyData) {
  if (weeklyData.length < 5) return null;
  const current4 = weeklyData.slice(-4);
  const prev4 = weeklyData.slice(-8, -4);
  if (prev4.length < 3) return null;

  const aggregate = (arr) => ({
    weightChange: round1(arr.reduce((s, w) => s + (w.deltaWeight || 0), 0)),
    avgKcal: round0(arr.reduce((s, w) => s + (w.avgKcal || 0), 0) / arr.length),
    avgProt: round0(arr.reduce((s, w) => s + (w.avgProt || 0), 0) / arr.length),
    cheats: arr.reduce((s, w) => s + (w.cheats || 0), 0),
    gymCount: arr.reduce((s, w) => s + w.gymCount, 0),
    kmTotal: round1(arr.reduce((s, w) => s + w.kmTotal, 0)),
    trackingPct: round0(arr.reduce((s, w) => s + w.daysWithFoodData, 0) / (arr.length * 7) * 100),
  });

  return { current: aggregate(current4), previous: aggregate(prev4) };
}

/* ═══════════════════════════════════════════
   DYNAMIC ADVICE
   ═══════════════════════════════════════════ */

function generateAdvice(weeklyData, currentWeek, nutritionGoals, currentWeight, tdee) {
  const tips = [];
  if (!currentWeek || currentWeek.avgKcal == null) return tips;
  const target = currentWeek.kcalTarget;
  const pTarget = nutritionGoals.pGrams || 140;
  const protPerKg = currentWeight ? (currentWeek.avgProt || 0) / currentWeight : 0;

  // Protein check
  if (protPerKg < 1.5 && currentWeek.avgKcal < target) {
    tips.push({ p: 1, icon: "🔴", text: `Proteine a ${round1(protPerKg)} g/kg in deficit. Aumenta a ${round0(1.8 * currentWeight)}g/giorno per preservare la massa muscolare.` });
  }
  // Weekend surplus
  const surplus = currentWeek.avgWeekend != null && currentWeek.avgWeekend > target ? round0(currentWeek.avgWeekend - target) : 0;
  if (surplus > 200) {
    const pct = round0((surplus * 2) / ((target - (currentWeek.avgKcal || target)) * 7 || 1) * 100);
    tips.push({ p: 2, icon: "🟡", text: `Weekend: +${surplus} kcal/giorno sopra il target. Riduce il deficit settimanale del ~${clamp(pct, 0, 100)}%.` });
  }
  // No training
  if (currentWeek.gymCount === 0 && weeklyData.length > 1) {
    tips.push({ p: 2, icon: "🟡", text: "Nessun allenamento questa settimana. Anche 1 sessione aiuta a preservare il muscolo." });
  }
  // Over target 2+ weeks
  const over = weeklyData.slice(-2).filter(w => (w.avgKcal || 0) > w.kcalTarget);
  if (over.length >= 2) {
    tips.push({ p: 1, icon: "🔴", text: "Sopra il target da 2+ settimane. Rivedi le porzioni o aggiusta il target." });
  }
  // Tracking gaps
  if (currentWeek.daysWithFoodData <= 3) {
    tips.push({ p: 2, icon: "🟡", text: `Solo ${currentWeek.daysWithFoodData} giorni tracciati questa settimana. La costanza nel tracking è la chiave.` });
  }
  // Below BMR
  const bmr = computeBMR({ sex: nutritionGoals.sex || "M", weight: currentWeight || 80, height: nutritionGoals.height || 175, age: nutritionGoals.age || 30 });
  if ((currentWeek.avgKcal || 9999) < bmr && currentWeek.daysWithFoodData >= 3) {
    tips.push({ p: 1, icon: "🔴", text: `Stai mangiando sotto il metabolismo basale (${round0(bmr)} kcal). Non è sostenibile.` });
  }
  // Fast weight loss
  if (currentWeek.deltaWeight != null && currentWeek.deltaWeight < -1) {
    tips.push({ p: 2, icon: "🟡", text: `Perdita rapida (${currentWeek.deltaWeight} kg questa settimana). Rischio perdita muscolare e adattamento metabolico.` });
  }
  // Fat too low
  if (currentWeight && (currentWeek.avgFat || 0) / currentWeight < 0.8 && currentWeek.daysWithFoodData >= 3) {
    tips.push({ p: 2, icon: "🟡", text: "Grassi troppo bassi. Minimo 0.8 g/kg per la salute ormonale." });
  }
  // Good tracking
  if (currentWeek.daysWithFoodData >= 6) {
    tips.push({ p: 4, icon: "🟢", text: "Ottimo tracking! Hai registrato quasi ogni giorno." });
  }
  // Good km
  if (currentWeek.kmTotal >= 15) {
    tips.push({ p: 4, icon: "🟢", text: `${round1(currentWeek.kmTotal)} km questa settimana. Stai superando il target!` });
  }

  return tips.sort((a, b) => a.p - b.p);
}

/* ═══════════════════════════════════════════
   MONTHLY REPORT
   ═══════════════════════════════════════════ */

function computeMonthlyReport(weeklyData, weightEntries) {
  // Last ~4 weeks
  const last4 = weeklyData.slice(-4);
  if (last4.length < 2) return null;
  const firstWeek = last4[0];
  const lastWeek = last4[last4.length - 1];

  const weightChange = (lastWeek.endWeight != null && firstWeek.startWeight != null)
    ? round1(lastWeek.endWeight - firstWeek.startWeight) : null;
  const avgKcal = round0(last4.reduce((s, w) => s + (w.avgKcal || 0), 0) / last4.length);
  const totalCheats = last4.reduce((s, w) => s + (w.cheats || 0), 0);
  const totalGym = last4.reduce((s, w) => s + w.gymCount, 0);
  const totalKm = round1(last4.reduce((s, w) => s + w.kmTotal, 0));
  const trackedDays = last4.reduce((s, w) => s + w.daysWithFoodData, 0);
  const totalDays = last4.length * 7;
  const trackingPct = round0(trackedDays / totalDays * 100);
  const avgProt = round0(last4.reduce((s, w) => s + (w.avgProt || 0), 0) / last4.length);
  const avgTarget = round0(last4.reduce((s, w) => s + w.kcalTarget, 0) / last4.length);
  const adherence = avgTarget > 0 ? round0(100 - Math.abs(avgKcal - avgTarget) / avgTarget * 100) : 0;

  // Grade
  let grade;
  if (adherence >= 90 && trackingPct >= 85 && totalGym >= 10) grade = "A";
  else if (adherence >= 80 && trackingPct >= 70 && totalGym >= 8) grade = "B";
  else if (adherence >= 70 && trackingPct >= 50) grade = "C";
  else if (adherence >= 50) grade = "D";
  else grade = "F";

  return { weightChange, avgKcal, totalCheats, totalGym, totalKm, trackingPct, avgProt, adherence, grade };
}

/* ═══════════════════════════════════════════
   TDEE ESTIMATION
   ═══════════════════════════════════════════ */

function computeRealTDEE(weeklyData, calculatedTDEE) {
  // Use last 4 complete weeks
  const complete = weeklyData.filter(w => w.daysWithFoodData >= 5 && w.deltaWeight != null).slice(-4);
  if (complete.length < 3) return null;

  const avgKcal = complete.reduce((s, w) => s + (w.avgKcal || 0), 0) / complete.length;
  const totalDelta = complete.reduce((s, w) => s + (w.deltaWeight || 0), 0);
  const totalDays = complete.length * 7;
  const deficitPerDay = (-totalDelta * 7700) / totalDays;
  const realTDEE = round0(avgKcal + deficitPerDay);
  const diff = realTDEE - calculatedTDEE;
  const diffPct = round0(diff / calculatedTDEE * 100);

  // TDEE trend (rolling by each week)
  const tdeeTrend = complete.map(w => {
    const d = w.deltaWeight != null ? (-w.deltaWeight * 7700) / 7 : 0;
    return round0((w.avgKcal || 0) + d);
  });

  return { realTDEE, calculated: calculatedTDEE, diff: round0(diff), diffPct, tdeeTrend };
}

/* ═══════════════════════════════════════════
   BODY COMPOSITION ESTIMATE
   ═══════════════════════════════════════════ */

function computeBodyComp(weeklyData, currentWeight) {
  const recent4 = weeklyData.filter(w => w.daysWithFoodData >= 4 && w.deltaWeight != null).slice(-4);
  if (recent4.length < 2) return null;

  const totalDelta = recent4.reduce((s, w) => s + (w.deltaWeight || 0), 0);
  const avgProt = recent4.reduce((s, w) => s + (w.avgProt || 0), 0) / recent4.length;
  const protPerKg = currentWeight ? avgProt / currentWeight : 0;
  const avgGymCount = recent4.reduce((s, w) => s + w.gymCount, 0) / recent4.length;
  const volumeTrend = recent4.length >= 2
    ? recent4[recent4.length - 1].gymVolume - recent4[0].gymVolume : 0;

  let fatPct, musclePct, verdict;
  if (totalDelta < 0) { // losing weight
    if (protPerKg >= 1.8 && avgGymCount >= 2) {
      fatPct = 80; musclePct = 20;
      verdict = "Stai preservando bene la massa muscolare. Continua così.";
    } else if (protPerKg >= 1.5 || avgGymCount >= 2) {
      fatPct = 70; musclePct = 30;
      verdict = "Discreta preservazione muscolare. Migliora proteine o frequenza gym.";
    } else {
      fatPct = 55; musclePct = 45;
      verdict = "Rischio elevato di perdita muscolare. Aumenta proteine e allenamento.";
    }
  } else { // gaining or stable
    if (avgGymCount >= 3 && volumeTrend > 0) {
      fatPct = 40; musclePct = 60;
      verdict = "L'aumento è correlato con più volume in palestra. Possibile guadagno muscolare.";
    } else {
      fatPct = 70; musclePct = 30;
      verdict = "L'aumento sembra prevalentemente di grasso. Rivedi l'alimentazione.";
    }
  }

  return { totalDelta: round1(totalDelta), fatPct, musclePct, verdict, protPerKg: round1(protPerKg), avgGymCount: round1(avgGymCount) };
}

/* ═══════════════════════════════════════════
   WEIGHTED LEAST SQUARES REGRESSION
   ═══════════════════════════════════════════ */

function invertMatrix(m) {
  const n = m.length;
  const aug = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-10) return null;
    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }
  return aug.map(row => row.slice(n));
}

function weightedRegression(X, y, weights) {
  const n = X.length;
  const p = X[0].length;
  const Xa = X.map(row => [1, ...row]);
  const pa = p + 1;

  const XtWX = Array.from({ length: pa }, (_, i) =>
    Array.from({ length: pa }, (_, j) =>
      Xa.reduce((sum, row, k) => sum + row[i] * row[j] * weights[k], 0)
    )
  );
  const XtWy = Array.from({ length: pa }, (_, i) =>
    Xa.reduce((sum, row, k) => sum + row[i] * y[k] * weights[k], 0)
  );

  const inv = invertMatrix(XtWX);
  if (!inv) return null;

  const beta = inv.map(row => row.reduce((sum, val, j) => sum + val * XtWy[j], 0));

  const wSum = weights.reduce((s, w) => s + w, 0);
  const yMeanW = weights.reduce((s, w, i) => s + w * y[i], 0) / wSum;
  const ssTotW = y.reduce((s, v, i) => s + weights[i] * (v - yMeanW) ** 2, 0);
  const yPred = Xa.map(row => row.reduce((s, v, j) => s + v * beta[j], 0));
  const ssResW = y.reduce((s, v, i) => s + weights[i] * (v - yPred[i]) ** 2, 0);
  const r2 = ssTotW > 0 ? 1 - ssResW / ssTotW : 0;
  const nEff = wSum;
  const r2adj = nEff > pa + 1 ? 1 - ((1 - r2) * (nEff - 1)) / (nEff - pa - 1) : r2;

  const mse = nEff > pa ? ssResW / (nEff - pa) : 0;
  const se = inv.map((row, i) => Math.sqrt(Math.abs(row[i] * mse)));
  const tStats = beta.map((b, i) => se[i] > 0 ? b / se[i] : 0);

  return { coefficients: beta, r2, r2adj, standardErrors: se, tStatistics: tStats, predictions: yPred };
}

function computeMultipleRegression(weeklyData, tdee) {
  // Filter usable weeks
  const usable = weeklyData.filter(w => w.obsWeight >= 0.15 && w.deltaWeight != null && w.avgKcal != null);
  if (usable.length < 8) return { status: "insufficient", weeksNeeded: 8 - usable.length };

  // Compute weeks in deficit
  let cumDeficit = 0;
  const weeksInDeficit = usable.map(w => {
    if ((w.avgKcal || 0) < tdee * 0.95) cumDeficit++;
    else if (w.daysWithFoodData >= 5 && (w.avgKcal || 0) > tdee) cumDeficit = 0;
    return cumDeficit;
  });

  // Build predictor columns
  const predictorDefs = [
    { name: "Deficit calorico", key: "deficit", extract: w => tdee - (w.avgKcal || 0), unit: "kcal/giorno", expectedSign: -1 },
    { name: "Km percorsi", key: "km", extract: w => w.kmTotal, unit: "km", expectedSign: -1 },
    { name: "Allenamenti gym", key: "gym", extract: w => w.gymCount, unit: "sessioni", expectedSign: -1 },
    { name: "Sgarri", key: "cheats", extract: w => w.cheats, unit: "giorni", expectedSign: 1 },
    { name: "Varianza kcal", key: "variance", extract: w => w.kcalStd, unit: "σ kcal", expectedSign: 1 },
    { name: "Adattamento metabolico", key: "adaptation", extract: (w, i) => weeksInDeficit[i], unit: "settimane", expectedSign: 1 },
    { name: "Volume gym", key: "volume", extract: w => w.gymVolume, unit: "tonn", expectedSign: -1 },
    { name: "Proteine", key: "protein", extract: w => w.avgProt || 0, unit: "g/giorno", expectedSign: -1 },
    { name: "Rapporto weekend", key: "weekendRatio", extract: w => (w.avgWeekend && w.avgWeekday && w.avgWeekday > 0) ? w.avgWeekend / w.avgWeekday : 1, unit: "ratio", expectedSign: 1 },
  ];

  // Filter predictors with enough variance
  const y = usable.map(w => w.deltaWeight);
  const weights = usable.map(w => w.obsWeight);
  const maxPredictors = Math.max(2, Math.floor(usable.length / 3));

  let activePredictors = predictorDefs.map((pd, idx) => {
    const vals = usable.map((w, i) => pd.extract(w, i));
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
    return { ...pd, values: vals, mean, std, idx };
  }).filter(p => p.std > 0.01);

  // Forward selection
  let selected = [];
  let bestR2adj = -Infinity;
  for (let step = 0; step < Math.min(maxPredictors, activePredictors.length); step++) {
    let bestCandidate = null;
    let bestR2 = bestR2adj;
    for (const p of activePredictors) {
      if (selected.find(s => s.key === p.key)) continue;
      const trial = [...selected, p];
      const X = usable.map((_, i) => trial.map(t => t.values[i]));
      const result = weightedRegression(X, y, weights);
      if (result && result.r2adj > bestR2) {
        bestR2 = result.r2adj;
        bestCandidate = p;
      }
    }
    if (bestCandidate && bestR2 > bestR2adj + 0.01) {
      selected.push(bestCandidate);
      bestR2adj = bestR2;
    } else break;
  }

  if (selected.length === 0) return { status: "noSignal" };

  // Final regression
  const X = usable.map((_, i) => selected.map(s => s.values[i]));
  const result = weightedRegression(X, y, weights);
  if (!result || result.r2 < 0.2) return { status: "lowR2", r2: result?.r2 };

  // Standardized coefficients
  const yStd = Math.sqrt(y.reduce((s, v) => s + (v - y.reduce((a, b) => a + b, 0) / y.length) ** 2, 0) / y.length);
  const factors = selected.map((s, i) => {
    const betaStd = yStd > 0 ? result.coefficients[i + 1] * (s.std / yStd) : 0;
    return {
      name: s.name, key: s.key, unit: s.unit,
      beta: round1(result.coefficients[i + 1] * 100) / 100,
      betaStd: round1(Math.abs(betaStd) * 100) / 100,
      tStat: round1(result.tStatistics[i + 1]),
      significant: Math.abs(result.tStatistics[i + 1]) > 1.5,
      expectedSign: s.expectedSign,
      actualSign: result.coefficients[i + 1] > 0 ? 1 : -1,
    };
  });

  // Relative contribution
  const totalBetaStd = factors.reduce((s, f) => s + f.betaStd, 0);
  factors.forEach(f => { f.contribution = totalBetaStd > 0 ? round0(f.betaStd / totalBetaStd * 100) : 0; });
  factors.sort((a, b) => b.contribution - a.contribution);

  // Adaptation alert
  const adaptFactor = factors.find(f => f.key === "adaptation");
  const weeksInDeficitNow = weeksInDeficit[weeksInDeficit.length - 1] || 0;
  let adaptationAlert = null;
  if (adaptFactor && adaptFactor.significant && adaptFactor.actualSign > 0 && weeksInDeficitNow >= 10) {
    adaptationAlert = {
      weeks: weeksInDeficitNow,
      impact: round1(adaptFactor.beta * weeksInDeficitNow),
      suggestion: "Considera una diet break di 7-10 giorni a mantenimento.",
    };
  }

  return {
    status: "ok",
    r2: round1(result.r2 * 100),
    r2adj: round1(result.r2adj * 100),
    factors,
    weeksUsed: usable.length,
    adaptationAlert,
    weeksInDeficit: weeksInDeficitNow,
  };
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */

const CoachSection = ({ T, settings, weightEntries, nutritionGoals, goalHistory, goTo }) => {

  const [loading, setLoading] = useState(true);
  const [foodTotals, setFoodTotals] = useState([]);
  const [fitnessData, setFitnessData] = useState([]);
  const [gymWorkouts, setGymWorkouts] = useState([]);
  const [gymSetsMap, setGymSetsMap] = useState({});
  const [showAllTips, setShowAllTips] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);

  // Load data from IndexedDB
  useEffect(() => {
    const load = async () => {
      try {
        const start = addDays(today(), -120); // last ~4 months
        const end = today();
        const [food, fitness, gym] = await Promise.all([
          getDailyTotalsForRange(start, end),
          getFitnessActivitiesByDateRange(start, end),
          getGymWorkoutsByDateRange(start, end),
        ]);
        // Load sets for each workout
        const setsMap = {};
        await Promise.all(gym.map(async (w) => {
          setsMap[w.id] = await getGymSetsByWorkout(w.id);
        }));
        setFoodTotals(food);
        setFitnessData(fitness);
        setGymWorkouts(gym);
        setGymSetsMap(setsMap);
      } catch (e) {
        console.error("Coach: error loading data", e);
      }
      setLoading(false);
    };
    load();
  }, []);

  // Compute TDEE
  const tdee = useMemo(() => {
    const weight = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1].weight : 80;
    const act = nutritionGoals.activityLevel || "leggero";
    const bmr = computeBMR({
      sex: nutritionGoals.sex || "M",
      weight,
      height: nutritionGoals.height || settings.height || 175,
      age: nutritionGoals.age || 30,
    });
    return Math.round(bmr * (ACT_MULT[act] || 1.375));
  }, [weightEntries, nutritionGoals, settings]);

  const currentWeight = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1].weight : null;

  // Build weekly data
  const weeklyData = useMemo(() =>
    buildWeeklyData(foodTotals, weightEntries, fitnessData, gymWorkouts, gymSetsMap, nutritionGoals, goalHistory, settings),
    [foodTotals, weightEntries, fitnessData, gymWorkouts, gymSetsMap, nutritionGoals, goalHistory, settings]
  );

  const currentWeek = weeklyData.length > 0 ? weeklyData[weeklyData.length - 1] : null;
  const prevWeek = weeklyData.length > 1 ? weeklyData[weeklyData.length - 2] : null;

  // All computations
  const scorecard = useMemo(() => computeScorecard(currentWeek, nutritionGoals, currentWeight), [currentWeek, nutritionGoals, currentWeight]);
  const energyBalance = useMemo(() => computeEnergyBalance(prevWeek || currentWeek, tdee), [prevWeek, currentWeek, tdee]);
  const patterns = useMemo(() => computePatterns(weeklyData, currentWeek), [weeklyData, currentWeek]);
  const projection = useMemo(() => computeProjection(weightEntries, settings, weeklyData, tdee), [weightEntries, settings, weeklyData, tdee]);
  const activityImpact = useMemo(() => computeActivityImpact(weeklyData), [weeklyData]);
  const macroCheck = useMemo(() => computeMacroCheck(currentWeek, nutritionGoals, currentWeight), [currentWeek, nutritionGoals, currentWeight]);
  const recoveryCheck = useMemo(() => computeRecoveryCheck(weeklyData), [weeklyData]);
  const periodComparison = useMemo(() => computePeriodComparison(weeklyData), [weeklyData]);
  const advice = useMemo(() => generateAdvice(weeklyData, currentWeek, nutritionGoals, currentWeight, tdee), [weeklyData, currentWeek, nutritionGoals, currentWeight, tdee]);
  const monthlyReport = useMemo(() => computeMonthlyReport(weeklyData, weightEntries), [weeklyData, weightEntries]);
  const regression = useMemo(() => computeMultipleRegression(weeklyData, tdee), [weeklyData, tdee]);
  const realTDEE = useMemo(() => computeRealTDEE(weeklyData, tdee), [weeklyData, tdee]);
  const bodyComp = useMemo(() => computeBodyComp(weeklyData, currentWeight), [weeklyData, currentWeight]);

  // Minimum data check
  const hasMinData = foodTotals.length >= 7 && weightEntries.length >= 7;

  /* ═══════════════════════════════════════
     SHARED UI COMPONENTS
     ═══════════════════════════════════════ */

  const Card = ({ children, style, onClick }) => (
    <div onClick={onClick} style={{
      background: T.card, borderRadius: 18, padding: "16px", boxShadow: T.shadow, ...style,
    }}>{children}</div>
  );

  const CardTitle = ({ icon: Icon, title, badge, iconColor }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {Icon && <div style={{
          width: 30, height: 30, borderRadius: 9, background: `${iconColor || T.teal}12`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><Icon size={15} color={iconColor || T.teal} /></div>}
        <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{title}</span>
      </div>
      {badge && <span style={{
        fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
        background: badge.bg, color: badge.color,
      }}>{badge.text}</span>}
    </div>
  );

  const Semaphore = ({ color }) => {
    const c = color === "green" ? "#02C39A" : color === "yellow" ? "#F0B429" : "#E85D4E";
    return <div style={{ width: 10, height: 10, borderRadius: 5, background: c, flexShrink: 0 }} />;
  };

  const MetricBar = ({ value, max, color }) => (
    <div style={{ height: 6, background: `${color}20`, borderRadius: 3, flex: 1 }}>
      <div style={{ height: 6, borderRadius: 3, background: color, width: `${clamp(value / max * 100, 0, 100)}%`, transition: "width 0.5s" }} />
    </div>
  );

  const ComparisonArrow = ({ current, previous, inverse }) => {
    const better = inverse ? current < previous : current > previous;
    const same = current === previous;
    if (same) return <span style={{ fontSize: 10, color: T.textMuted }}>= </span>;
    return <span style={{ fontSize: 10, fontWeight: 700, color: better ? "#02C39A" : "#E85D4E" }}>{better ? "↑" : "↓"}</span>;
  };

  /* ═══════════════════════════════════════
     LOADING / NO DATA STATES
     ═══════════════════════════════════════ */

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif", padding: "60px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Caricamento Coach...</div>
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Analisi dei tuoi dati in corso</div>
      </div>
    );
  }

  if (!hasMinData) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => goTo("dashboard")} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <ChevronLeft size={22} color={T.text} />
          </button>
          <span style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Coach</span>
        </div>
        <div style={{ padding: "60px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 8 }}>Dati insufficienti</div>
          <div style={{ fontSize: 13, color: T.textSec, lineHeight: 1.6 }}>
            Continua a tracciare peso e alimentazione per almeno 7 giorni per attivare il Coach.
            Il Coach analizza i tuoi dati per darti consigli personalizzati.
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     MAIN RENDER
     ═══════════════════════════════════════ */

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* HEADER */}
      <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => goTo("dashboard")} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <ChevronLeft size={22} color={T.text} />
          </button>
          <div>
            <span style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Coach</span>
            <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 500 }}>
              Aggiornato {new Date().toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
            </div>
          </div>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: T.gradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 3px 12px rgba(2,128,144,0.25)",
        }}>
          <span style={{ fontSize: 18 }}>✨</span>
        </div>
      </div>

      <div style={{ padding: "14px 16px 120px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ══════════════════════════════════════
            1. SCORECARD SETTIMANALE
           ══════════════════════════════════════ */}
        {scorecard && (
          <Card>
            <CardTitle icon={Award} title="Scorecard Settimanale" badge={
              (() => {
                const greens = Object.values(scorecard).filter(s => s.color === "green").length;
                if (greens >= 4) return { text: "Ottimo!", bg: "#02C39A18", color: "#02C39A" };
                if (greens >= 3) return { text: "Buono", bg: "#F0B42918", color: "#F0B429" };
                return { text: "Da migliorare", bg: "#E85D4E18", color: "#E85D4E" };
              })()
            } />
            {[
              { key: "kcal", label: "Kcal", icon: Flame, val: `${scorecard.kcal.value}`, sub: `target ${scorecard.kcal.target}`, max: scorecard.kcal.target * 1.3 },
              { key: "protein", label: "Proteine", icon: Zap, val: `${scorecard.protein.value}g`, sub: `target ${scorecard.protein.target}g`, max: scorecard.protein.target * 1.3 },
              { key: "gym", label: "Palestra", icon: Dumbbell, val: `${scorecard.gym.value}`, sub: `target ${scorecard.gym.target}`, max: scorecard.gym.target + 2 },
              { key: "cardio", label: "Cardio", icon: Footprints, val: `${scorecard.cardio.value} km`, sub: `target ${scorecard.cardio.target} km`, max: scorecard.cardio.target * 1.5 },
              { key: "tracking", label: "Tracking", icon: CheckCircle2, val: `${scorecard.tracking.value}/7 gg`, sub: "", max: 7 },
            ].map(item => {
              const s = scorecard[item.key];
              const c = s.color === "green" ? "#02C39A" : s.color === "yellow" ? "#F0B429" : "#E85D4E";
              return (
                <div key={item.key} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                  borderTop: `1px solid ${T.border}`,
                }}>
                  <Semaphore color={s.color} />
                  <item.icon size={14} color={T.textSec} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{item.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: c }}>
                        {item.val} <span style={{ fontSize: 10, fontWeight: 500, color: T.textMuted }}>{item.sub}</span>
                      </span>
                    </div>
                    <MetricBar value={typeof s.value === "number" ? s.value : parseFloat(item.val)} max={item.max} color={c} />
                  </div>
                </div>
              );
            })}
          </Card>
        )}

        {/* ══════════════════════════════════════
            2. BILANCIO ENERGETICO
           ══════════════════════════════════════ */}
        {energyBalance && (
          <Card>
            <CardTitle icon={Activity} title="Bilancio Energetico" iconColor="#6366F1" />
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {/* Teorico */}
              <div style={{ flex: 1, background: "#6366F112", borderRadius: 12, padding: "12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#6366F1", marginBottom: 4 }}>Teorico</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>{energyBalance.deficitTeoricoCorretto > 0 ? "-" : "+"}{Math.abs(energyBalance.deficitTeoricoCorretto)}</div>
                <div style={{ fontSize: 10, color: T.textMuted }}>kcal/giorno</div>
              </div>
              {/* Reale */}
              <div style={{ flex: 1, background: `${T.teal}12`, borderRadius: 12, padding: "12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.teal, marginBottom: 4 }}>Reale</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>{energyBalance.deficitReale > 0 ? "-" : "+"}{Math.abs(energyBalance.deficitReale)}</div>
                <div style={{ fontSize: 10, color: T.textMuted }}>kcal/giorno</div>
              </div>
            </div>
            {/* Discrepancy */}
            <div style={{
              padding: "10px 14px", borderRadius: 12,
              background: Math.abs(energyBalance.discrepanza) < 100 ? "#02C39A10" : Math.abs(energyBalance.discrepanza) < 200 ? "#F0B42910" : "#E85D4E10",
              borderLeft: `3px solid ${Math.abs(energyBalance.discrepanza) < 100 ? "#02C39A" : Math.abs(energyBalance.discrepanza) < 200 ? "#F0B429" : "#E85D4E"}`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 4 }}>
                Discrepanza: {energyBalance.discrepanza > 0 ? "+" : ""}{energyBalance.discrepanza} kcal/giorno
              </div>
              <div style={{ fontSize: 11, color: T.textSec, lineHeight: 1.5 }}>{energyBalance.insight}</div>
            </div>
          </Card>
        )}

        {/* ══════════════════════════════════════
            3. CONSIGLI PRIORITIZZATI
           ══════════════════════════════════════ */}
        {advice.length > 0 && (
          <Card>
            <CardTitle icon={Lightbulb} title="Consigli" iconColor="#D97706" />
            {advice.slice(0, showAllTips ? 10 : 3).map((tip, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, padding: "10px 0",
                borderTop: i > 0 ? `1px solid ${T.border}` : "none",
              }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{tip.icon}</span>
                <span style={{ fontSize: 12, color: T.text, lineHeight: 1.5, fontWeight: 500 }}>{tip.text}</span>
              </div>
            ))}
            {advice.length > 3 && (
              <button onClick={() => setShowAllTips(!showAllTips)} style={{
                width: "100%", padding: "8px", border: `1px dashed ${T.border}`, borderRadius: 10,
                background: "transparent", fontSize: 11, fontWeight: 700, color: T.teal,
                cursor: "pointer", fontFamily: "inherit", marginTop: 4,
              }}>
                {showAllTips ? "Mostra meno" : `Mostra altri (${advice.length - 3})`}
              </button>
            )}
          </Card>
        )}

        {/* ══════════════════════════════════════
            4. PROIEZIONE OBIETTIVO
           ══════════════════════════════════════ */}
        {projection && (
          <Card>
            <CardTitle icon={Target} title="Proiezione Obiettivo" iconColor="#02C39A" />
            <div style={{ marginBottom: 12, padding: "10px 14px", background: `${T.teal}08`, borderRadius: 12 }}>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 2 }}>Da perdere</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: T.text }}>
                {projection.gap} kg <span style={{ fontSize: 12, fontWeight: 500, color: T.textMuted }}>→ {projection.goal} kg</span>
              </div>
            </div>
            {[
              projection.scenario1 ? { label: "Ritmo attuale", weeks: projection.scenario1.weeks, rate: projection.scenario1.rate, color: T.teal, icon: "📈" } : null,
              { label: "Ritmo ottimale (-500 kcal)", weeks: projection.scenario2.weeks, rate: projection.scenario2.rate, color: "#02C39A", icon: "🎯" },
              projection.scenario3 ? { label: "Con miglioramenti", weeks: projection.scenario3.weeks, rate: projection.scenario3.rate, color: "#6366F1", icon: "🚀" } : null,
            ].filter(Boolean).map((s, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 0", borderTop: `1px solid ${T.border}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: T.textMuted }}>{s.rate} kg/sett</div>
                  </div>
                </div>
                <div style={{
                  padding: "4px 10px", borderRadius: 8, background: `${s.color}12`,
                  fontSize: 13, fontWeight: 800, color: s.color,
                }}>
                  ~{s.weeks} sett
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* ══════════════════════════════════════
            5. PATTERN SETTIMANALI
           ══════════════════════════════════════ */}
        {patterns && (
          <Card>
            <CardTitle icon={BarChart3} title="Pattern Settimanali" iconColor="#8B5CF6"
              badge={patterns.surplusWeekend > 200 ? { text: "Weekend critico", bg: "#E85D4E18", color: "#E85D4E" } : null}
            />
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, background: "#E8ECEF", borderRadius: 12, padding: "12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.textSec }}>Lun-Ven</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>{patterns.weekday}</div>
                <div style={{ fontSize: 10, color: T.textMuted }}>kcal/giorno</div>
              </div>
              <div style={{
                flex: 1, borderRadius: 12, padding: "12px", textAlign: "center",
                background: patterns.surplusWeekend > 200 ? "#E85D4E10" : "#E8ECEF",
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: patterns.surplusWeekend > 200 ? "#E85D4E" : T.textSec }}>Sab-Dom</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>{patterns.weekend}</div>
                <div style={{ fontSize: 10, color: T.textMuted }}>kcal/giorno</div>
              </div>
            </div>
            {patterns.surplusWeekend > 0 && (
              <div style={{
                padding: "10px 14px", borderRadius: 12, background: "#F0B42910",
                borderLeft: "3px solid #F0B429", fontSize: 11, color: T.text, lineHeight: 1.5,
              }}>
                Il weekend consumi +{patterns.surplusWeekend} kcal/giorno rispetto al target.
                {patterns.deficitLostPct > 0 && ` Questo riduce il tuo deficit settimanale del ~${patterns.deficitLostPct}%.`}
              </div>
            )}
          </Card>
        )}

        {/* ══════════════════════════════════════
            6. IMPATTO ATTIVITÀ FISICA
           ══════════════════════════════════════ */}
        {activityImpact && (
          <Card>
            <CardTitle icon={Dumbbell} title="Impatto Attività" iconColor="#F97316" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {activityImpact.highGymDelta != null && activityImpact.lowGymDelta != null && (
                <div style={{ padding: "10px 14px", background: "#F9731610", borderRadius: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 4 }}>Effetto palestra</div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: T.textSec }}>≥3 sessioni: <strong style={{ color: "#02C39A" }}>{activityImpact.highGymDelta} kg/sett</strong></span>
                    <span style={{ fontSize: 11, color: T.textSec }}>&lt;3 sessioni: <strong style={{ color: "#E85D4E" }}>{activityImpact.lowGymDelta} kg/sett</strong></span>
                  </div>
                </div>
              )}
              {activityImpact.highKmDelta != null && activityImpact.lowKmDelta != null && (
                <div style={{ padding: "10px 14px", background: "#3B82F610", borderRadius: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 4 }}>Effetto cardio</div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: T.textSec }}>≥15 km: <strong style={{ color: "#02C39A" }}>{activityImpact.highKmDelta} kg/sett</strong></span>
                    <span style={{ fontSize: 11, color: T.textSec }}>&lt;15 km: <strong style={{ color: "#E85D4E" }}>{activityImpact.lowKmDelta} kg/sett</strong></span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ══════════════════════════════════════
            7. MACRO CHECK
           ══════════════════════════════════════ */}
        {macroCheck && (
          <Card>
            <CardTitle icon={Zap} title="Check Macro" iconColor="#3B82F6" />
            {macroCheck.issues.map((issue, i) => (
              <div key={i} style={{
                padding: "10px 14px", borderRadius: 12, marginBottom: i < macroCheck.issues.length - 1 ? 8 : 0,
                background: issue.priority === "high" ? "#E85D4E10" : issue.priority === "positive" ? "#02C39A10" : "#F0B42910",
                borderLeft: `3px solid ${issue.priority === "high" ? "#E85D4E" : issue.priority === "positive" ? "#02C39A" : "#F0B429"}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.text, lineHeight: 1.5 }}>{issue.text}</div>
                {issue.tip && <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>{issue.tip}</div>}
              </div>
            ))}
          </Card>
        )}

        {/* ══════════════════════════════════════
            8. RECOVERY CHECK
           ══════════════════════════════════════ */}
        {recoveryCheck && (
          <Card>
            <CardTitle icon={Heart} title="Recovery & Training" iconColor="#EC4899" />
            {recoveryCheck.signals.map((sig, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, padding: "10px 0",
                borderTop: i > 0 ? `1px solid ${T.border}` : "none",
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0,
                  background: sig.severity === "warning" ? "#F0B429" : sig.severity === "ok" ? "#02C39A" : "#3B82F6",
                }} />
                <span style={{ fontSize: 12, color: T.text, lineHeight: 1.5, fontWeight: 500 }}>{sig.text}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <div style={{ flex: 1, background: "#E8ECEF", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{recoveryCheck.gymCount}</div>
                <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 600 }}>Allenamenti</div>
              </div>
              <div style={{ flex: 1, background: "#E8ECEF", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{recoveryCheck.volume}t</div>
                <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 600 }}>Volume</div>
              </div>
              <div style={{ flex: 1, background: "#E8ECEF", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{recoveryCheck.avgVolume}t</div>
                <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 600 }}>Media 4 sett</div>
              </div>
            </div>
          </Card>
        )}

        {/* ══════════════════════════════════════
            9. CONFRONTO PERIODI
           ══════════════════════════════════════ */}
        {periodComparison && (
          <Card>
            <CardTitle icon={BarChart3} title="Confronto 4 Settimane" iconColor="#8B5CF6" />
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <div style={{ flex: 1, textAlign: "center", fontSize: 10, fontWeight: 700, color: T.teal, padding: "4px 0", background: `${T.teal}10`, borderRadius: 8 }}>Ultime 4</div>
              <div style={{ flex: 1, textAlign: "center", fontSize: 10, fontWeight: 700, color: T.textMuted, padding: "4px 0", background: "#E8ECEF", borderRadius: 8 }}>Precedenti 4</div>
            </div>
            {[
              { label: "Peso", curr: `${periodComparison.current.weightChange} kg`, prev: `${periodComparison.previous.weightChange} kg`, currV: periodComparison.current.weightChange, prevV: periodComparison.previous.weightChange, inverse: true },
              { label: "Kcal media", curr: `${periodComparison.current.avgKcal}`, prev: `${periodComparison.previous.avgKcal}`, currV: periodComparison.current.avgKcal, prevV: periodComparison.previous.avgKcal, inverse: true },
              { label: "Proteine", curr: `${periodComparison.current.avgProt}g`, prev: `${periodComparison.previous.avgProt}g`, currV: periodComparison.current.avgProt, prevV: periodComparison.previous.avgProt },
              { label: "Sgarri", curr: `${periodComparison.current.cheats}`, prev: `${periodComparison.previous.cheats}`, currV: periodComparison.current.cheats, prevV: periodComparison.previous.cheats, inverse: true },
              { label: "Allenamenti", curr: `${periodComparison.current.gymCount}`, prev: `${periodComparison.previous.gymCount}`, currV: periodComparison.current.gymCount, prevV: periodComparison.previous.gymCount },
              { label: "Km totali", curr: `${periodComparison.current.kmTotal}`, prev: `${periodComparison.previous.kmTotal}`, currV: periodComparison.current.kmTotal, prevV: periodComparison.previous.kmTotal },
              { label: "Tracking", curr: `${periodComparison.current.trackingPct}%`, prev: `${periodComparison.previous.trackingPct}%`, currV: periodComparison.current.trackingPct, prevV: periodComparison.previous.trackingPct },
            ].map((row, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", padding: "7px 0",
                borderTop: `1px solid ${T.border}`,
              }}>
                <span style={{ width: 80, fontSize: 11, fontWeight: 600, color: T.textSec }}>{row.label}</span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: T.text, textAlign: "center" }}>{row.curr}</span>
                <ComparisonArrow current={row.currV} previous={row.prevV} inverse={row.inverse} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: T.textMuted, textAlign: "center" }}>{row.prev}</span>
              </div>
            ))}
          </Card>
        )}

        {/* ══════════════════════════════════════
            10. RIEPILOGO MENSILE
           ══════════════════════════════════════ */}
        {monthlyReport && (
          <Card>
            <CardTitle icon={Star} title="Riepilogo Mensile" iconColor="#D97706"
              badge={{ text: monthlyReport.grade, bg: monthlyReport.grade === "A" || monthlyReport.grade === "B" ? "#02C39A18" : "#F0B42918", color: monthlyReport.grade === "A" || monthlyReport.grade === "B" ? "#02C39A" : "#F0B429" }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { label: "Peso", value: monthlyReport.weightChange != null ? `${monthlyReport.weightChange > 0 ? "+" : ""}${monthlyReport.weightChange} kg` : "—", color: monthlyReport.weightChange < 0 ? "#02C39A" : "#E85D4E" },
                { label: "Kcal media", value: `${monthlyReport.avgKcal}`, color: T.text },
                { label: "Aderenza", value: `${monthlyReport.adherence}%`, color: monthlyReport.adherence >= 80 ? "#02C39A" : "#F0B429" },
                { label: "Proteine", value: `${monthlyReport.avgProt}g`, color: T.text },
                { label: "Tracking", value: `${monthlyReport.trackingPct}%`, color: monthlyReport.trackingPct >= 80 ? "#02C39A" : "#F0B429" },
                { label: "Sgarri", value: `${monthlyReport.totalCheats}`, color: T.text },
                { label: "Palestra", value: `${monthlyReport.totalGym}`, color: T.text },
                { label: "Km totali", value: `${monthlyReport.totalKm}`, color: T.text },
              ].map((m, i) => (
                <div key={i} style={{ background: "#F7F8FA", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: m.color }}>{m.value}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: T.textMuted }}>{m.label}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ══════════════════════════════════════
            11. REGRESSIONE MULTIPLA
           ══════════════════════════════════════ */}
        {regression && regression.status === "ok" && (
          <Card>
            <CardTitle icon={Brain} title="Fattori di Impatto" iconColor="#7C3AED"
              badge={{ text: `R² ${regression.r2}%`, bg: "#7C3AED18", color: "#7C3AED" }}
            />
            <div style={{ fontSize: 11, color: T.textSec, marginBottom: 12, lineHeight: 1.5 }}>
              I fattori che influenzano di più il <strong style={{ color: T.text }}>tuo</strong> peso, basati su {regression.weeksUsed} settimane di dati:
            </div>
            {regression.factors.map((f, i) => {
              const colors = ["#E85D4E", "#F97316", "#D97706", "#3B82F6", "#8B5CF6", "#6366F1", "#02C39A"];
              const c = colors[i % colors.length];
              return (
                <div key={f.key} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{f.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: c }}>{f.contribution}%</span>
                  </div>
                  <div style={{ height: 8, background: "#E8ECEF", borderRadius: 4 }}>
                    <div style={{ height: 8, borderRadius: 4, background: c, width: `${f.contribution}%`, transition: "width 0.5s" }} />
                  </div>
                  {f.significant && (
                    <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>
                      {f.actualSign === f.expectedSign
                        ? (f.key === "deficit" ? "Le calorie contano molto per te"
                          : f.key === "km" ? "Il cardio fa la differenza"
                          : f.key === "gym" || f.key === "volume" ? "L'allenamento accelera i risultati"
                          : f.key === "cheats" ? "Gli sgarri frenano i progressi"
                          : f.key === "variance" ? "La costanza è più importante del deficit medio"
                          : f.key === "adaptation" ? "Il metabolismo si sta adattando"
                          : f.key === "weekendRatio" ? "Il weekend è il tuo punto debole"
                          : f.key === "protein" ? "Le proteine ti aiutano a perdere grasso"
                          : "")
                        : ""}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Adaptation alert */}
            {regression.adaptationAlert && (
              <div style={{
                padding: "12px 14px", borderRadius: 12, marginTop: 8,
                background: "#F0B42910", borderLeft: "3px solid #F0B429",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#D97706", marginBottom: 4 }}>
                  ⚠️ Adattamento Metabolico Rilevato
                </div>
                <div style={{ fontSize: 11, color: T.text, lineHeight: 1.5 }}>
                  Sei in deficit da {regression.adaptationAlert.weeks} settimane consecutive.
                  {regression.adaptationAlert.suggestion}
                </div>
              </div>
            )}
          </Card>
        )}
        {regression && regression.status === "insufficient" && (
          <Card style={{ opacity: 0.7 }}>
            <CardTitle icon={Brain} title="Fattori di Impatto" iconColor="#7C3AED" />
            <div style={{ fontSize: 12, color: T.textSec, textAlign: "center", padding: "10px 0" }}>
              📊 Servono ancora {regression.weeksNeeded} settimane di dati per il modello predittivo.
            </div>
          </Card>
        )}

        {/* ══════════════════════════════════════
            12. COMPOSIZIONE CORPOREA
           ══════════════════════════════════════ */}
        {bodyComp && (
          <Card>
            <CardTitle icon={Activity} title="Composizione Stimata" iconColor="#059669" />
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: bodyComp.fatPct, height: 24, borderRadius: "8px 0 0 8px", background: "#F0B429", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#fff" }}>{bodyComp.fatPct}% grasso</span>
              </div>
              <div style={{ flex: bodyComp.musclePct, height: 24, borderRadius: "0 8px 8px 0", background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#fff" }}>{bodyComp.musclePct}% muscolo</span>
              </div>
            </div>
            <div style={{ fontSize: 11, color: T.text, lineHeight: 1.5, padding: "8px 12px", background: "#F7F8FA", borderRadius: 10 }}>
              {bodyComp.verdict}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{bodyComp.protPerKg} g/kg</div>
                <div style={{ fontSize: 9, color: T.textMuted }}>Proteine</div>
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{bodyComp.avgGymCount}/sett</div>
                <div style={{ fontSize: 9, color: T.textMuted }}>Allenamenti</div>
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: bodyComp.totalDelta < 0 ? "#02C39A" : "#E85D4E" }}>{bodyComp.totalDelta > 0 ? "+" : ""}{bodyComp.totalDelta} kg</div>
                <div style={{ fontSize: 9, color: T.textMuted }}>Variazione</div>
              </div>
            </div>
          </Card>
        )}

        {/* ══════════════════════════════════════
            13. TDEE REALE
           ══════════════════════════════════════ */}
        {realTDEE && (
          <Card>
            <CardTitle icon={Flame} title="TDEE Reale Stimato" iconColor="#DC2626" />
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, background: "#E8ECEF", borderRadius: 12, padding: "12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.textSec }}>Calcolato</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>{realTDEE.calculated}</div>
                <div style={{ fontSize: 10, color: T.textMuted }}>kcal</div>
              </div>
              <div style={{
                flex: 1, borderRadius: 12, padding: "12px", textAlign: "center",
                background: Math.abs(realTDEE.diff) > 100 ? "#E85D4E10" : "#02C39A10",
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: Math.abs(realTDEE.diff) > 100 ? "#E85D4E" : "#02C39A" }}>Stimato</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>{realTDEE.realTDEE}</div>
                <div style={{ fontSize: 10, color: T.textMuted }}>{realTDEE.diff > 0 ? "+" : ""}{realTDEE.diff} kcal ({realTDEE.diffPct > 0 ? "+" : ""}{realTDEE.diffPct}%)</div>
              </div>
            </div>
            {Math.abs(realTDEE.diff) > 100 && (
              <div style={{
                padding: "10px 14px", borderRadius: 12, fontSize: 11, color: T.text, lineHeight: 1.5,
                background: realTDEE.diff < -100 ? "#F0B42910" : "#02C39A10",
                borderLeft: `3px solid ${realTDEE.diff < -100 ? "#F0B429" : "#02C39A"}`,
              }}>
                {realTDEE.diff < -100
                  ? `Il tuo metabolismo reale è ~${Math.abs(realTDEE.diffPct)}% più basso del calcolato. Aggiusta il target di conseguenza.`
                  : `Il tuo metabolismo è più alto del calcolato. Potresti mangiare leggermente di più mantenendo il deficit.`}
              </div>
            )}
            {realTDEE.tdeeTrend.length >= 3 && (
              <div style={{ marginTop: 10, fontSize: 10, color: T.textMuted, textAlign: "center" }}>
                Trend TDEE: {realTDEE.tdeeTrend.join(" → ")}
                {realTDEE.tdeeTrend[realTDEE.tdeeTrend.length - 1] < realTDEE.tdeeTrend[0] && " ↓ in calo"}
              </div>
            )}
          </Card>
        )}

      </div>
    </div>
  );
};

export default CoachSection;
