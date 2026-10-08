/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'tape-cream': '#fbf7ee',
        'tape-red': '#f8c8c8',
        'tape-mustard': '#fae498',
        'tape-teal': '#bfe8e5',
        'tape-sage': '#cde3c7',
        'kraft': '#d8c29d',
        'kraft-deep': '#c4ab82',
        'kraft-card': '#e4d3b6',
        'kraft-dark': '#2b1d0f',
        'kraft-border': '#b89b70'
      },
      fontFamily: {
        hand: ['Caveat', 'cursive', 'system-ui']
      },
      keyframes: {
        'buddy-idle': {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-2px) scale(1.008, 0.992)' }
        },
        'buddy-sway': {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '30%': { transform: 'rotate(-1.5deg) translateY(-0.5px)' },
          '70%': { transform: 'rotate(1deg) translateY(0.5px)' }
        },
        'buddy-walk': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '25%': { transform: 'translateY(-3.5px) rotate(1.5deg)' },
          '50%': { transform: 'translateY(0) rotate(0deg)' },
          '75%': { transform: 'translateY(-3.5px) rotate(-1.5deg)' }
        },
        'buddy-celebrate': {
          '0%': { transform: 'translateY(0) scale(1) rotate(0deg)' },
          '20%': { transform: 'translateY(2px) scale(1.08, 0.92) rotate(0deg)' },
          '45%': { transform: 'translateY(-10px) scale(0.92, 1.08) rotate(-2deg)' },
          '70%': { transform: 'translateY(0) scale(1.05, 0.95) rotate(1deg)' },
          '85%': { transform: 'translateY(-2px) scale(0.98, 1.02) rotate(-0.5deg)' },
          '100%': { transform: 'translateY(0) scale(1) rotate(0deg)' }
        },
        'buddy-focus': {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '40%': { transform: 'translateY(2px) scale(1.02, 0.98) rotate(-1deg)' },
          '75%': { transform: 'translateY(-0.5px) scale(1.01)' }
        },
        'slide-settle': {
          '0%': { transform: 'translateY(8px) rotate(-1deg)', opacity: '0' },
          '100%': { transform: 'translateY(0) rotate(0.5deg)', opacity: '1' }
        }
      },
      animation: {
        'buddy-idle': 'buddy-idle 3.8s ease-in-out infinite',
        'buddy-sway': 'buddy-sway 2.4s ease-in-out',
        'buddy-walk': 'buddy-walk 360ms ease-in-out infinite',
        'buddy-celebrate': 'buddy-celebrate 520ms cubic-bezier(0.2, 0.9, 0.3, 1.2)',
        'buddy-focus': 'buddy-focus 550ms ease-out',
        'slide-settle': 'slide-settle 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }
    }
  },
  plugins: []
};
