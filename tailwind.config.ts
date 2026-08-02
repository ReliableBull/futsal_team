import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        arena: {
          black: "#08090a",
          navy: "#ffffff",
          panel: "#ffffff",
          line: "#d9dee4",
          lime: "#ef4136",
          cyan: "#2563eb",
          red: "#ef4136",
          green: "#16803b",
          gold: "#b7791f",
          steel: "#64748b"
        }
      }
    }
  },
  plugins: []
};

export default config;
