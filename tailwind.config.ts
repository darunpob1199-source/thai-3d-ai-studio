import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: "#090b10",
          panel: "#11151f",
          card: "#171c29",
          border: "#232a3d",
          accent: "#6366f1",
          cyan: "#06b6d4",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
