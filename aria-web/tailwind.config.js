/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2f8',
          100: '#d9e2ef',
          200: '#b9cbdf',
          300: '#93aecb',
          400: '#6d8db5',
          500: '#1F6B9E',
          600: '#18557e',
          700: '#11405e',
          800: '#0a2a3f',
          900: '#03131f',
        },
        urgency: {
          critique: '#E74C3C',
          eleve: '#E67E22',
          moyen: '#F1C40F',
          faible: '#2ECC71',
          normal: '#27AE60',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};