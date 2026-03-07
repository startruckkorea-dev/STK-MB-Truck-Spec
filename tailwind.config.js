/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'mb-blue': '#00ADEF',
        'mb-blue-dark': '#0099d4',
      },
      fontFamily: {
        barlow: ['"Barlow Condensed"', 'sans-serif'],
        noto: ['"Noto Sans KR"', 'sans-serif'],
        mono: ['"Roboto Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
