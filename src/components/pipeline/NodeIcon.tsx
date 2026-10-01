// 14px stroke icons for node headers (n8n-style). Decorative: always aria-hidden.

const paths = {
  bolt: <path d="M8.5 1.5 3 9h4.5l-1 5.5L13 7H8.5l1-5.5Z" />,
  user: <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 6.5c.6-2.3 2.6-4 5-4s4.4 1.7 5 4" />,
  code: <path d="m5.5 4.5-3.5 3.5 3.5 3.5m5-7 3.5 3.5-3.5 3.5M9.5 2.5l-3 11" />,
  grid: <path d="M2.5 2.5h4v4h-4zM9.5 2.5h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h4v4h-4z" />,
  box: <path d="M8 1.8 13.8 5v6L8 14.2 2.2 11V5L8 1.8Zm0 0V8m5.8-3L8 8 2.2 5" />,
  layers: <path d="M8 2 14 5 8 8 2 5l6-3Zm-6 5.5L8 10.5l6-3M2 10.5l6 3 6-3" />,
  clock: <path d="M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM8 4.5V8l2.5 1.5" />,
  template: <path d="M5.5 5.5V3a1 1 0 0 1 1-1H13a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-2.5M3 5.5h6.5a1 1 0 0 1 1 1V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" />,
  send: <path d="M14.5 1.5 7 9M14.5 1.5 10 14.5 7 9 1.5 6l13-4.5Z" />,
  ai: <path d="M8 1.5v2m0 9v2M1.5 8h2m9 0h2M8 5.5l.9 1.6 1.6.9-1.6.9L8 10.5l-.9-1.6L5.5 8l1.6-.9L8 5.5Z" />,
  data: <path d="M8 5.5c3 0 5.5-.9 5.5-2S11 1.5 8 1.5 2.5 2.4 2.5 3.5s2.5 2 5.5 2Zm-5.5-2v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" />,
  infra: <path d="M4.5 12.5a3 3 0 0 1-.4-6 4.5 4.5 0 0 1 8.7 1A2.5 2.5 0 0 1 12 12.5H4.5Z" />,
  globe: <path d="M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm-6.5-6.5h13M8 1.5c1.8 1.9 1.8 11.1 0 13M8 1.5c-1.8 1.9-1.8 11.1 0 13" />,
  terminal: <path d="m3 4.5 3 3-3 3m4.5 1h5.5M1.5 1.5h13v13h-13z" />,
  film: <path d="M2.5 2.5h11v11h-11zM5 2.5v11M11 2.5v11M2.5 5.5H5m6 0h2.5M2.5 10.5H5m6 0h2.5" />,
} as const;

export type IconName = keyof typeof paths;

export default function NodeIcon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
