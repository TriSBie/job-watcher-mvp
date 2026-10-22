import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Design tokens chuẩn Linear.app (dark)
        base: "#08090A",
        surface: {
          DEFAULT: "#0F1011",
          raised: "#17181A",
          hover: "#1C1D20",
        },
        line: "rgba(255,255,255,0.08)",
        ink: {
          DEFAULT: "#F7F8F8",
          secondary: "#9BA1A6",
          muted: "#62666B",
        },
        accent: {
          DEFAULT: "#5E6AD2",
          hover: "#828DF8",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
