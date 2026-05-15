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
          black: "#080b12",
          navy: "#101827",
          panel: "#151d2d",
          line: "#273142",
          lime: "#b6ff4d",
          cyan: "#40d9ff"
        }
      }
    }
  },
  plugins: []
};

export default config;
