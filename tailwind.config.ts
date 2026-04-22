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
          50:  "#fdf4f7",
          100: "#fce8f0",
          200: "#fad1e1",
          300: "#f6aac8",
          400: "#ef79a8",
          500: "#e44f88",
          600: "#d03070",
          700: "#b0225d",
          800: "#921f50",
          900: "#7c1f47",
          950: "#4a0b27",
        },
      },
    },
  },
  plugins: [],
};

export default config;
