import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F7F9FB",
        surface: "#FFFFFF",
        surface2: "#EEF2F6",
        border: "#E2E8F0",
        muted: "#64748B",
        ink: "#1E293B",
        primary: "#26D6B5",
        primaryHover: "#1FBF9F",
        accent: "#26D6B5",
        success: "#10B981",
        warn: "#F59E0B",
        danger: "#EF4444",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(38,214,181,0.2), 0 8px 24px rgba(38,214,181,0.12)",
        card: "0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
