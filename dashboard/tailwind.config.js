/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#0f1117',
        surface: '#1a1d27',
        border:  '#2a2d3a',
        muted:   '#7b82a0',
        text:    '#e8eaf0',
        blue:    '#4f8ef7',
        red:     '#e05252',
        green:   '#3ecf8e',
        orange:  '#e0883a',
        purple:  '#7c5cbf',
        yellow:  '#e0c066',
        cyan:    '#60c9d4',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
