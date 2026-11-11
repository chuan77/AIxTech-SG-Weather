/** @type {import('tailwindcss').Config} */
export default {
  content: {
    relative: true,
    files: ['./index.html', './src/**/*.{ts,tsx}'],
  },
  theme: {
    extend: {
      borderRadius: { card: 'var(--card-radius)' },
      fontFamily: { sans: ['var(--font-body)'] },
      colors: {
        // Themes set --ink (an r g b triplet) so every white/* utility follows the palette.
        white: 'rgb(var(--ink) / <alpha-value>)',
        sky: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          700: '#0369a1',
        },
      },
    },
  },
  plugins: [],
};
