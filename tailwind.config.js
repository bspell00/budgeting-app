/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'halyard': ['halyard-text', 'sans-serif'],
        'halyard-micro': ['halyard-micro', 'sans-serif'],
        'sans': ['halyard-text', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        // Found Banking Interface Colors
        found: {
          'primary': '#f29676',     // Warm Orange
          'accent': '#f4a688',      // Light Orange Accent  
          'background': '#F8F8F5',  // Off-White
          'surface': '#FFFFFF',     // Surface/Cards
          'text': '#151418',        // Dark Gray/Black
          'divider': '#EFF2F0',     // Hover & Dividers
        },
      },
      gridTemplateColumns: {
        '13': 'repeat(13, minmax(0, 1fr))',
        '14': 'repeat(14, minmax(0, 1fr))',
        '15': 'repeat(15, minmax(0, 1fr))',
        '16': 'repeat(16, minmax(0, 1fr))',
      },
    },
  },
  plugins: [],
}