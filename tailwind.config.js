/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        '6fb': {
          bg: '#121212',
          card: '#1a1a1a',
          border: '#333333',
          green: '#00c851',
          'green-hover': '#00a844',
          gold: '#FFD700',
          text: '#FFFFFF',
          'text-secondary': '#888888',
          'text-muted': '#555555',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
