/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0B',
        surface: {
          DEFAULT: '#111113',
          card: '#141417',
          hover: '#18181C',
          subtle: '#1C1C21',
        },
        border: {
          DEFAULT: '#1E1E22',
          subtle: '#27272D',
          hover: '#32323A',
        },
        text: {
          DEFAULT: '#EDEDED',
          muted: '#8A8A93',
          dim: '#5A5A62',
        },
        accent: {
          DEFAULT: '#7C5CFF',
          hover: '#6946F5',
          light: '#967CFF',
          dim: '#7C5CFF18',
          glow: '#7C5CFF33',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.4)',
        'accent-glow': '0 0 24px -4px rgba(124, 92, 255, 0.25)',
      },
    },
  },
  plugins: [],
}
