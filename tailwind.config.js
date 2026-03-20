/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Portuguese Colonial palette
        parchment: {
          50: '#FAF6F0',
          100: '#F5E6D3',
          200: '#E8DCC8',
          300: '#D4C4A8',
          400: '#C4B498',
          500: '#B8A080',
        },
        leather: {
          50: '#5C4033',
          100: '#4A3328',
          200: '#3D2817',
          300: '#2A1A0A',
          400: '#1A0F05',
        },
        gold: {
          light: '#FFD700',
          DEFAULT: '#D4AF37',
          dark: '#B8860B',
        },
        crimson: {
          light: '#C41E3A',
          DEFAULT: '#8B0000',
          dark: '#5C0000',
        },
        sepia: {
          light: '#8B7355',
          DEFAULT: '#5C4033',
          dark: '#3D2817',
        },
      },
      fontFamily: {
        cinzel: ['Cinzel', 'Georgia', 'serif'],
        crimson: ['Crimson Text', 'Georgia', 'serif'],
      },
      boxShadow: {
        'parchment': '4px 4px 8px rgba(0, 0, 0, 0.5)',
        'gold-glow': '0 0 10px rgba(212, 175, 55, 0.5)',
      },
      animation: {
        'typing': 'blink 1s step-end infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0 },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        slideUp: {
          '0%': { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
