import Dexie from "dexie";

export const db = new Dexie("WeightTrackerDB");

db.version(1).stores({
  weights: "++id, date",
  settings: "key",
});

// Default settings
export const DEFAULT_SETTINGS = {
  height: 175,
  goalWeight: 78,
  startWeight: 85,
  name: "",
};

export async function getSetting(key) {
  const row = await db.settings.get(key);
  return row ? row.value : DEFAULT_SETTINGS[key];
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

export async function getAllSettings() {
  const rows = await db.settings.toArray();
  const s = { ...DEFAULT_SETTINGS };
  rows.forEach((r) => { s[r.key] = r.value; });
  return s;
}

export async function saveAllSettings(settings) {
  const ops = Object.entries(settings).map(([key, value]) =>
    db.settings.put({ key, value })
  );
  await Promise.all(ops);
}

export async function addWeight(date, weight, note = "") {
  // Check if entry exists for date
  const existing = await db.weights.where("date").equals(date).first();
  if (existing) {
    await db.weights.update(existing.id, { weight, note });
    return existing.id;
  }
  return await db.weights.add({ date, weight, note });
}

export async function deleteWeight(id) {
  await db.weights.delete(id);
}

export async function updateWeight(id, weight) {
  await db.weights.update(id, { weight });
}

export async function getAllWeights() {
  return await db.weights.orderBy("date").toArray();
}
