/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          black:    '#0a0a0c',
          charcoal: '#111318',
          card:     '#181c24',
          border:   '#252b36',
          muted:    '#2e3545',
          blue:     '#1a35d4',
          'blue-hover': '#1528b0',
          'blue-light': '#2a4fe8',
          'blue-glow':  '#3d65ff',
          chrome:   '#e8ecf2',
          silver:   '#a8b4c4',
          'silver-dark': '#6b7b90',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Bebas Neue"', '"Impact"', 'sans-serif'],
        badge:   ['"Barlow Condensed"', '"Bebas Neue"', 'sans-serif'],
      },
      backgroundImage: {
        'chrome-gradient': 'linear-gradient(180deg, #ffffff 0%, #c8d4e0 30%, #8a9ab0 55%, #c8d4e0 80%, #ffffff 100%)',
        'blue-sweep':      'linear-gradient(135deg, #0d1e80 0%, #1a35d4 50%, #2a4fe8 100%)',
        'card-gradient':   'linear-gradient(160deg, #1a1f2c 0%, #111318 100%)',
        'hero-overlay':    'linear-gradient(180deg, rgba(10,10,12,0.2) 0%, rgba(10,10,12,0.65) 55%, rgba(10,10,12,1) 100%)',
      },
      boxShadow: {
        'blue-glow':   '0 0 30px rgba(26,53,212,0.55)',
        'blue-glow-sm':'0 0 12px rgba(26,53,212,0.45)',
        'chrome':      '0 4px 24px rgba(0,0,0,0.6)',
        'card':        '0 8px 40px rgba(0,0,0,0.45)',
      },
      animation: {
        'fade-in':    'fadeIn 0.55s ease-out',
        'slide-up':   'slideUp 0.5s ease-out',
        'blue-pulse': 'bluePulse 2.8s ease-in-out infinite',
        'hero-cycle': 'heroCycle 16s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:   { '0%': { opacity: '0', transform: 'translateY(22px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        bluePulse: { '0%,100%': { boxShadow: '0 0 18px rgba(26,53,212,0.4)' }, '50%': { boxShadow: '0 0 42px rgba(26,53,212,0.75)' } },
      },
    },
  },
  plugins: [],
}
