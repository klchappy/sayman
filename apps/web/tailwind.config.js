/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Sayman kurumsal palet (Sayman markası — sade, kart tabanlı, light tema)
        brand: {
          50: '#f0f4fa',
          100: '#dbe6f1',
          200: '#b6cce4',
          300: '#7da8cf',
          400: '#4a7fb1',
          500: '#2a5d92',
          600: '#1f4774',
          700: '#1a3c63',
          800: '#163454',
          900: '#0a2540',
        },
      },
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
