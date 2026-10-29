/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        marinho: {
          DEFAULT: "#141D3E",
          900: "#0D1430",
          800: "#141D3E",
          700: "#222D57",
          600: "#33406F",
          200: "#C9CEE0",
          100: "#E3E6F0",
          50: "#F1F2F7",
        },
        vermelho: {
          DEFAULT: "#E81534",
          700: "#C10F2A",
          100: "#FBD3DA",
          50: "#FDECEF",
        },
        papel: "#F4F4F4",
        tinta: "#1A1D29",
        grifo: "#FFE54D",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
