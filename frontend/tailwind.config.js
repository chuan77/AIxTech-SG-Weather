/** @type {import('tailwindcss').Config} */
export default {
  content: {
    relative: true,
    files: ['./index.html', './src/**/*.{ts,tsx}'],
  },
  theme: {
    // `md` means "two panes fit", not just "wide": a phone held sideways (390-430px tall) is wider
    // than 768px but keeps the phone layout, the thumb dock and 44px touch targets.
    // Hand-written phone-layout queries in index.css negate this same query; change them together.
    screens: {
      sm: '640px',
      md: { raw: '(min-width: 768px) and (min-height: 500px)' },
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      borderRadius: { card: 'var(--card-radius)' },
      fontFamily: { sans: ['var(--font-body)'] },
      colors: {
        // Themes set --ink (an r g b triplet) so every white/* utility follows the palette.
        white: 'rgb(var(--ink) / <alpha-value>)',
        // Secondary text that clears 4.5:1 on every theme's panels (see --ink-muted in index.css).
        'ink-muted': 'var(--ink-muted)',
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
