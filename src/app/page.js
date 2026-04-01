"use client";

import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues with IndexedDB and recharts
const WeightTrackerApp = dynamic(
  () => import("@/components/WeightTrackerApp"),
  { ssr: false }
);

export default function Home() {
  return <WeightTrackerApp />;
}
