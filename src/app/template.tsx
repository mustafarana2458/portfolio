"use client";

import { useEffect } from "react";
import { routeMounted } from "@/lib/routeSignal";

// Re-mounts on every route change: tells a running route transition the new page is in.
export default function Template({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    routeMounted();
  }, []);
  return <>{children}</>;
}
