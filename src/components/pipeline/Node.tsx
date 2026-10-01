import type { ElementType, ReactNode } from "react";
import NodeIcon, { type IconName } from "./NodeIcon";
import { cn } from "@/lib/utils";

export type NodeState = "idle" | "running" | "success";

type Props = {
  /** Header label, e.g. "Trigger · About". */
  name: string;
  icon?: IconName;
  /** Initial state. The pipeline flips it at runtime via `data-state` (no re-render). */
  state?: NodeState;
  /** Mono status text per state. The success text gets the real execution time appended at runtime. */
  meta?: Partial<Record<NodeState, string>>;
  /** Marks this node as a stop on the global pipeline (id must be unique on the page). */
  anchor?: string;
  ports?: "both" | "in" | "out" | "none";
  as?: ElementType;
  className?: string;
  bodyClassName?: string;
  /** Extra header content, right-aligned before the status. */
  headerExtra?: ReactNode;
  id?: string;
  /** Lets a <HoverVideo> inside play while this node is hovered / focused. */
  hoverRoot?: boolean;
  /** Small nested nodes: show only the status dot, not the status text. */
  compact?: boolean;
  /** Extra data attribute hooks (e.g. batch items). */
  data?: Record<string, string>;
  children?: ReactNode;
};

const defaultMeta: Record<NodeState, string> = { idle: "waiting", running: "running…", success: "success" };

/**
 * n8n-style node card: header bar (icon, name, status dot + mono meta), ports on the
 * left/right edges, and a body. Styling for each state lives in globals.css (`.node[data-state]`).
 */
export default function Node({
  name,
  icon = "box",
  state = "idle",
  meta,
  anchor,
  ports = "both",
  as: Tag = "div",
  className,
  bodyClassName,
  headerExtra,
  id,
  hoverRoot,
  compact,
  data,
  children,
}: Props) {
  const m = { ...defaultMeta, ...meta };
  return (
    <Tag
      id={id}
      className={cn("node", className)}
      data-node=""
      data-state={state}
      data-pipeline-anchor={anchor}
      data-hover-root={hoverRoot ? "" : undefined}
      {...(data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [`data-${k}`, v])) : {})}
    >
      {(ports === "both" || ports === "in") && <span aria-hidden className="node-port" data-port="in" />}
      {(ports === "both" || ports === "out") && <span aria-hidden className="node-port" data-port="out" />}
      <div className="node-header">
        <NodeIcon name={icon} className="shrink-0 text-fg/70" />
        <span className="truncate text-fg/85">{name}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {headerExtra}
          <span aria-hidden className="node-dot" />
          {/* Status text is decorative; sections expose their state in their own content. */}
          <span aria-hidden className={cn("node-meta", compact && "hidden")}>
            <span className="meta-idle">{m.idle}</span>
            <span className="meta-running">{m.running}</span>
            <span className="meta-success" data-meta-success>
              {m.success}
            </span>
          </span>
        </span>
      </div>
      <div className={bodyClassName}>{children}</div>
    </Tag>
  );
}
