/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        surface: {
          DEFAULT: '#0A0A0A',
          card: '#111111',
          hover: '#171717',
          subtle: '#1C1C1C',
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.09)',
          subtle: 'rgba(255, 255, 255, 0.05)',
          hover: 'rgba(255, 255, 255, 0.22)',
          strong: 'rgba(255, 255, 255, 0.45)',
        },
        text: {
          DEFAULT: '#FFFFFF',
          secondary: '#A1A1A6',
          muted: '#737373',
          dim: '#484848',
        },
        accent: {
          DEFAULT: '#FFFFFF',
          hover: '#E5E5E5',
          dark: '#000000',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
        display: ['"Oswald"', '"Bebas Neue"', 'Inter', 'sans-serif'],
      },
      letterSpacing: {
        'tightest': '-0.04em',
        'tighter': '-0.02em',
        'wide-tall': '0.12em',
      },
    },
  },
  plugins: [],
}
