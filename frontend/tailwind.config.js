/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
    colors: {
      'primary': {
        light: '#60A5FA', // blue-400
        DEFAULT: '#3B82F6', // blue-500
        dark: '#1D4ED8', // blue-700
      },
      'secondary': '#10B981', // emerald-500
      'accent': '#F59E0B', // amber-500
      // Define more custom colors as needed
    },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}