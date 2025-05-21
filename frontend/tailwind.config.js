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
      // Thêm màu cho Gantt
      'gantt-manual': {
        progress: '#7E22CE', // Tương đương purple-600
        bar: '#E9D5FF',      // Tương đương purple-200
      },
      'gantt-auto': {
        progress: '#16A34A', // Tương đương green-600
        bar: '#DCFCE7',      // Tương đương green-200
      },
      'gantt-completed': {
        progress: '#4B5563', // Tương đương gray-600
        bar: '#D1D5DB',      // Tương đương gray-300
      },
      'gantt-overdue': {
        progress: '#DC2626', // Tương đương red-600
        bar: '#FEE2E2',      // Tương đương red-200
      },
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