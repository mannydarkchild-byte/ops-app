/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.45" }],
        sm: ["0.9375rem", { lineHeight: "1.45" }],
        base: ["1.0625rem", { lineHeight: "1.5" }],
        lg: ["1.1875rem", { lineHeight: "1.45" }],
        xl: ["1.3125rem", { lineHeight: "1.4" }],
      },
      colors: {
        ops: {
          black: '#0A0A0A',
          card: '#141414',
          border: '#2A2A2A',
          gold: '#F5C518',
          teal: '#00A4A6',
          text: '#F2F0EA',
          green: '#22C55E',
          red: '#EF4444',
        }
      }
    },
  },
  plugins: [],
}