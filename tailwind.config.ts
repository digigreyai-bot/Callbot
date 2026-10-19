import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f17",
        surface: "#121826",
        surface2: "#1a2234",
        border: "#27314a",
        muted: "#8b95ad",
        primary: "#6d5dfc",
        primaryHover: "#5a49f0",
        accent: "#22d3ee",
        success: "#34d399",
        warn: "#fbbf24",
        danger: "#f87171",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(109,93,252,0.25), 0 8px 30px rgba(109,93,252,0.15)",
      },
    },
  },
  plugins: [],
};

export default config;
