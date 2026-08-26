import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/app/*.tsx", "./src/components/**/*.tsx"],
  theme: {
    extend: {
      colors: {
        ink:      "#131A2E",
        ink2:     "#1E2740",
        ink3:     "#2C3854",
        paper:    "#F8F7F4",
        paper2:   "#EFEDE6",
        rule:     "#D8D4C8",
        graphite: "#5A6478",
        posted:   "#1B6E52",
        held:     "#A9600F",
        flagged:  "#A32E2E",
        stamp:    "#2E4FA3",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans:    ["var(--font-sans)", "system-ui", "sans-serif"],
        mono:    ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        paper: "0 1px 0 rgba(19,26,46,.06), 0 8px 24px -12px rgba(19,26,46,.28)",
      },
    },
  },
  plugins: [],
};
export default config;
