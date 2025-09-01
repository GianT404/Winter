/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'pixel': ['"Press Start 2P"', '"Courier New"', 'monospace'],
        'mono': ['"Press Start 2P"', '"Courier New"', 'monospace'],
        'sans': ['"Press Start 2P"', '"Courier New"', 'monospace'],
      },
      fontSize: {
        'xs': ['8px', '1.4'],
        'sm': ['10px', '1.4'],
        'base': ['12px', '1.6'],
        'lg': ['14px', '1.6'],
        'xl': ['16px', '1.6'],
        '2xl': ['18px', '1.6'],
        '3xl': ['20px', '1.6'],
      },
      letterSpacing: {
        'pixel': '0.05em',
        'wide': '0.1em',
        'wider': '0.15em',
      },
      boxShadow: {
        'pixel': '2px 2px 0px rgba(0, 0, 0, 0.3)',
        'pixel-lg': '4px 4px 0px rgba(0, 0, 0, 0.3)',
        'pixel-xl': '6px 6px 0px rgba(0, 0, 0, 0.3)',
      },
      borderWidth: {
        '3': '3px',
        '5': '5px',
      },
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
}