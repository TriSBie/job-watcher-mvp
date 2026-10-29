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
      // Motion tokens (Đợt 0, T00) — mọi animation từ T01 trở đi dùng đúng các token
      // này, không tự chế thời lượng riêng:
      // - instant 100ms: phản hồi nhấn nút; fast 150ms: hover/micro-interaction;
      // - base 250ms: drawer/overlay/chuyển trạng thái; slow 300ms: drawer slide;
      // - data 700ms: bar/donut/count-up (khung cho phép 600–900ms);
      // - stagger-step 60–100ms, tối đa ~12 item, chỉ ở lần tải đầu, KHÔNG stagger
      //   lại mỗi lần lọc/sắp xếp (chưa dùng ở Đợt 0+1, khóa sẵn cho đợt sau);
      // - easing motion = cubic-bezier(0.4, 0, 0.2, 1) cho mọi chuyển động UI;
      // - spring chỉ cho kéo-thả kanban + khoảnh khắc ăn mừng hiếm, không dùng đại trà;
      // - chỉ animate transform/opacity (ngoại lệ width/height của bar, tối đa 700ms).
      transitionDuration: {
        instant: "100ms",
        fast: "150ms",
        base: "250ms",
        slow: "300ms",
        data: "700ms",
      },
      transitionTimingFunction: {
        motion: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      keyframes: {
        // Flash xác nhận khi đổi trạng thái: nền accent nhạt rồi tan về trong suốt.
        "status-flash": {
          "0%": { backgroundColor: "rgba(94, 106, 210, 0.18)" },
          "100%": { backgroundColor: "transparent" },
        },
        // Dropzone cột rỗng chỉ pulse trong lúc đang kéo (không loop nền).
        "dropzone-pulse": {
          "0%, 100%": { borderColor: "rgba(94, 106, 210, 0.35)" },
          "50%": { borderColor: "rgba(130, 141, 248, 0.85)" },
        },
      },
      animation: {
        "status-flash": "status-flash 650ms cubic-bezier(0.4, 0, 0.2, 1) 1",
        "dropzone-pulse": "dropzone-pulse 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
