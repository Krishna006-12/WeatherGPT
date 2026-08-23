/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'sky-900': '#0F3D5C',
        'sky-500': '#3E7EA6',
        'monsoon-100': '#F4F8FA',
        'cloud-200': '#E4EAEE',
        'ink-800': '#1B2530',
        'ink-500': '#5B6B78',
        'alert-amber': '#C97A1A',
        'alert-red': '#B3261E',
        'success-green': '#2E7D5B',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'card': '12px',
      }
    },
  },
  plugins: [],
}