"use client";
// ActivitySection.jsx — Wrapper that merges Fitness (walking) + Gym into a single "Attività" tab
// The sub-sections (FitnessSection, GymSection) remain fully self-contained;
// this component simply adds a toggle bar and renders the selected one.

import React, { useState } from "react";
import FitnessSection from "./FitnessSection";
import GymSection from "./GymSection";
import { Footprints, Dumbbell } from "lucide-react";

const T = {
  bg: "#F5F7FA", card: "#FFFFFF",
  teal: "#028090", tealLight: "#E0F2F1",
  text: "#1A2030", textSec: "#6B7280",
  border: "#F0F0F0",
  gradient: "linear-gradient(135deg, #028090, #02C39A)",
  shadow: "0 2px 16px rgba(0,0,0,0.06)",
};

const TABS = [
  { id: "fitness", label: "Camminate", icon: Footprints },
  { id: "gym",     label: "Palestra",  icon: Dumbbell },
];

export default function ActivitySection({ goTo }) {
  const [activeTab, setActiveTab] = useState("fitness");

  // We render both but hide the inactive one via display:none
  // so that each section keeps its state when toggling
  if (activeTab === "gym") {
    return <GymSection onNavigate={goTo} activityToggle={activeTab} onToggleActivity={setActiveTab} />;
  }
  return <FitnessSection onNavigate={goTo} activityToggle={activeTab} onToggleActivity={setActiveTab} />;
}
