import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#faf8f5",
          100: "#f5f0ea",
          200: "#ede3d8",
          300: "#e0cfc0",
          400: "#d4bba7",
          500: "#c9a88f",
          600: "#8a6a50",
          700: "#333333",
          800: "#1e1e1e",
          900: "#141414",
          950: "#0a0a0a",
        },
        beige: {
          DEFAULT: "#f1e8de",
          dark: "#e8ddd2",
        },
      },
    },
  },
  plugins: [],
};

export default config;
