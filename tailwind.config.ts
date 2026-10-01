import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

// Every color comes from the CSS variables in src/app/globals.css.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        fg: v("fg"),
        muted: v("muted"),
        accent: { DEFAULT: v("accent"), hover: v("accent-hover") },
        ok: v("ok"),
        line: "var(--line)",
      },
      borderColor: { DEFAULT: "var(--line)" },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      transitionTimingFunction: { expo: "cubic-bezier(0.16, 1, 0.3, 1)" },
    },
  },
  // `.container` / `.container-wide` are defined in globals.css (fixed max content widths).
  corePlugins: { container: false },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant("pointer-fine", "@media (pointer: fine)");
    }),
  ],
};
export default config;
