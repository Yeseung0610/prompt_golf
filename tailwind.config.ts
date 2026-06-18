import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        hud: {
          bg: 'rgba(12, 18, 14, 0.72)',
          border: 'rgba(255, 255, 255, 0.10)',
        },
        grass: {
          DEFAULT: '#3fa34d',
          dark: '#2c7a3f',
          light: '#5cc46b',
        },
        action: {
          DEFAULT: '#22b14c',
          hover: '#1c9a40',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        hud: '0 8px 32px rgba(0, 0, 0, 0.45)',
      },
    },
  },
  plugins: [],
};

export default config;
