const config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ritual: {
          black: "#000000",
          elevated: "#111827",
          surface: "#1F2937",
          green: "#19D184",
          lime: "#BFFF00",
          pink: "#FF1DCE",
          gold: "#FACC15",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "Fira Code", "monospace"],
      },
      boxShadow: {
        "glow-green": "0 0 30px -5px rgba(25, 209, 132, 0.25)",
        "glow-pink": "0 0 30px -5px rgba(255, 29, 206, 0.2)",
        "glow-lime": "0 0 30px -5px rgba(191, 255, 0, 0.15)",
        card: "0 4px 40px -12px rgba(0, 0, 0, 0.5)",
      },
      keyframes: {
        "pulse-green": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(25, 209, 132, 0)" },
          "50%": { boxShadow: "0 0 20px 2px rgba(25, 209, 132, 0.15)" },
        },
        "terminal-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "count-up": {
          "0%": { opacity: "0.3" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "pulse-green": "pulse-green 2s ease-in-out infinite",
        "terminal-blink": "terminal-blink 1s step-end infinite",
        "scan-line": "scan-line 8s linear infinite",
        "fade-in-up": "fade-in-up 0.5s ease-out forwards",
        "count-up": "count-up 0.3s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
