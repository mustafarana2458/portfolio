"use client";

import { useEffect } from "react";
import { revealAfterNavigation } from "@/lib/transition";

// Re-mounts on every route change: lifts the curtain that TransitionLink dropped.
export default function Template({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    revealAfterNavigation();
  }, []);
  return <>{children}</>;
}
