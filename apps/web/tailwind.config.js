/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        glass: {
          bg: 'rgba(255, 255, 255, 0.05)',
          'bg-hover': 'rgba(255, 255, 255, 0.08)',
          'bg-strong': 'rgba(255, 255, 255, 0.10)',
          border: 'rgba(255, 255, 255, 0.10)',
          'border-hover': 'rgba(255, 255, 255, 0.15)',
          'border-strong': 'rgba(255, 255, 255, 0.20)',
          text: 'rgba(255, 255, 255, 0.90)',
          'text-muted': 'rgba(255, 255, 255, 0.60)',
          'text-subtle': 'rgba(255, 255, 255, 0.40)',
        },
      },
      backdropBlur: {
        glass: '16px',
        'glass-heavy': '24px',
        'glass-light': '8px',
      },
      boxShadow: {
        glass: '0 4px 30px rgba(0, 0, 0, 0.1)',
        'glass-lg': '0 8px 32px rgba(0, 0, 0, 0.15)',
        'glass-xl': '0 12px 48px rgba(0, 0, 0, 0.20)',
      },
    },
  },
  plugins: [],
}
