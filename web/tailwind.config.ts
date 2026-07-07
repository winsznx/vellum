import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "var(--ink-950)",
          900: "var(--ink-900)",
          850: "var(--ink-850)",
          800: "var(--ink-800)",
          750: "var(--ink-750)",
        },
        slate: {
          950: "var(--slate-950)",
          900: "var(--slate-900)",
          800: "var(--slate-800)",
          700: "var(--slate-700)",
          600: "var(--slate-600)",
          500: "var(--slate-500)",
          400: "var(--slate-400)",
          300: "var(--slate-300)",
          200: "var(--slate-200)",
          100: "var(--slate-100)",
          50: "var(--slate-50)",
        },
        paper: {
          0: "var(--paper-0)",
          50: "var(--paper-50)",
          100: "var(--paper-100)",
          200: "var(--paper-200)",
        },
        cipher: {
          700: "var(--cipher-700)",
          600: "var(--cipher-600)",
          500: "var(--cipher-500)",
          400: "var(--cipher-400)",
          300: "var(--cipher-300)",
          DEFAULT: "var(--cipher-500)",
        },
        reveal: {
          700: "var(--reveal-700)",
          600: "var(--reveal-600)",
          500: "var(--reveal-500)",
          400: "var(--reveal-400)",
          300: "var(--reveal-300)",
          DEFAULT: "var(--reveal-500)",
        },
        settle: {
          700: "var(--settle-700)",
          600: "var(--settle-600)",
          500: "var(--settle-500)",
          400: "var(--settle-400)",
          300: "var(--settle-300)",
          DEFAULT: "var(--settle-500)",
        },
        flow: {
          700: "var(--flow-700)",
          600: "var(--flow-600)",
          500: "var(--flow-500)",
          400: "var(--flow-400)",
          300: "var(--flow-300)",
          DEFAULT: "var(--flow-500)",
        },
        danger: {
          600: "var(--danger-600)",
          500: "var(--danger-500)",
          400: "var(--danger-400)",
          DEFAULT: "var(--danger-500)",
        },
        surface: {
          base: "var(--surface-base)",
          sunken: "var(--surface-sunken)",
          raised: "var(--surface-raised)",
          overlay: "var(--surface-overlay)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
          inverse: "var(--text-inverse)",
        },
        border: {
          hairline: "var(--border-hairline)",
          strong: "var(--border-strong)",
        },
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      boxShadow: {
        vellum: "var(--elev-1)",
        "vellum-popover": "var(--elev-2)",
        "vellum-modal": "var(--elev-3)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      transitionDuration: {
        reveal: "var(--duration-reveal)",
      },
      transitionTimingFunction: {
        reveal: "var(--ease-reveal)",
      },
    },
  },
  plugins: [],
};

export default config;
