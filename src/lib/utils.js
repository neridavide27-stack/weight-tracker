// Date helpers
export const formatDate = (d) =>
  new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "short" });

export const formatDateFull = (d) =>
  new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

export const toISO = (d) => new Date(d).toISOString().split("T")[0];
export const today = () => toISO(new Date());

// EMA (Exponential Moving Average)
export const calcEMA = (entries, alpha = 0.15) => {
  if (entries.length === 0) return [];
  let ema = entries[0].weight;
  return entries.map((e, i) => {
    if (i === 0) return { ...e, trend: ema };
    ema = alpha * e.weight + (1 - alpha) * ema;
    return { ...e, trend: Math.round(ema * 100) / 100 };
  });
};

// Linear regression
export const linearRegression = (data) => {
  const n = data.length;
  if (n < 2) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  data.forEach((d, i) => {
    sumX += i;
    sumY += d.trend || d.weight;
    sumXY += i * (d.trend || d.weight);
    sumX2 += i * i;
  });
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
};

// BMI
export const calcBMI = (weight, heightCm) => {
  if (!weight || !heightCm) return null;
  const h = heightCm / 100;
  return Math.round((weight / (h * h)) * 10) / 10;
};

export const bmiCategory = (bmi) => {
  if (!bmi) return "";
  if (bmi < 18.5) return "Sottopeso";
  if (bmi < 25) return "Normopeso";
  if (bmi < 30) return "Sovrappeso";
  return "Obesità";
};

export const bmiColor = (bmi) => {
  if (!bmi) return "#6B7B7B";
  if (bmi < 18.5) return "#3B82F6";
  if (bmi < 25) return "#02C39A";
  if (bmi < 30) return "#F0B429";
  return "#E85D4E";
};

// Period average
export const periodAvg = (entries, daysBack) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const filtered = entries.filter((e) => new Date(e.date) >= cutoff);
  if (filtered.length === 0) return null;
  return Math.round((filtered.reduce((s, e) => s + e.weight, 0) / filtered.length) * 100) / 100;
};

// Period change (compare last N days avg vs previous N days avg)
export const periodChange = (entries, days) => {
  const now = new Date();
  const midpoint = new Date();
  midpoint.setDate(now.getDate() - days);
  const earlier = new Date();
  earlier.setDate(now.getDate() - days * 2);
  const recent = entries.filter((e) => { const d = new Date(e.date); return d >= midpoint && d <= now; });
  const previous = entries.filter((e) => { const d = new Date(e.date); return d >= earlier && d < midpoint; });
  if (recent.length === 0 || previous.length === 0) return null;
  const avgRecent = recent.reduce((s, e) => s + e.weight, 0) / recent.length;
  const avgPrev = previous.reduce((s, e) => s + e.weight, 0) / previous.length;
  return Math.round((avgRecent - avgPrev) * 100) / 100;
};
