/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        ui: ["Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        logo: ["Russo One", "system-ui", "sans-serif"],
      },
      boxShadow: {
        ops: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)",
        "ops-sm": "0 1px 0 rgba(255,255,255,0.03) inset",
      },
      colors: {
        ops: {
          black: "#0A0A0A",
          card: "#141414",
          elevated: "#1A1A1A",
          border: "#2A2A2A",
          gold: "#F5C518",
          teal: "#00A4A6",
          text: "#F2F0EA",
          muted: "rgba(242, 240, 234, 0.62)",
          green: "#22C55E",
          red: "#EF4444",
          orange: "#F97316",
        },
        operator: {
          bg: "#EDE9DE",
          surface: "#FFFFFF",
          ink: "#14120E",
          muted: "#4A4843",
          border: "#C9C4B8",
          accent: "#D4A017",
          "accent-fg": "#14120E",
          success: "#15803D",
          danger: "#B91C1C",
        },
      },
      borderRadius: {
        ops: "0.875rem",
      },
    },
  },
  plugins: [],
}