"use client";

import { useId, useMemo, useState } from "react";
import type { SkillGroup, SkillItem } from "@/lib/skills";
import Node from "./Node";
import NodeIcon from "./NodeIcon";
import BatchRunner from "./BatchRunner";

/**
 * n8n "node palette": one node per skill group, a real logo per skill, and on hover/focus the
 * projects where it was used (from content.ts). Type to filter live across all groups.
 */
export default function SkillPalette({ groups }: { groups: SkillGroup[] }) {
  const [q, setQ] = useState("");
  const id = useId();
  const query = q.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          items: !query || g.name.toLowerCase().includes(query) ? g.items : g.items.filter((s) => s.name.toLowerCase().includes(query)),
        }))
        .filter((g) => g.items.length),
    [groups, query]
  );
  const count = filtered.reduce((n, g) => n + g.items.length, 0);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div>
      <label htmlFor={`${id}-q`} className="sr-only">
        Search skills
      </label>
      <div className="flex items-center gap-3 rounded-xl border border-line bg-bg/70 px-4 focus-within:border-fg/25">
        <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-muted">
          <circle cx="7" cy="7" r="4.5" />
          <path d="m10.5 10.5 3.5 3.5" strokeLinecap="round" />
        </svg>
        <input
          id={`${id}-q`}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search nodes… (e.g. docker, n8n, react)"
          autoComplete="off"
          spellCheck={false}
          className="h-14 w-full bg-transparent font-mono text-[15px] text-fg placeholder:text-muted focus:outline-none"
        />
        <span aria-hidden className="shrink-0 font-mono text-[13px] text-muted">
          {count}/{total}
        </span>
      </div>
      <p className="mt-3 font-mono text-[13px] text-muted">Hover or focus a skill to see where I used it. The number is how many projects.</p>
      <p role="status" aria-live="polite" className="sr-only">
        {query ? `${count} of ${total} skills match ${q}` : ""}
      </p>

      <ul className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {filtered.map((g) => (
          <li key={g.name}>
            <Node
              name={g.name}
              icon={g.icon}
              ports="both"
              compact
              data={{ "batch-item": "" }}
              meta={{ idle: "queued", success: `${g.items.length} nodes` }}
              className="h-full bg-bg/60 focus-within:z-10 hover:z-10"
              bodyClassName="p-4 md:p-5"
            >
              <h3 className="sr-only">{g.name}</h3>
              <ul className="flex flex-col gap-2">
                {g.items.map((s) => (
                  <Skill key={s.name} s={s} />
                ))}
              </ul>
            </Node>
          </li>
        ))}
      </ul>
      {!filtered.length && (
        <p className="mt-8 font-mono text-[15px] text-muted">
          No node matches <span className="text-fg">“{q}”</span>. Try another search.
        </p>
      )}
      <BatchRunner gap={180} />
    </div>
  );
}

function Skill({ s }: { s: SkillItem }) {
  const used = s.usedIn.length ? s.usedIn.join(", ") : "not in a listed project yet";
  return (
    // Focusable so keyboard users get the same "used in" popover as hover.
    <li
      tabIndex={0}
      className="group/skill relative flex items-center gap-3 rounded-lg border border-line bg-surface/80 px-3 py-2.5 text-[15px] text-fg/90 outline-none transition-colors hover:border-fg/30 focus-visible:border-accent"
    >
      <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-fg/[0.06] text-fg/85">
        {s.logo ? (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d={s.logo} />
          </svg>
        ) : (
          <NodeIcon name={s.glyph ?? "box"} className="h-4 w-4" />
        )}
      </span>
      <span className="min-w-0 flex-1 leading-snug">{s.name}</span>
      <span aria-hidden className="font-mono text-[12px] text-muted">
        {s.usedIn.length || ""}
      </span>
      <span className="sr-only">. Used in: {used}.</span>
      {/* Visual popover (screen readers get the sr-only text above). */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-20 w-max max-w-[260px] translate-y-1 rounded-lg border border-[var(--line-strong)] bg-bg px-3 py-2 font-mono text-[12px] leading-relaxed text-fg opacity-0 shadow-2xl transition-[opacity,transform] duration-200 group-hover/skill:translate-y-0 group-hover/skill:opacity-100 group-focus-visible/skill:translate-y-0 group-focus-visible/skill:opacity-100"
      >
        <span className="block text-muted">used in</span>
        {used}
      </span>
    </li>
  );
}
