"use client";
// FitnessSection.jsx — Walking tracker module
// Features: weekly km goal with circular ring, 7-day bar chart,
// activity log, add walk form with auto-pace, Dexie persistence

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  ChevronLeft, Plus, Trash2, Check, X, Settings,
  Timer, Gauge, Footprints, Home, Utensils, Dumbbell, User,
} from "lucide-react";
import {
  addFitnessActivity,
  getFitnessActivitiesByDateRange,
  deleteFitnessActivity,
  getWeeklyGoalKm,
  saveWeeklyGoalKm,
} from "../lib/food-db";

/* ═══════════════════════════════════════════
   THEME — identico a WeightTrackerApp
   ═══════════════════════════════════════════ */

const T = {
  bg: "#F5F7FA",
  card: "#FFFFFF",
  teal: "#028090",
  tealLight: "#E0F2F1",
  mint: "#02C39A",
  coral: "#E85D4E",
  text: "#1A2030",
  textSec: "#6B7280",
  textMuted: "#9CA3AF",
  border: "#F0F0F0",
  gradient: "linear-gradient(135deg, #028090, #02C39A)",
  shadow: "0 2px 16px rgba(0,0,0,0.06)",
  shadowLg: "0 8px 32px rgba(0,0,0,0.08)",
};

// Verde dedicato alla sezione fitness
const GREEN       = "#16A34A";
const GREEN_LIGHT = "#DCFCE7";
const GRADIENT_G  = "linear-gradient(135deg, #16A34A, #02C39A)";

/* ═══════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════ */

const toISO   = (d) => new Date(d).toISOString().split("T")[0];
const todayISO = () => toISO(new Date());

/** Lunedì della settimana corrente (ISO) */
const getMondayISO = () => {
  const d = new Date();
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return toISO(d);
};

/** Array di 7 date ISO (Lun → Dom) della settimana corrente */
const getWeekDaysISO = () => {
  const mon = new Date(getMondayISO());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return toISO(d);
  });
};

const DAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const formatDateLabel = (iso) => {
  const t = todayISO();
  const ieri = toISO(new Date(Date.now() - 86400000));
  if (iso === t)    return "Oggi";
  if (iso === ieri) return "Ieri";
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
};

const formatPace = (p) => {
  if (!p || p <= 0) return "—";
  const min = Math.floor(p);
  const sec = Math.round((p - min) * 60);
  return `${min}'${sec.toString().padStart(2, "0")}"`;
};

const formatDuration = (min) => {
  if (!min) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

/* ═══════════════════════════════════════════
   SHARED SMALL COMPONENTS
   ═══════════════════════════════════════════ */

/** Anello di progresso SVG */
const CircularRing = ({ pct, size = 120, stroke = 11, color = "#fff" }) => {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const off  = circ - Math.min(pct / 100, 1) * circ;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={`${color}30`} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={off}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
};

/** Tooltip personalizzato del grafico */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: T.card, borderRadius: 10, padding: "8px 12px",
      boxShadow: T.shadowLg, fontSize: 12, fontWeight: 700, color: T.text,
    }}>
      {label}: <span style={{ color: GREEN }}>{payload[0].value} km</span>
    </div>
  );
};

/** Bottom nav — replica esatta di quella in WeightTrackerApp */
const FitnessBottomNav = ({ onAdd, onNavigate }) => {
  const tabs = [
    { id: "dashboard", Icon: Home,     label: "Home"    },
    { id: "food",      Icon: Utensils, label: "Cibo"    },
    { id: "add",       Icon: null,     label: ""        },
    { id: "fitness",   Icon: Dumbbell, label: "Fitness" },
    { id: "profile",   Icon: User,     label: "Profilo" },
  ];
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: T.card, borderTop: `1px solid ${T.border}`,
      display: "flex", justifyContent: "space-around", alignItems: "flex-end",
      padding: "6px 8px 22px", zIndex: 20,
      boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
    }}>
      {tabs.map((tab) => {
        if (tab.id === "add") return (
          <button key="add" onClick={onAdd} style={{
            width: 54, height: 54, borderRadius: "50%", border: "none",
            background: T.gradient, color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 24px rgba(2,128,144,0.35)",
            transform: "translateY(-14px)",
          }}>
            <Plus size={26} strokeWidth={2.5} />
          </button>
        );
        const isActive = tab.id === "fitness";
        return (
          <button key={tab.id} onClick={() => onNavigate(tab.id)} style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            padding: "6px 14px", opacity: isActive ? 1 : 0.5, transition: "opacity 0.2s",
          }}>
            <tab.Icon size={21} color={isActive ? T.teal : T.textSec}
              strokeWidth={isActive ? 2.3 : 1.8} />
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.2,
              color: isActive ? T.teal : T.textSec,
            }}>{tab.label}</span>
            {isActive && (
              <div style={{ width: 4, height: 4, borderRadius: 2, background: T.teal, marginTop: -1 }} />
            )}
          </button>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════
   MODAL: modifica obiettivo settimanale
   ═══════════════════════════════════════════ */

const GoalModal = ({ current, onSave, onClose }) => {
  const [val, setVal] = useState(current);
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100, padding: 20,
    }}>
      <div style={{
        background: T.card, borderRadius: 24, padding: 28,
        width: "100%", maxWidth: 320, boxShadow: T.shadowLg,
      }}>
        {/* Header modal */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Obiettivo settimanale</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={20} color={T.textMuted} />
          </button>
        </div>

        <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, textAlign: "center", marginBottom: 16 }}>
          Km da percorrere ogni settimana (Lun → Dom)
        </div>

        {/* Stepper valore */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 28 }}>
          <button onClick={() => setVal(v => Math.max(1, v - 5))} style={{
            width: 44, height: 44, borderRadius: 14, border: "1.5px solid #E5E7EB",
            background: T.bg, cursor: "pointer", fontSize: 22, fontWeight: 700, color: T.text,
          }}>−</button>
          <div style={{ textAlign: "center", minWidth: 90 }}>
            <span style={{ fontSize: 48, fontWeight: 900, color: T.text, letterSpacing: -2 }}>{val}</span>
            <span style={{ fontSize: 16, color: T.textMuted, fontWeight: 700 }}> km</span>
          </div>
          <button onClick={() => setVal(v => Math.min(200, v + 5))} style={{
            width: 44, height: 44, borderRadius: 14, border: "1.5px solid #E5E7EB",
            background: T.bg, cursor: "pointer", fontSize: 22, fontWeight: 700, color: T.text,
          }}>+</button>
        </div>

        <button onClick={() => { onSave(val); onClose(); }} style={{
          width: "100%", padding: 15, borderRadius: 14, border: "none",
          background: GRADIENT_G, color: "#fff", fontSize: 15, fontWeight: 800,
          cursor: "pointer", boxShadow: "0 4px 16px rgba(22,163,74,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <Check size={17} /> Salva obiettivo
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   SCREEN: MAIN FITNESS
   ═══════════════════════════════════════════ */

const MainScreen = ({ activities, weeklyGoal, onAdd, onDelete, onEditGoal, onNavigate }) => {
  const weekDays = useMemo(() => getWeekDaysISO(), []);

  /** Dati grafico: km per ogni giorno della settimana corrente */
  const chartData = useMemo(() => weekDays.map((iso, i) => {
    const km = activities
      .filter(a => a.date === iso)
      .reduce((s, a) => s + a.distanceKm, 0);
    return { day: DAY_LABELS[i], km: parseFloat(km.toFixed(2)), iso };
  }), [activities, weekDays]);

  const weekTotal = useMemo(() =>
    chartData.reduce((s, d) => s + d.km, 0), [chartData]);

  const pct = Math.min((weekTotal / weeklyGoal) * 100, 100);
  const oggi = todayISO();

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif", paddingBottom: 100 }}>

      {/* ── HEADER ── */}
      <div style={{ padding: "20px 20px 10px", background: T.bg, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>Attività</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0, letterSpacing: -0.5 }}>Camminata</h1>
      </div>

      <div style={{ padding: "0 20px" }}>

        {/* ── CARD OBIETTIVO SETTIMANALE ── */}
        <div style={{
          background: GRADIENT_G, borderRadius: 24, padding: "22px 20px",
          marginBottom: 16, boxShadow: "0 8px 32px rgba(22,163,74,0.22)", color: "#fff",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {/* Testo sinistra */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, marginBottom: 4 }}>
                Obiettivo settimana
              </div>
              <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, letterSpacing: -1 }}>
                {weekTotal.toFixed(1)}
                <span style={{ fontSize: 16, fontWeight: 700, opacity: 0.75, marginLeft: 4 }}>
                  / {weeklyGoal} km
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.88, marginTop: 10 }}>
                {pct >= 100
                  ? "🎉 Obiettivo raggiunto questa settimana!"
                  : `Mancano ${(weeklyGoal - weekTotal).toFixed(1)} km`}
              </div>
              <button onClick={onEditGoal} style={{
                marginTop: 12, background: "rgba(255,255,255,0.18)", border: "none",
                borderRadius: 8, padding: "5px 12px", color: "#fff", fontSize: 11,
                fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
              }}>
                <Settings size={11} /> Modifica obiettivo
              </button>
            </div>

            {/* Anello destra */}
            <div style={{ position: "relative", flexShrink: 0, marginLeft: 12 }}>
              <CircularRing pct={pct} size={108} stroke={11} color="#fff" />
              <div style={{
                position: "absolute", inset: 0, display: "flex",
                flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 22, fontWeight: 900 }}>{Math.round(pct)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── GRAFICO SETTIMANALE ── */}
        <div style={{
          background: T.card, borderRadius: 18, padding: "18px 14px 12px",
          boxShadow: T.shadow, marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14 }}>
            📅 Questa settimana
          </div>
          <ResponsiveContainer width="100%" height={118}>
            <BarChart data={chartData} barSize={20} margin={{ top: 0, right: 0, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={T.border} />
              <XAxis dataKey="day"
                tick={{ fontSize: 11, fill: T.textMuted, fontWeight: 600 }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: T.textMuted }}
                axisLine={false} tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: `${GREEN}10` }} />
              <Bar dataKey="km" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.iso === oggi
                        ? T.teal
                        : entry.km > 0
                          ? GREEN
                          : `${GREEN}22`
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Legenda mini */}
          <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
            {[
              { color: T.teal,       label: "Oggi" },
              { color: GREEN,        label: "Altri giorni" },
              { color: `${GREEN}22`, label: "Nessuna" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 600 }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── LISTA SESSIONI ── */}
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>
          🚶 Sessioni recenti
        </div>

        {activities.length === 0 ? (
          <div style={{
            background: T.card, borderRadius: 16, padding: "36px 20px",
            textAlign: "center", boxShadow: T.shadow,
          }}>
            <Footprints size={34} color={T.textMuted} style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14, color: T.textMuted, fontWeight: 600, lineHeight: 1.5 }}>
              Nessuna camminata registrata.<br />Premi + per iniziare!
            </div>
          </div>
        ) : (
          activities.map(a => (
            <div key={a.id} style={{
              background: T.card, borderRadius: 16, padding: "14px 16px",
              marginBottom: 10, boxShadow: T.shadow,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              {/* Icona */}
              <div style={{
                width: 46, height: 46, borderRadius: 14,
                background: GREEN_LIGHT, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Footprints size={21} color={GREEN} />
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 4 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: T.text, letterSpacing: -0.5 }}>
                    {a.distanceKm.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.textMuted }}>km</span>
                  <span style={{ fontSize: 11, color: T.textMuted, marginLeft: "auto", whiteSpace: "nowrap" }}>
                    {formatDateLabel(a.date)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 14 }}>
                  <span style={{
                    fontSize: 11, color: T.textSec,
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <Timer size={11} color={T.textMuted} />
                    {formatDuration(a.durationMin)}
                  </span>
                  <span style={{
                    fontSize: 11, color: T.textSec,
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <Gauge size={11} color={T.textMuted} />
                    {formatPace(a.paceMinKm)}/km
                  </span>
                </div>
              </div>

              {/* Elimina */}
              <button onClick={() => onDelete(a.id)} style={{
                background: "none", border: "none", cursor: "pointer",
                padding: 8, borderRadius: 10, color: T.textMuted, flexShrink: 0,
              }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      <FitnessBottomNav onAdd={onAdd} onNavigate={onNavigate} />
    </div>
  );
};

/* ═══════════════════════════════════════════
   SCREEN: AGGIUNGI CAMMINATA
   ═══════════════════════════════════════════ */

const AddWalkScreen = ({ onSave, onBack, onNavigate }) => {
  const [date,    setDate]    = useState(todayISO());
  const [km,      setKm]      = useState("");
  const [hours,   setHours]   = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [saving,  setSaving]  = useState(false);

  const totalMin = hours * 60 + minutes;
  const distNum  = parseFloat(km.replace(",", "."));
  const valid    = !isNaN(distNum) && distNum > 0.01 && totalMin > 0;

  const pace    = valid ? totalMin / distNum : null;
  const paceStr = pace ? `${Math.floor(pace)}'${Math.round((pace % 1) * 60).toString().padStart(2, "0")}"/km` : "—";

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    await onSave({
      date,
      distanceKm: parseFloat(distNum.toFixed(2)),
      durationMin: totalMin,
      paceMinKm:   parseFloat((pace || 0).toFixed(2)),
    });
    setSaving(false);
  };

  /** Stepper generico per ore/minuti */
  const Stepper = ({ value, onChange, min = 0, max = 99, label }) => (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <button onClick={() => onChange(Math.max(min, value - 1))} style={{
          width: 34, height: 34, borderRadius: 10, border: "1.5px solid #E5E7EB",
          background: T.card, cursor: "pointer", fontSize: 20, fontWeight: 700,
          color: T.text, display: "flex", alignItems: "center", justifyContent: "center",
        }}>−</button>
        <span style={{
          fontSize: 28, fontWeight: 900, color: T.text,
          minWidth: 42, textAlign: "center",
        }}>
          {value.toString().padStart(2, "0")}
        </span>
        <button onClick={() => onChange(Math.min(max, value + 1))} style={{
          width: 34, height: 34, borderRadius: 10, border: "1.5px solid #E5E7EB",
          background: T.card, cursor: "pointer", fontSize: 20, fontWeight: 700,
          color: T.text, display: "flex", alignItems: "center", justifyContent: "center",
        }}>+</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{ padding: "20px 20px 10px", background: T.bg, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onBack} style={{
            background: T.card, border: "none", cursor: "pointer",
            padding: 8, borderRadius: 10,
            display: "flex", alignItems: "center", boxShadow: T.shadow,
          }}>
            <ChevronLeft size={20} color={T.teal} />
          </button>
          <div>
            <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>Fitness</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0, letterSpacing: -0.5 }}>
              Nuova camminata
            </h1>
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 20px 120px" }}>

        {/* ── CARD FORM ── */}
        <div style={{
          background: T.card, borderRadius: 24, padding: "28px 22px",
          boxShadow: T.shadowLg, marginBottom: 16,
        }}>
          {/* Icona */}
          <div style={{
            width: 64, height: 64, borderRadius: 20, background: GREEN_LIGHT,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 22px",
          }}>
            <Footprints size={30} color={GREEN} />
          </div>

          {/* Data */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 6, textAlign: "center" }}>
              DATA
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <input
                type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{
                  fontSize: 15, fontWeight: 700, color: T.text, textAlign: "center",
                  border: "1.5px solid #E5E7EB", borderRadius: 10, padding: "8px 16px",
                  background: "#F9FAFB", outline: "none", fontFamily: "inherit",
                }}
              />
            </div>
          </div>

          {/* Distanza */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 6, textAlign: "center" }}>
              DISTANZA
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <input
                type="number"
                inputMode="decimal"
                value={km}
                onChange={e => setKm(e.target.value)}
                placeholder="0.0"
                style={{
                  fontSize: 48, fontWeight: 900, color: T.text, textAlign: "center",
                  border: "none", background: "transparent", outline: "none",
                  width: 140, fontFamily: "inherit", letterSpacing: -2,
                }}
              />
              <span style={{ fontSize: 18, fontWeight: 700, color: T.textMuted }}>km</span>
            </div>
          </div>

          {/* Durata */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 14, textAlign: "center" }}>
              DURATA
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <Stepper value={hours}   onChange={setHours}   min={0} max={23} label="Ore"     />
              <span style={{ fontSize: 32, fontWeight: 800, color: T.textMuted, paddingBottom: 8 }}>:</span>
              <Stepper value={minutes} onChange={setMinutes} min={0} max={59} label="Minuti"  />
            </div>
          </div>

          {/* Ritmo calcolato */}
          <div style={{
            background: `${T.teal}08`, border: `1px solid ${T.tealLight}`,
            borderRadius: 12, padding: "10px 16px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Gauge size={15} color={T.teal} />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.teal }}>
              Ritmo medio: <strong>{paceStr}</strong>
            </span>
          </div>
        </div>

        {/* ── BOTTONE SALVA ── */}
        <button
          onClick={handleSave}
          disabled={!valid || saving}
          style={{
            width: "100%", padding: 17, borderRadius: 16, border: "none",
            background: valid ? GRADIENT_G : "#E5E7EB",
            color: valid ? "#fff" : T.textMuted,
            fontSize: 16, fontWeight: 800,
            cursor: valid && !saving ? "pointer" : "not-allowed",
            boxShadow: valid ? "0 6px 24px rgba(22,163,74,0.28)" : "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "background 0.2s, box-shadow 0.2s",
          }}
        >
          <Check size={20} />
          {saving ? "Salvataggio…" : "Salva camminata"}
        </button>
      </div>

      <FitnessBottomNav onAdd={() => {}} onNavigate={onNavigate} />
    </div>
  );
};

/* ═══════════════════════════════════════════
   ROOT EXPORT
   ═══════════════════════════════════════════ */

export default function FitnessSection({ onNavigate }) {
  const [subScreen,      setSubScreen]      = useState("main");
  const [activities,     setActivities]     = useState([]);
  const [weeklyGoal,     setWeeklyGoal]     = useState(20);
  const [showGoalModal,  setShowGoalModal]  = useState(false);

  /** Carica tutte le attività degli ultimi 90 giorni + obiettivo */
  const loadData = useCallback(async () => {
    const goal = await getWeeklyGoalKm();
    if (goal) setWeeklyGoal(goal);

    const endDate   = todayISO();
    const startDate = toISO(new Date(Date.now() - 90 * 86400000));
    const acts = await getFitnessActivitiesByDateRange(startDate, endDate);
    setActivities(acts.sort((a, b) => b.date.localeCompare(a.date)));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveActivity = useCallback(async (act) => {
    await addFitnessActivity(act);
    await loadData();
    setSubScreen("main");
  }, [loadData]);

  const handleDelete = useCallback(async (id) => {
    await deleteFitnessActivity(id);
    await loadData();
  }, [loadData]);

  const handleSaveGoal = useCallback(async (km) => {
    await saveWeeklyGoalKm(km);
    setWeeklyGoal(km);
  }, []);

  // Scroll to top quando cambia sub-screen
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [subScreen]);

  return (
    <>
      {subScreen === "addWalk" ? (
        <AddWalkScreen
          onSave={handleSaveActivity}
          onBack={() => setSubScreen("main")}
          onNavigate={onNavigate}
        />
      ) : (
        <MainScreen
          activities={activities}
          weeklyGoal={weeklyGoal}
          onAdd={() => setSubScreen("addWalk")}
          onDelete={handleDelete}
          onEditGoal={() => setShowGoalModal(true)}
          onNavigate={onNavigate}
        />
      )}

      {showGoalModal && (
        <GoalModal
          current={weeklyGoal}
          onSave={handleSaveGoal}
          onClose={() => setShowGoalModal(false)}
        />
      )}
    </>
  );
}
