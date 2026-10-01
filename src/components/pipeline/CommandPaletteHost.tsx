"use client";

import { useEffect, useState, type ComponentType } from "react";
import { PALETTE_OPEN_EVENT } from "@/lib/palette";

type PaletteProps = { onClose: () => void };

/** Listens for ⌘K / Ctrl+K (or the navbar button) and lazy-loads the palette on first use. */
export default function CommandPaletteHost() {
  const [Palette, setPalette] = useState<ComponentType<PaletteProps> | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => {
      import("./CommandPalette").then((m) => {
        setPalette(() => m.default);
        setOpen(true);
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => {
          if (o) return false;
          show();
          return o;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_OPEN_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_OPEN_EVENT, show);
    };
  }, []);

  return open && Palette ? <Palette onClose={() => setOpen(false)} /> : null;
}
