/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
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