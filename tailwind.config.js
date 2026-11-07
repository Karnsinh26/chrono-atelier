/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        atelier: {
          bg: '#0e0f12',
          panel: '#15171c',
          surface: '#1c1f26',
          border: '#262a34',
          gold: '#e6b45a',
          goldHover: '#f0c370',
        },
      },
      fontFamily: {
        brand: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        roman: ['"Cinzel"', 'Georgia', 'serif'],
      },
      screens: {
        desktop: '820px',
      },
    },
  },
  plugins: [],
};
